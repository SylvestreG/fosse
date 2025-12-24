use crate::config::Config;
use crate::handlers::import::ImportState;
use crate::handlers::auth::{AuthState, PasswordAuthState};
use crate::handlers::*;
use crate::middleware::acl::{acl_auth_middleware, AclState};
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
        config.smtp.clone(),
    ));

    let import_state = Arc::new(ImportState {
        db: db.clone(),
        email_service: email_service.clone(),
        expiration_hours: config.magic_link.expiration_hours,
    });

    let config_arc = Arc::new(config);

    // ACL state for middleware
    let acl_state = AclState {
        auth_service: auth_service.clone(),
        db: db.clone(),
    };

    // Auth state for login routes that need DB access
    let auth_state = AuthState {
        auth_service: auth_service.clone(),
        db: db.clone(),
    };

    // Public routes - auth config
    let auth_config_route = Router::new()
        .route("/api/v1/auth/config", get(get_oauth_config))
        .with_state(auth_service.clone());

    // Auth callback (needs DB to check if user exists)
    // Supporte 2 méthodes:
    // - /callback : OAuth redirect flow classique (échange code contre token)
    // - /id-token : Google One Tap / Identity Services (ID token direct)
    let auth_callback_route = Router::new()
        .route("/api/v1/auth/google/callback", post(google_callback))
        .route("/api/v1/auth/google/id-token", post(google_id_token_callback))
        .with_state(auth_state.clone());

    // Password authentication state
    let password_auth_state = PasswordAuthState {
        auth_service: auth_service.clone(),
        email_service: email_service.clone(),
        db: db.clone(),
    };

    // Public routes - email/password authentication
    let password_auth_routes = Router::new()
        .route("/api/v1/auth/request-password", post(request_temp_password))
        .route("/api/v1/auth/login", post(email_login))
        .with_state(password_auth_state.clone());

    // Protected route for changing password
    let change_password_route = Router::new()
        .route("/api/v1/auth/change-password", post(change_password))
        .layer(middleware::from_fn_with_state(
            acl_state.clone(),
            acl_auth_middleware,
        ))
        .with_state(password_auth_state);

    // Impersonation routes (admin only, need auth + DB)
    let impersonation_routes = Router::new()
        .route("/api/v1/auth/impersonate", post(impersonate_user))
        .route("/api/v1/auth/stop-impersonation", post(stop_impersonation))
        .layer(middleware::from_fn_with_state(
            acl_state.clone(),
            acl_auth_middleware,
        ))
        .with_state(auth_state);
    
    // Public routes - questionnaires (submit via magic link token)
    let questionnaire_public_routes = Router::new()
        .route(
            "/api/v1/questionnaires/by-token/:token",
            get(get_questionnaire_by_token),
        )
        .route("/api/v1/questionnaires/submit", post(submit_questionnaire))
        .with_state(db.clone());

    // Authenticated routes - questionnaires (self-registration)
    let questionnaire_auth_routes = Router::new()
        .route("/api/v1/questionnaires/register", post(create_questionnaire))
        .layer(middleware::from_fn_with_state(
            acl_state.clone(),
            acl_auth_middleware,
        ))
        .with_state(db.clone());

    // Public routes - session summary by token
    let summary_public_routes = Router::new()
        .route("/api/v1/sessions/summary/:token", get(get_session_summary_by_token))
        .with_state((db.clone(), config_arc.clone()));

    // Admin-only routes for sessions and questionnaires
    // Uses ACL middleware which injects AuthUser with permissions
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
        // Legacy flat competencies (backward compatibility)
        .route("/api/v1/competencies", post(create_competency).get(list_competencies))
        .route("/api/v1/competencies/by-level", get(list_competencies_by_level))
        .route("/api/v1/competencies/:id", get(get_competency).put(update_competency).delete(delete_competency))
        // New hierarchical competency system
        // Validation stages (étapes de progression)
        .route("/api/v1/validation-stages", get(list_validation_stages).post(create_validation_stage))
        .route("/api/v1/validation-stages/:id", axum::routing::put(update_validation_stage).delete(delete_validation_stage))
        // Competency domains (COMMUNES, PE40, PA20, etc.)
        .route("/api/v1/competency-domains", get(list_competency_domains).post(create_competency_domain))
        .route("/api/v1/competency-domains/:id", axum::routing::put(update_competency_domain).delete(delete_competency_domain))
        // Competency modules (groupes dans un domaine)
        .route("/api/v1/competency-modules", get(list_competency_modules).post(create_competency_module))
        .route("/api/v1/competency-modules/:id", axum::routing::put(update_competency_module).delete(delete_competency_module))
        // Competency skills (acquis individuels)
        .route("/api/v1/competency-skills", get(list_competency_skills).post(create_competency_skill))
        .route("/api/v1/competency-skills/:id", axum::routing::put(update_competency_skill).delete(delete_competency_skill))
        // Skill validations (progression des élèves)
        .route("/api/v1/skill-validations", get(list_skill_validations).post(create_skill_validation))
        .route("/api/v1/skill-validations/:id", axum::routing::put(update_skill_validation).delete(delete_skill_validation))
        // Hierarchy views
        .route("/api/v1/my-competencies", get(get_my_competencies))
        .route("/api/v1/person-competencies/:person_id", get(get_person_competencies))
        // Groups and permissions management
        .route("/api/v1/permissions", get(list_permissions))
        .route("/api/v1/groups", get(list_groups))
        .route("/api/v1/groups/:id", get(get_group).put(update_group_permissions))
        .layer(middleware::from_fn_with_state(
            acl_state.clone(),
            acl_auth_middleware,
        ))
        .with_state(db.clone());
    
    // Admin routes that need both db and config
    let admin_detail_routes = Router::new()
        .route("/api/v1/questionnaires-detail", get(list_questionnaires_detail))
        .route("/api/v1/sessions/:id/summary", get(get_session_summary))
        .layer(middleware::from_fn_with_state(
            acl_state.clone(),
            acl_auth_middleware,
        ))
        .with_state((db.clone(), config_arc));
    
    // Admin-only routes for import (different state)
    let import_routes = Router::new()
        .route("/api/v1/import", post(import_csv))
        .route("/api/v1/import/:id", get(get_import_job))
        .layer(middleware::from_fn_with_state(
            acl_state.clone(),
            acl_auth_middleware,
        ))
        .with_state(import_state);

    // Admin-only routes for email service (different state)
    let email_service_routes = Router::new()
        .route("/api/v1/sessions/:id/generate-links", post(generate_magic_links))
        .layer(middleware::from_fn_with_state(
            acl_state,
            acl_auth_middleware,
        ))
        .with_state((db.clone(), email_service));

    // API routes
    let api_routes = Router::new()
        .merge(auth_config_route)
        .merge(auth_callback_route)
        .merge(password_auth_routes)
        .merge(change_password_route)
        .merge(impersonation_routes)
        .merge(questionnaire_public_routes)
        .merge(questionnaire_auth_routes)
        .merge(summary_public_routes)
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
