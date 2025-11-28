use crate::config::Config;
use crate::handlers::import::ImportState;
use crate::handlers::*;
use crate::middleware::auth::admin_auth_middleware;
use crate::services::{AuthService, EmailService};
use axum::{
    middleware,
    routing::{get, post},
    Router,
    response::IntoResponse,
    http::StatusCode,
};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use std::path::PathBuf;

pub fn create_app(db: DatabaseConnection, config: Config) -> Router {
    let db = Arc::new(db);

    // Create services
    let auth_service = Arc::new(AuthService::new(
        config.google_oauth.clone(),
        config.jwt.clone(),
        config.admin.emails.clone(),
    ));

    let email_service = Arc::new(EmailService::new(
        config.magic_link.base_url.clone(),
    ));

    let import_state = Arc::new(ImportState {
        db: db.clone(),
        email_service: email_service.clone(),
        expiration_hours: config.magic_link.expiration_hours,
    });

    let config_arc = Arc::new(config);

    // Public routes - auth
    let auth_routes = Router::new()
        .route("/api/v1/auth/config", get(get_oauth_config))
        .route("/api/v1/auth/google/callback", post(google_callback))
        .with_state(auth_service.clone());
    
    // Public routes - questionnaires
    let questionnaire_public_routes = Router::new()
        .route(
            "/api/v1/questionnaires/by-token/:token",
            get(get_questionnaire_by_token),
        )
        .route("/api/v1/questionnaires", post(submit_questionnaire))
        .with_state(db.clone());

    // Admin-only routes for sessions and questionnaires
    let admin_routes = Router::new()
        .route("/api/v1/sessions", post(create_session).get(list_sessions))
        .route("/api/v1/sessions/:id", get(get_session).delete(delete_session))
        .route("/api/v1/questionnaires", get(list_questionnaires))
        .route("/api/v1/questionnaires/:id", axum::routing::put(update_questionnaire).delete(delete_questionnaire))
        .route("/api/v1/emails/pending", get(get_pending_emails))
        .route("/api/v1/emails/session/:id", get(get_emails_by_session))
        .route("/api/v1/emails/:id/sent", post(mark_email_sent))
        .route("/api/v1/people", post(create_person).get(list_people))
        .route("/api/v1/people/:id", get(get_person).put(update_person).delete(delete_person))
        .layer(middleware::from_fn_with_state(
            auth_service.clone(),
            admin_auth_middleware,
        ))
        .with_state(db.clone());
    
    // Admin routes that need both db and config
    let admin_detail_routes = Router::new()
        .route("/api/v1/questionnaires-detail", get(list_questionnaires_detail))
        .route("/api/v1/sessions/:id/summary", get(get_session_summary))
        .layer(middleware::from_fn_with_state(
            auth_service.clone(),
            admin_auth_middleware,
        ))
        .with_state((db.clone(), config_arc));
    
    // Admin-only routes for import (different state)
    let import_routes = Router::new()
        .route("/api/v1/import", post(import_csv))
        .route("/api/v1/import/:id", get(get_import_job))
        .layer(middleware::from_fn_with_state(
            auth_service.clone(),
            admin_auth_middleware,
        ))
        .with_state(import_state);

    // Admin-only routes for email service (different state)
    let email_service_routes = Router::new()
        .route("/api/v1/sessions/:id/generate-links", post(generate_magic_links))
        .layer(middleware::from_fn_with_state(
            auth_service.clone(),
            admin_auth_middleware,
        ))
        .with_state((db.clone(), email_service));

    // API routes
    let api_routes = Router::new()
        .merge(auth_routes)
        .merge(questionnaire_public_routes)
        .merge(admin_routes)
        .merge(admin_detail_routes)
        .merge(import_routes)
        .merge(email_service_routes);

    // Check if static files directory exists
    let static_dir = PathBuf::from("../frontend/dist");
    
    if static_dir.exists() {
        // Serve static files
        Router::new()
            .merge(api_routes)
            .nest_service("/assets", ServeDir::new(static_dir.join("assets")))
            .fallback(spa_handler)
            .layer(CorsLayer::permissive())
    } else {
        // Development mode - just API routes with CORS
        tracing::warn!("Static files directory not found at {:?}, running in API-only mode", static_dir);
        api_routes.layer(CorsLayer::permissive())
    }
}

// SPA fallback handler - serves index.html for all non-API, non-asset routes
async fn spa_handler() -> impl IntoResponse {
    let index_path = PathBuf::from("../frontend/dist/index.html");
    match tokio::fs::read_to_string(&index_path).await {
        Ok(content) => (
            StatusCode::OK,
            [("content-type", "text/html; charset=utf-8")],
            content,
        )
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
    }
}


