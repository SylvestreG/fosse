use crate::config::Config;
use crate::entities::prelude::*;
use crate::errors::AppError;
use crate::middleware::acl::AuthUser;
use crate::models::{
    CreateQuestionnaireRequest, QuestionnaireDetailResponse, QuestionnaireResponse, QuestionnaireTokenData,
    SetAllowDualRotationRequest, SubmitQuestionnaireRequest, UpdateQuestionnaireRequest, SetDirecteurPlongeeRequest,
};
use crate::services::QuestionnaireService;
use crate::sortie_access::{
    auth_effective_email, ensure_can_manage_fosse_session_participants,
    ensure_questionnaire_mutation_access, ensure_sortie_director_tool_access,
};
use axum::{
    extract::{Extension, Path, Query, State},
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
    Extension(auth): Extension<AuthUser>,
    Json(payload): Json<CreateQuestionnaireRequest>,
) -> Result<Json<QuestionnaireResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    if let Some(sid) = payload.sortie_id {
        let me = auth_effective_email(&auth);
        let is_self = payload.email.trim().eq_ignore_ascii_case(me.trim());
        if !is_self {
            ensure_sortie_director_tool_access(db.as_ref(), &auth, sid).await?;
        }
    } else if let Some(session_id) = payload.session_id {
        let me = auth_effective_email(&auth);
        let is_self = payload.email.trim().eq_ignore_ascii_case(me.trim());
        if !is_self {
            ensure_can_manage_fosse_session_participants(db.as_ref(), &auth, session_id).await?;
        }
    }

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

/// Fosse Coubertin : autoriser un élève à être placé sur deux rotations dans la même soirée.
pub async fn set_allow_dual_rotation(
    State(db): State<Arc<DatabaseConnection>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetAllowDualRotationRequest>,
) -> Result<Json<QuestionnaireResponse>, AppError> {
    let questionnaire = Questionnaires::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string()))
        })?
        .ok_or_else(|| AppError::NotFound("Questionnaire not found".to_string()))?;

    ensure_questionnaire_mutation_access(db.as_ref(), &auth, &questionnaire).await?;

    let response =
        QuestionnaireService::set_allow_dual_rotation(db.as_ref(), id, payload.allow_dual_rotation).await?;
    Ok(Json(response))
}

pub async fn update_questionnaire(
    State(db): State<Arc<DatabaseConnection>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateQuestionnaireRequest>,
) -> Result<Json<QuestionnaireResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let questionnaire = Questionnaires::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string()))
        })?
        .ok_or_else(|| AppError::NotFound("Questionnaire not found".to_string()))?;

    ensure_questionnaire_mutation_access(db.as_ref(), &auth, &questionnaire).await?;

    let response = QuestionnaireService::update(db.as_ref(), id, payload).await?;
    Ok(Json(response))
}

pub async fn delete_questionnaire(
    State(db): State<Arc<DatabaseConnection>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    use sea_orm::ActiveModelTrait;

    let questionnaire = Questionnaires::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string())))?
        .ok_or(AppError::NotFound("Questionnaire not found".to_string()))?;

    ensure_questionnaire_mutation_access(db.as_ref(), &auth, &questionnaire).await?;

    let active_model: crate::entities::questionnaires::ActiveModel = questionnaire.into();
    active_model
        .delete(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to delete questionnaire".to_string())))?;
    
    Ok(Json(serde_json::json!({
        "message": "Questionnaire supprimé avec succès"
    })))
}

/// Définir le directeur de plongée pour une session
pub async fn set_directeur_plongee(
    State(db): State<Arc<DatabaseConnection>>,
    Extension(auth): Extension<AuthUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<SetDirecteurPlongeeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let session = Sessions::find_by_id(session_id)
        .one(db.as_ref())
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string()))
        })?
        .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    if let Some(sid) = session.sortie_id {
        ensure_sortie_director_tool_access(db.as_ref(), &auth, sid).await?;
    } else {
        ensure_can_manage_fosse_session_participants(db.as_ref(), &auth, session_id).await?;
    }

    QuestionnaireService::set_directeur_plongee(db.as_ref(), session_id, payload.questionnaire_id).await?;
    Ok(Json(serde_json::json!({
        "message": "Directeur de plongée mis à jour"
    })))
}

