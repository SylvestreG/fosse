use crate::entities::{prelude::*, people, questionnaires, sessions};
use crate::errors::AppError;
use crate::middleware::acl::AuthUser;
use crate::models::{CreateSessionRequest, SessionResponse, SessionSummary, StabSize, ParticipantInfo, UpdateSessionRequest, Permission};
use axum::{
    extract::{Path, State},
    Extension,
    Json,
};
use chrono::Utc;
use sea_orm::*;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

fn session_to_response(session: &sessions::Model) -> SessionResponse {
    SessionResponse {
        id: session.id,
        name: session.name.clone(),
        start_date: session.start_date,
        end_date: session.end_date,
        location: session.location.clone(),
        description: session.description.clone(),
        summary_token: session.summary_token,
        optimization_mode: session.optimization_mode,
        sortie_id: session.sortie_id,
        dive_number: session.dive_number,
        created_at: session.created_at.to_string(),
        updated_at: session.updated_at.to_string(),
    }
}

pub async fn create_session(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let now = Utc::now().naive_utc();
    let session = sessions::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(payload.name),
        start_date: Set(payload.start_date),
        end_date: Set(payload.end_date),
        location: Set(payload.location),
        description: Set(payload.description),
        summary_token: Set(Some(Uuid::new_v4())), // Generate unique token for public summary access
        optimization_mode: Set(false),
        sortie_id: Set(None),
        dive_number: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let session = session
        .insert(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to create session".to_string())))?;

    Ok(Json(session_to_response(&session)))
}

pub async fn list_sessions(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<SessionResponse>>, AppError> {
    // Only list standalone sessions (fosse), not dive sessions from sorties
    let sessions = Sessions::find()
        .filter(sessions::Column::SortieId.is_null())
        .order_by_desc(sessions::Column::StartDate)
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sessions".to_string())))?;

    let responses: Vec<SessionResponse> = sessions
        .iter()
        .map(session_to_response)
        .collect();

    Ok(Json(responses))
}

/// Récupère les détails d'une session
/// Accessible aux admins ET aux participants inscrits à la session
pub async fn get_session(
    State(db): State<Arc<DatabaseConnection>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<SessionResponse>, AppError> {
    let session = Sessions::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
        .ok_or(AppError::NotFound("Session not found".to_string()))?;

    // Vérifier les permissions d'accès:
    // - Admin ou a la permission SessionsView -> accès
    // - Sinon, doit être inscrit à cette session
    let has_admin_access = auth.has_permission(Permission::SessionsView);
    
    if !has_admin_access {
        // Récupérer l'email de l'utilisateur (impersonnifié ou réel)
        let user_email = auth.claims.impersonating
            .as_ref()
            .map(|i| i.user_email.as_str())
            .unwrap_or(&auth.claims.email);
        
        // Vérifier si l'utilisateur est inscrit à cette session
        let person = People::find()
            .filter(people::Column::Email.eq(user_email))
            .one(db.as_ref())
            .await?;
        
        let is_registered = if let Some(person) = person {
            // Vérifier s'il a un questionnaire pour cette session
            Questionnaires::find()
                .filter(questionnaires::Column::SessionId.eq(id))
                .filter(questionnaires::Column::PersonId.eq(person.id))
                .one(db.as_ref())
                .await?
                .is_some()
        } else {
            false
        };
        
        if !is_registered {
            return Err(AppError::Forbidden(
                "Vous devez être inscrit à cette session pour voir ses détails".to_string()
            ));
        }
    }

    Ok(Json(session_to_response(&session)))
}

pub async fn update_session(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSessionRequest>,
) -> Result<Json<SessionResponse>, AppError> {
    let session = Sessions::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
        .ok_or(AppError::NotFound("Session not found".to_string()))?;

    let now = Utc::now().naive_utc();
    let mut active: sessions::ActiveModel = session.into();
    
    if let Some(optimization_mode) = payload.optimization_mode {
        active.optimization_mode = Set(optimization_mode);
    }
    active.updated_at = Set(now);

    let updated = active
        .update(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to update session: {}", e))))?;

    Ok(Json(session_to_response(&updated)))
}

pub async fn delete_session(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let session = Sessions::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
        .ok_or(AppError::NotFound("Session not found".to_string()))?;

    // Delete session (CASCADE will delete related questionnaires, email_jobs, import_jobs)
    let _result = session
        .delete(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to delete session: {}", e))))?;

    Ok(Json(serde_json::json!({
        "message": "Session supprimée avec succès"
    })))
}

pub async fn get_session_summary(
    State((db, config)): State<(Arc<DatabaseConnection>, Arc<crate::config::Config>)>,
    Path(id): Path<Uuid>,
) -> Result<Json<SessionSummary>, AppError> {
    use crate::entities::{email_jobs, people};
    use crate::models::DiverLevel;
    
    // Verify session exists and get optimization_mode
    let session = Sessions::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
        .ok_or(AppError::NotFound("Session not found".to_string()))?;

    let questionnaires_list = Questionnaires::find()
        .filter(questionnaires::Column::SessionId.eq(id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaires".to_string())))?;
    
    // Get email jobs to retrieve magic links
    let email_jobs_list = email_jobs::Entity::find()
        .filter(email_jobs::Column::SessionId.eq(id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email jobs".to_string())))?;
    
    // Get all persons for this session
    let person_ids: Vec<Uuid> = questionnaires_list.iter().map(|q| q.person_id).collect();
    let persons_list = people::Entity::find()
        .filter(people::Column::Id.is_in(person_ids))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query persons".to_string())))?;

    let total_questionnaires = questionnaires_list.len() as i64;
    let submitted_count = questionnaires_list.iter().filter(|q| q.submitted_at.is_some()).count() as i64;
    let encadrants_count = questionnaires_list.iter().filter(|q| q.is_encadrant).count() as i64;
    let students_count = total_questionnaires - encadrants_count;
    let from_issoire_count = questionnaires_list.iter().filter(|q| q.comes_from_issoire).count() as i64;
    let nitrox_count = questionnaires_list.iter().filter(|q| q.wants_nitrox).count() as i64;
    let nitrox_training_count = questionnaires_list.iter().filter(|q| q.nitrox_training).count() as i64;
    let second_reg_count = questionnaires_list.iter().filter(|q| q.wants_2nd_reg).count() as i64;
    let stab_count = questionnaires_list.iter().filter(|q| q.wants_stab).count() as i64;
    let vehicles_count = questionnaires_list.iter().filter(|q| q.has_car).count() as i64;
    let total_car_seats = questionnaires_list.iter().filter_map(|q| q.car_seats).sum::<i32>() as i64;
    
    // Bouteilles: 1 par personne + 1 pour le bloc de secours
    let total_bottles = total_questionnaires + 1;
    // Nitrox bottles: encadrants qui veulent nitrox + élèves en formation nitrox
    let nitrox_bottles = questionnaires_list.iter().filter(|q| q.wants_nitrox || q.nitrox_training).count() as i64;
    let air_bottles = total_bottles - nitrox_bottles; // Le bloc de secours est en Air
    
    // Détendeurs: compter ceux qui en veulent + 1 pour le bloc de secours
    let regulators_count = questionnaires_list.iter().filter(|q| q.wants_regulator).count() as i64 + 1;

    // Count stab sizes + 1 pour le bloc de secours (taille "Secours")
    let mut stab_sizes_map = std::collections::HashMap::new();
    for q in &questionnaires_list {
        if q.wants_stab {
            if let Some(size) = &q.stab_size {
                *stab_sizes_map.entry(size.clone()).or_insert(0) += 1;
            }
        }
    }
    // Ajouter le bloc de secours
    *stab_sizes_map.entry("Secours".to_string()).or_insert(0) += 1;

    let stab_sizes: Vec<StabSize> = stab_sizes_map
        .into_iter()
        .map(|(size, count)| StabSize { size, count })
        .collect();

    // Build participants list with magic links
    let mut participants = Vec::new();
    for q in &questionnaires_list {
        // Find the person info
        let person = persons_list.iter().find(|p| p.id == q.person_id);
        
        if let Some(person) = person {
            // Find the magic link from email_jobs using questionnaire_token
            let magic_link = email_jobs_list
                .iter()
                .find(|e| e.person_id == q.person_id)
                .map(|e| format!("{}/q/{}", config.magic_link.base_url, e.questionnaire_token))
                .unwrap_or_default();

            // Extract diving level display and preparing level
            let diving_level_display = person.diving_level.as_ref()
                .and_then(|s| DiverLevel::from_string(s))
                .map(|dl| dl.display())
                .filter(|s| s != "Aucun niveau");
            let preparing_level = person.diving_level.as_ref()
                .and_then(|s| DiverLevel::extract_preparing_level(s));

            participants.push(ParticipantInfo {
                first_name: person.first_name.clone(),
                last_name: person.last_name.clone(),
                email: person.email.clone(),
                magic_link,
                submitted: q.submitted_at.is_some(),
                is_encadrant: q.is_encadrant,
                nitrox_training: q.nitrox_training,
                comes_from_issoire: q.comes_from_issoire,
                has_car: q.has_car,
                car_seats: q.car_seats,
                diving_level: diving_level_display,
                preparing_level,
            });
        }
    }

    Ok(Json(SessionSummary {
        total_questionnaires,
        submitted_count,
        encadrants_count,
        students_count,
        from_issoire_count,
        total_bottles, // Inclut +1 pour le bloc de secours
        nitrox_bottles,
        air_bottles, // Inclut +1 pour le bloc de secours (Air)
        regulators_count, // Inclut +1 pour le bloc de secours
        nitrox_count,
        nitrox_training_count,
        second_reg_count,
        stab_count: stab_count + 1, // +1 pour le bloc de secours
        stab_sizes, // Inclut "Secours"
        vehicles_count,
        total_car_seats,
        participants,
        optimization_mode: session.optimization_mode,
    }))
}

pub async fn get_session_summary_by_token(
    State((db, config)): State<(Arc<DatabaseConnection>, Arc<crate::config::Config>)>,
    Path(token): Path<Uuid>,
) -> Result<Json<SessionSummary>, AppError> {
    use chrono::{Duration, Utc};
    
    // Find session by summary_token
    let session = Sessions::find()
        .filter(sessions::Column::SummaryToken.eq(token))
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
        .ok_or(AppError::NotFound("Session summary link not found or expired".to_string()))?;

    // Check if link has expired (session end date + 1 day)
    let session_reference_date = session.end_date.unwrap_or(session.start_date);
    let expiration_date = session_reference_date.and_hms_opt(23, 59, 59).unwrap() + Duration::days(1);
    let now = Utc::now().naive_utc();
    
    if now > expiration_date {
        return Err(AppError::NotFound("Ce lien de récapitulatif a expiré".to_string()));
    }

    // Reuse the existing get_session_summary logic by calling it with session ID
    get_session_summary(State((db, config)), Path(session.id)).await
}
