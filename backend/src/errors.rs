use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sea_orm::DbErr),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("External service error: {0}")]
    ExternalService(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Token expired or invalid")]
    InvalidToken,

    #[error("Token already consumed")]
    TokenConsumed,

    #[allow(dead_code)]
    #[error("Email sending failed: {0}")]
    EmailError(String),

    #[allow(dead_code)]
    #[error("CSV parsing error: {0}")]
    CsvError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Database(ref e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error occurred")
            }
            AppError::NotFound(ref msg) => (StatusCode::NOT_FOUND, msg.as_str()),
            AppError::Unauthorized(ref msg) => (StatusCode::UNAUTHORIZED, msg.as_str()),
            AppError::Forbidden(ref msg) => (StatusCode::FORBIDDEN, msg.as_str()),
            AppError::Validation(ref msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
            AppError::ExternalService(ref msg) => {
                tracing::error!("External service error: {}", msg);
                (StatusCode::BAD_GATEWAY, "External service error")
            }
            AppError::Internal(ref msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
            AppError::InvalidToken => (StatusCode::UNAUTHORIZED, "Token expired or invalid"),
            AppError::TokenConsumed => (StatusCode::GONE, "Token already consumed"),
            AppError::EmailError(ref msg) => {
                tracing::error!("Email error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Email sending failed")
            }
            AppError::CsvError(ref msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
        };

        let body = Json(json!({
            "error": error_message,
            "details": self.to_string(),
        }));

        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

