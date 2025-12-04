use crate::config::Config;
use crate::errors::AppError;
use crate::models::{CreateQuestionnaireRequest, QuestionnaireDetailResponse, QuestionnaireResponse, QuestionnaireTokenData, SubmitQuestionnaireRequest, UpdateQuestionnaireRequest};
use crate::services::QuestionnaireService;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use sea_orm::{DatabaseConnection, EntityTrait};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize)]
pub struct QuestionnaireQuery {
    pub session_id: Option<Uuid>,
}

pub async fn get_questionnaire_by_token(
    State(db): State<Arc<DatabaseConnection>>,
    Path(token): Path<Uuid>,
) -> Result<Json<QuestionnaireTokenData>, AppError> {
    let data = QuestionnaireService::get_by_token(db.as_ref(), token).await?;
    Ok(Json(data))
}

pub async fn submit_questionnaire(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<SubmitQuestionnaireRequest>,
) -> Result<Json<QuestionnaireResponse>, AppError> {
    let response = QuestionnaireService::submit(db.as_ref(), payload).await?;
    Ok(Json(response))
}

/// Créer un questionnaire directement (auto-inscription)
pub async fn create_questionnaire(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateQuestionnaireRequest>,
) -> Result<Json<QuestionnaireResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    
    let response = QuestionnaireService::create_direct(db.as_ref(), payload).await?;
    Ok(Json(response))
}

pub async fn list_questionnaires(
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<QuestionnaireQuery>,
) -> Result<Json<Vec<QuestionnaireResponse>>, AppError> {
    let session_id = query
        .session_id
        .ok_or_else(|| AppError::Validation("session_id is required".to_string()))?;

    let responses = QuestionnaireService::list_by_session(db.as_ref(), session_id).await?;
    Ok(Json(responses))
}

pub async fn list_questionnaires_detail(
    State((db, config)): State<(Arc<DatabaseConnection>, Arc<Config>)>,
    Query(query): Query<QuestionnaireQuery>,
) -> Result<Json<Vec<QuestionnaireDetailResponse>>, AppError> {
    let session_id = query
        .session_id
        .ok_or_else(|| AppError::Validation("session_id is required".to_string()))?;

    let responses = QuestionnaireService::list_with_details(
        db.as_ref(),
        session_id,
        &config.magic_link.base_url,
    ).await?;
    Ok(Json(responses))
}

pub async fn update_questionnaire(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateQuestionnaireRequest>,
) -> Result<Json<QuestionnaireResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = QuestionnaireService::update(db.as_ref(), id, payload).await?;
    Ok(Json(response))
}

pub async fn delete_questionnaire(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    use crate::entities::prelude::*;
    use sea_orm::ActiveModelTrait;
    
    // Find the questionnaire
    let questionnaire = Questionnaires::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string())))?
        .ok_or(AppError::NotFound("Questionnaire not found".to_string()))?;
    
    // Delete the questionnaire - convert to ActiveModel first
    let active_model: crate::entities::questionnaires::ActiveModel = questionnaire.into();
    active_model
        .delete(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to delete questionnaire".to_string())))?;
    
    Ok(Json(serde_json::json!({
        "message": "Questionnaire supprimé avec succès"
    })))
}

