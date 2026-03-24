use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::AppState;
use crate::users::Claims;

#[derive(Debug, Serialize, FromRow)]
pub struct Task {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub list_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub is_starred: bool,
    pub position: i32,
    pub related_note_id: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TaskList {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub title: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_default: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub list_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub related_note_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub is_starred: Option<bool>,
    pub list_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub position: Option<i32>,
    pub related_note_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateListRequest {
    pub title: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateListRequest {
    pub title: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskFilter {
    pub list_id: Option<Uuid>,
    pub is_starred: Option<bool>,
    pub parent_id: Option<Uuid>,
}

// --- List Handlers ---

pub async fn get_lists(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<TaskList>>, (StatusCode, String)> {
    let lists = sqlx::query_as::<_, TaskList>(
        "SELECT * FROM task_lists WHERE user_id = $1 ORDER BY created_at ASC"
    )
    .bind(claims.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(lists))
}

pub async fn create_list(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateListRequest>,
) -> Result<Json<TaskList>, (StatusCode, String)> {
    let list = sqlx::query_as::<_, TaskList>(
        r#"
        INSERT INTO task_lists (user_id, title, color, icon)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(claims.user_id)
    .bind(payload.title)
    .bind(payload.color)
    .bind(payload.icon)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(list))
}

pub async fn update_list(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<UpdateListRequest>,
) -> Result<Json<TaskList>, (StatusCode, String)> {
    let list = sqlx::query_as::<_, TaskList>(
        r#"
        UPDATE task_lists
        SET title = COALESCE($2, title),
            color = COALESCE($3, color),
            icon = COALESCE($4, icon),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $5
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.title)
    .bind(payload.color)
    .bind(payload.icon)
    .bind(claims.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if matches!(e, sqlx::Error::RowNotFound) {
            (StatusCode::NOT_FOUND, "List not found".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        }
    })?;

    Ok(Json(list))
}

pub async fn delete_list(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM task_lists WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.user_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "List not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// --- Task Handlers ---

pub async fn list_tasks(
    State(state): State<AppState>,
    claims: Claims,
    Query(filter): Query<TaskFilter>,
) -> Result<Json<Vec<Task>>, (StatusCode, String)> {
    let mut query_builder = sqlx::QueryBuilder::new("SELECT * FROM tasks WHERE user_id = ");
    query_builder.push_bind(claims.user_id);

    if let Some(list_id) = filter.list_id {
        query_builder.push(" AND list_id = ");
        query_builder.push_bind(list_id);
    }
    
    if let Some(is_starred) = filter.is_starred {
        if is_starred {
             query_builder.push(" AND is_starred = TRUE");
        }
    }

    if let Some(parent_id) = filter.parent_id {
        query_builder.push(" AND parent_id = ");
        query_builder.push_bind(parent_id);
    }

    query_builder.push(" ORDER BY position ASC, created_at DESC");

    let query = query_builder.build_query_as::<Task>();
    let tasks = query
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(tasks))
}

pub async fn create_task(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<Json<Task>, (StatusCode, String)> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (user_id, title, description, priority, due_date, list_id, parent_id, related_note_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#
    )
    .bind(claims.user_id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(payload.priority.unwrap_or_else(|| "medium".to_string()))
    .bind(payload.due_date)
    .bind(payload.list_id)
    .bind(payload.parent_id)
    .bind(payload.related_note_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(task))
}

pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, (StatusCode, String)> {
    // Determine update logic with CASE for completed_at
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            priority = COALESCE($5, priority),
            due_date = COALESCE($6, due_date),
            is_starred = COALESCE($7, is_starred),
            list_id = COALESCE($8, list_id),
            parent_id = COALESCE($9, parent_id),
            position = COALESCE($10, position),
            related_note_id = COALESCE($11, related_note_id),
            completed_at = CASE 
                WHEN $4 = 'done' OR $4 = 'completed' THEN NOW()
                WHEN $4 IS NOT NULL AND $4 != 'done' AND $4 != 'completed' THEN NULL
                ELSE completed_at
            END,
            updated_at = NOW()
        WHERE id = $1 AND user_id = $12
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(payload.status)
    .bind(payload.priority)
    .bind(payload.due_date)
    .bind(payload.is_starred)
    .bind(payload.list_id)
    .bind(payload.parent_id)
    .bind(payload.position)
    .bind(payload.related_note_id)
    .bind(claims.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if matches!(e, sqlx::Error::RowNotFound) {
            (StatusCode::NOT_FOUND, "Task not found".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        }
    })?;

    Ok(Json(task))
}

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM tasks WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.user_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Task not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
