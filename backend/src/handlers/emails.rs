use crate::errors::AppError;
use crate::models::EmailToSend;
use crate::services::EmailService;
use axum::{
    extract::{Path, State},
    Json,
};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use uuid::Uuid;

pub async fn get_pending_emails(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<EmailToSend>>, AppError> {
    let emails = EmailService::get_pending_emails(db.as_ref()).await?;
    Ok(Json(emails))
}

pub async fn get_emails_by_session(
    State(db): State<Arc<DatabaseConnection>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Vec<EmailToSend>>, AppError> {
    let emails = EmailService::get_emails_by_session(db.as_ref(), session_id).await?;
    Ok(Json(emails))
}

pub async fn mark_email_sent(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    EmailService::mark_as_sent(db.as_ref(), id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

