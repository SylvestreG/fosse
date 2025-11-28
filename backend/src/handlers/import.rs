use crate::errors::AppError;
use crate::models::ImportJobResponse;
use crate::services::{EmailService, ImportService};
use axum::{
    extract::{Multipart, Path, State},
    Json,
};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ImportState {
    pub db: Arc<DatabaseConnection>,
    pub email_service: Arc<EmailService>,
    pub expiration_hours: i64,
}

pub async fn import_csv(
    State(state): State<Arc<ImportState>>,
    mut multipart: Multipart,
) -> Result<Json<ImportJobResponse>, AppError> {
    let mut session_id: Option<Uuid> = None;
    let mut filename: Option<String> = None;
    let mut csv_content: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(format!("Failed to read multipart: {}", e)))?
    {
        let field_name = field.name().unwrap_or("").to_string();

        match field_name.as_str() {
            "session_id" => {
                let value = field
                    .text()
                    .await
                    .map_err(|e| AppError::Validation(format!("Invalid session_id: {}", e)))?;
                session_id = Some(
                    Uuid::parse_str(&value)
                        .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?,
                );
            }
            "file" => {
                filename = Some(
                    field
                        .file_name()
                        .unwrap_or("upload.csv")
                        .to_string(),
                );
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::Validation(format!("Failed to read file: {}", e)))?;
                csv_content = Some(
                    String::from_utf8(data.to_vec())
                        .map_err(|e| AppError::Validation(format!("Invalid UTF-8: {}", e)))?,
                );
            }
            _ => {}
        }
    }

    let session_id = session_id.ok_or_else(|| AppError::Validation("session_id required".to_string()))?;
    let filename = filename.ok_or_else(|| AppError::Validation("file required".to_string()))?;
    let csv_content = csv_content.ok_or_else(|| AppError::Validation("file content required".to_string()))?;

    let import_job_id = ImportService::import_csv(
        state.db.as_ref(),
        state.email_service.as_ref(),
        session_id,
        filename,
        &csv_content,
        state.expiration_hours,
    )
    .await?;

    let import_job = ImportService::get_import_job(state.db.as_ref(), import_job_id).await?;
    Ok(Json(import_job))
}

pub async fn get_import_job(
    State(state): State<Arc<ImportState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ImportJobResponse>, AppError> {
    let import_job = ImportService::get_import_job(state.db.as_ref(), id).await?;
    Ok(Json(import_job))
}

