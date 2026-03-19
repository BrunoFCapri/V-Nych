use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub related_note_id: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub related_note_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub related_note_id: Option<Uuid>,
}

pub async fn list_tasks(State(state): State<AppState>) -> Result<Json<Vec<Task>>, (StatusCode, String)> {
    let tasks = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks ORDER BY created_at DESC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(tasks))
}

pub async fn create_task(
    State(state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<Json<Task>, (StatusCode, String)> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (title, priority, due_date, related_note_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(payload.title)
    .bind(payload.priority.unwrap_or_else(|| "medium".to_string()))
    .bind(payload.due_date)
    .bind(payload.related_note_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(task))
}

pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, (StatusCode, String)> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET title = COALESCE($2, title),
            status = COALESCE($3, status),
            priority = COALESCE($4, priority),
            due_date = COALESCE($5, due_date),
            related_note_id = COALESCE($6, related_note_id),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.title)
    .bind(payload.status)
    .bind(payload.priority)
    .bind(payload.due_date)
    .bind(payload.related_note_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(task))
}

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM tasks WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
