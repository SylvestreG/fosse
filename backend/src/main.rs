mod app;
mod config;
mod db;
mod entities;
mod errors;
mod handlers;
mod middleware;
mod models;
mod services;

use config::Config;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load config from project root
    let config_path = std::env::var("CONFIG_PATH").unwrap_or_else(|_| "../config.json".to_string());
    let config = Config::load(&config_path)?;

    tracing::info!("Connecting to database...");
    let db = db::init_db(&config.database.url).await?;
    tracing::info!("Database connected and migrations applied");

    // Create app
    let app = app::create_app(db, config.clone());

    // Start server
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

