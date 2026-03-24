mod tasks;
mod users;
mod notes;
mod calendar;

use axum::{
    extract::{Path, State},
    routing::{get, post, patch, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt as _, util::SubscriberInitExt as _};

#[derive(Clone)]
pub struct AppState {
    pub db: Pool<Postgres>,
    pub redis: redis::Client,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Database connection string
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/chaja_mesh".to_string());

    // Redis connection string
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379/".to_string());

    // Connect to Postgres
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    tracing::info!("Running migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    tracing::info!("Migrations run successfully");

    // Connect to Redis
    let redis_client = redis::Client::open(redis_url)?;

    let state = AppState {
        db: pool,
        redis: redis_client,
    };

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any) // For development, allow any origin. Tighten this for production.
        .allow_methods(Any)
        .allow_headers(Any);

    // Build the router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/status", get(get_status))
        .route("/api/tasks", get(tasks::list_tasks).post(tasks::create_task))
        .route("/api/tasks/:id", patch(tasks::update_task).delete(tasks::delete_task))
        .route("/api/notes", get(notes::list_notes).post(notes::create_note))
        .route("/api/notes/:id", get(notes::get_note).patch(notes::update_note).delete(notes::delete_note))
        .route("/api/calendar/events", get(calendar::list_events).post(calendar::create_event))
        .route("/api/calendar/events/:id", get(calendar::get_event).patch(calendar::update_event).delete(calendar::delete_event))
        .route("/api/auth/register", post(users::register))
        .route("/api/auth/login", post(users::login))
        .layer(cors)
        .with_state(state);

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

#[derive(Serialize)]
struct StatusResponse {
    status: String,
    database: String,
    redis: String,
}

async fn get_status(State(state): State<AppState>) -> Json<StatusResponse> {
    // Check DB
    let db_status = match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => "Connected".to_string(),
        Err(_) => "Disconnected".to_string(),
    };

    // Check Redis
    let redis_status = match state.redis.get_connection() {
        Ok(mut conn) => {
            match redis::cmd("PING").query::<String>(&mut conn) {
                Ok(_) => "Connected".to_string(),
                Err(_) => "Disconnected".to_string(),
            }
        },
        Err(_) => "Disconnected".to_string(),
    };

    Json(StatusResponse {
        status: "Running".to_string(),
        database: db_status,
        redis: redis_status,
    })
}
