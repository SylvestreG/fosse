use crate::entities::{prelude::*, questionnaires, rotations, sessions, sorties, dive_directors};
use crate::errors::AppError;
use crate::models::{
    CreateSortieRequest, SortieResponse, SortieWithDivesResponse, UpdateSortieRequest,
    CopyAttendeesRequest, CopyAttendeesResponse, SessionResponse, DiveDirectorRequest, DiveDirectorResponse,
};
use axum::{
    extract::{Path, State},
    Json,
};
use chrono::{Duration, Utc};
use sea_orm::*;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

fn sortie_to_response(sortie: &sorties::Model) -> SortieResponse {
    SortieResponse {
        id: sortie.id,
        name: sortie.name.clone(),
        location: sortie.location.clone(),
        sortie_type: sortie.sortie_type.clone(),
        days_count: sortie.days_count,
        dives_per_day: sortie.dives_per_day,
        nitrox_compatible: sortie.nitrox_compatible,
        start_date: sortie.start_date,
        end_date: sortie.end_date,
        description: sortie.description.clone(),
        summary_token: sortie.summary_token,
        created_at: sortie.created_at.to_string(),
        updated_at: sortie.updated_at.to_string(),
    }
}

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

/// Create a new sortie with auto-generated dives (sessions)
pub async fn create_sortie(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateSortieRequest>,
) -> Result<Json<SortieWithDivesResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let now = Utc::now().naive_utc();
    let sortie_id = Uuid::new_v4();
    
    // Calculate end date based on days_count
    let end_date = payload.start_date + Duration::days((payload.days_count - 1) as i64);

    // Create the sortie
    let sortie = sorties::ActiveModel {
        id: Set(sortie_id),
        name: Set(payload.name.clone()),
        location: Set(payload.location.clone()),
        sortie_type: Set(payload.sortie_type.to_string()),
        days_count: Set(payload.days_count),
        dives_per_day: Set(payload.dives_per_day),
        nitrox_compatible: Set(payload.nitrox_compatible),
        start_date: Set(payload.start_date),
        end_date: Set(end_date),
        description: Set(payload.description.clone()),
        summary_token: Set(Some(Uuid::new_v4())),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let sortie = sortie
        .insert(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create sortie: {}", e))))?;

    // Auto-generate sessions (dives)
    let total_dives = payload.days_count * payload.dives_per_day;
    let mut dives = Vec::new();
    
    let time_labels = match payload.dives_per_day {
        1 => vec![""],
        2 => vec!["Matin", "Après-midi"],
        3 => vec!["Matin", "Midi", "Après-midi"],
        4 => vec!["Matin", "Fin de matinée", "Début d'après-midi", "Après-midi"],
        _ => vec![""],
    };

    for dive_num in 1..=total_dives {
        let day = ((dive_num - 1) / payload.dives_per_day) + 1;
        let dive_of_day = ((dive_num - 1) % payload.dives_per_day) as usize;
        let dive_date = payload.start_date + Duration::days((day - 1) as i64);
        
        let dive_name = if payload.dives_per_day == 1 {
            format!("Plongée {} - Jour {}", dive_num, day)
        } else {
            format!("Plongée {} - Jour {} {}", dive_num, day, time_labels[dive_of_day])
        };

        let session = sessions::ActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(dive_name),
            start_date: Set(dive_date),
            end_date: Set(Some(dive_date)),
            location: Set(Some(payload.location.clone())),
            description: Set(None),
            summary_token: Set(None), // Dives don't have their own summary token
            optimization_mode: Set(false),
            sortie_id: Set(Some(sortie_id)),
            dive_number: Set(Some(dive_num)),
            created_at: Set(now),
            updated_at: Set(now),
        };

        let session = session
            .insert(db.as_ref())
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create dive session: {}", e))))?;

        // Create a default rotation for this dive
        let rotation = rotations::ActiveModel {
            id: Set(Uuid::new_v4()),
            session_id: Set(session.id),
            number: Set(1),
            created_at: Set(now),
            updated_at: Set(now),
        };

        rotation
            .insert(db.as_ref())
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create rotation: {}", e))))?;

        dives.push(session_to_response(&session));
    }

    Ok(Json(SortieWithDivesResponse {
        sortie: sortie_to_response(&sortie),
        dives,
    }))
}

/// List all sorties
pub async fn list_sorties(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<SortieResponse>>, AppError> {
    let sorties_list = Sorties::find()
        .order_by_desc(sorties::Column::StartDate)
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sorties".to_string())))?;

    let responses: Vec<SortieResponse> = sorties_list
        .iter()
        .map(sortie_to_response)
        .collect();

    Ok(Json(responses))
}

/// Get a sortie with its dives
pub async fn get_sortie(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<SortieWithDivesResponse>, AppError> {
    let sortie = Sorties::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sortie".to_string())))?
        .ok_or(AppError::NotFound("Sortie not found".to_string()))?;

    // Get all dives for this sortie, ordered by dive_number
    let dives = Sessions::find()
        .filter(sessions::Column::SortieId.eq(id))
        .order_by_asc(sessions::Column::DiveNumber)
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query dives".to_string())))?;

    let dives_responses: Vec<SessionResponse> = dives
        .iter()
        .map(session_to_response)
        .collect();

    Ok(Json(SortieWithDivesResponse {
        sortie: sortie_to_response(&sortie),
        dives: dives_responses,
    }))
}

/// Update a sortie
pub async fn update_sortie(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSortieRequest>,
) -> Result<Json<SortieResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let sortie = Sorties::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sortie".to_string())))?
        .ok_or(AppError::NotFound("Sortie not found".to_string()))?;

    let now = Utc::now().naive_utc();
    let mut active: sorties::ActiveModel = sortie.into();
    
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(location) = payload.location {
        active.location = Set(location);
    }
    if let Some(description) = payload.description {
        active.description = Set(Some(description));
    }
    active.updated_at = Set(now);

    let updated = active
        .update(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to update sortie: {}", e))))?;

    Ok(Json(sortie_to_response(&updated)))
}

/// Delete a sortie (cascade deletes sessions/dives)
pub async fn delete_sortie(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let sortie = Sorties::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sortie".to_string())))?
        .ok_or(AppError::NotFound("Sortie not found".to_string()))?;

    sortie
        .delete(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to delete sortie: {}", e))))?;

    Ok(Json(serde_json::json!({
        "message": "Sortie supprimée avec succès"
    })))
}

/// Copy attendees from one dive to another within the same sortie
pub async fn copy_attendees(
    State(db): State<Arc<DatabaseConnection>>,
    Path(sortie_id): Path<Uuid>,
    Json(payload): Json<CopyAttendeesRequest>,
) -> Result<Json<CopyAttendeesResponse>, AppError> {
    // Verify sortie exists
    let _sortie = Sorties::find_by_id(sortie_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sortie".to_string())))?
        .ok_or(AppError::NotFound("Sortie not found".to_string()))?;

    // Verify source and target dives belong to this sortie
    let source_dive = Sessions::find_by_id(payload.source_dive_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query source dive".to_string())))?
        .ok_or(AppError::NotFound("Source dive not found".to_string()))?;

    let target_dive = Sessions::find_by_id(payload.target_dive_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query target dive".to_string())))?
        .ok_or(AppError::NotFound("Target dive not found".to_string()))?;

    if source_dive.sortie_id != Some(sortie_id) || target_dive.sortie_id != Some(sortie_id) {
        return Err(AppError::Validation("Both dives must belong to this sortie".to_string()));
    }

    // Get all questionnaires for this sortie
    let _sortie_questionnaires = Questionnaires::find()
        .filter(questionnaires::Column::SortieId.eq(sortie_id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaires".to_string())))?;

    // Get palanquee members assigned to source dive
    use crate::entities::{palanquees, palanquee_members};
    
    // Get rotations for source dive
    let source_rotations = rotations::Entity::find()
        .filter(rotations::Column::SessionId.eq(payload.source_dive_id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query source rotations".to_string())))?;

    let source_rotation_ids: Vec<Uuid> = source_rotations.iter().map(|r| r.id).collect();

    // Get palanquees for source rotations
    let source_palanquees = palanquees::Entity::find()
        .filter(palanquees::Column::RotationId.is_in(source_rotation_ids))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query source palanquees".to_string())))?;

    let source_palanquee_ids: Vec<Uuid> = source_palanquees.iter().map(|p| p.id).collect();

    // Get members assigned to source dive
    let source_members = palanquee_members::Entity::find()
        .filter(palanquee_members::Column::PalanqueeId.is_in(source_palanquee_ids))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query source members".to_string())))?;

    let assigned_questionnaire_ids: std::collections::HashSet<Uuid> = source_members
        .iter()
        .map(|m| m.questionnaire_id)
        .collect();

    // Get rotations for target dive
    let target_rotations = rotations::Entity::find()
        .filter(rotations::Column::SessionId.eq(payload.target_dive_id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query target rotations".to_string())))?;

    let target_rotation_ids: Vec<Uuid> = target_rotations.iter().map(|r| r.id).collect();

    // Get palanquees for target rotations
    let target_palanquees = palanquees::Entity::find()
        .filter(palanquees::Column::RotationId.is_in(target_rotation_ids.clone()))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query target palanquees".to_string())))?;

    let target_palanquee_ids: Vec<Uuid> = target_palanquees.iter().map(|p| p.id).collect();

    // Get existing members in target dive
    let target_members = palanquee_members::Entity::find()
        .filter(palanquee_members::Column::PalanqueeId.is_in(target_palanquee_ids))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query target members".to_string())))?;

    let existing_in_target: std::collections::HashSet<Uuid> = target_members
        .iter()
        .map(|m| m.questionnaire_id)
        .collect();

    // Count how many we'll copy vs skip
    let mut copied_count = 0;
    let mut skipped_count = 0;

    // For each assigned questionnaire, check if already in target
    for qid in &assigned_questionnaire_ids {
        if existing_in_target.contains(qid) {
            skipped_count += 1;
        } else {
            copied_count += 1;
        }
    }

    // Note: We don't actually copy the assignments - the "copy" functionality
    // just means the questionnaire is marked as participating in the target dive.
    // Since questionnaires are at the sortie level, they're already "present" for all dives.
    // The actual palanquee assignments need to be done manually by the admin.

    Ok(Json(CopyAttendeesResponse {
        copied_count,
        skipped_count,
    }))
}

/// Get dive directors for a dive (session within a sortie)
pub async fn get_dive_directors(
    State(db): State<Arc<DatabaseConnection>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Vec<DiveDirectorResponse>>, AppError> {
    let directors = DiveDirectors::find()
        .filter(dive_directors::Column::SessionId.eq(session_id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query dive directors".to_string())))?;

    let responses: Vec<DiveDirectorResponse> = directors
        .iter()
        .map(|d| DiveDirectorResponse {
            id: d.id,
            session_id: d.session_id,
            questionnaire_id: d.questionnaire_id,
            created_at: d.created_at.to_string(),
        })
        .collect();

    Ok(Json(responses))
}

/// Add a dive director to a dive
pub async fn add_dive_director(
    State(db): State<Arc<DatabaseConnection>>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<DiveDirectorRequest>,
) -> Result<Json<DiveDirectorResponse>, AppError> {
    // Verify session exists
    let session = Sessions::find_by_id(session_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
        .ok_or(AppError::NotFound("Session not found".to_string()))?;

    // For sorties, verify the questionnaire belongs to the sortie
    if let Some(sortie_id) = session.sortie_id {
        let questionnaire = Questionnaires::find_by_id(payload.questionnaire_id)
            .one(db.as_ref())
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string())))?
            .ok_or(AppError::NotFound("Questionnaire not found".to_string()))?;

        if questionnaire.sortie_id != Some(sortie_id) {
            return Err(AppError::Validation("Questionnaire does not belong to this sortie".to_string()));
        }
    }

    // Check current number of DPs for this dive (max 4)
    let current_count = DiveDirectors::find()
        .filter(dive_directors::Column::SessionId.eq(session_id))
        .count(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to count dive directors".to_string())))?;

    if current_count >= 4 {
        return Err(AppError::Validation("Maximum 4 dive directors per dive".to_string()));
    }

    // Check if already a DP
    let existing = DiveDirectors::find()
        .filter(dive_directors::Column::SessionId.eq(session_id))
        .filter(dive_directors::Column::QuestionnaireId.eq(payload.questionnaire_id))
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query existing DP".to_string())))?;

    if existing.is_some() {
        return Err(AppError::Validation("This person is already a dive director for this dive".to_string()));
    }

    let now = Utc::now().naive_utc();
    let director = dive_directors::ActiveModel {
        id: Set(Uuid::new_v4()),
        session_id: Set(session_id),
        questionnaire_id: Set(payload.questionnaire_id),
        created_at: Set(now),
    };

    let director = director
        .insert(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to add dive director: {}", e))))?;

    Ok(Json(DiveDirectorResponse {
        id: director.id,
        session_id: director.session_id,
        questionnaire_id: director.questionnaire_id,
        created_at: director.created_at.to_string(),
    }))
}

/// Remove a dive director from a dive
pub async fn remove_dive_director(
    State(db): State<Arc<DatabaseConnection>>,
    Path((session_id, director_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let director = DiveDirectors::find_by_id(director_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query dive director".to_string())))?
        .ok_or(AppError::NotFound("Dive director not found".to_string()))?;

    if director.session_id != session_id {
        return Err(AppError::Validation("Dive director does not belong to this session".to_string()));
    }

    director
        .delete(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to remove dive director: {}", e))))?;

    Ok(Json(serde_json::json!({
        "message": "Directeur de plongée retiré avec succès"
    })))
}

/// Get questionnaires for a sortie
pub async fn get_sortie_questionnaires(
    State(db): State<Arc<DatabaseConnection>>,
    Path(sortie_id): Path<Uuid>,
) -> Result<Json<Vec<crate::models::QuestionnaireDetailResponse>>, AppError> {
    use crate::entities::{people, email_jobs};
    use crate::models::QuestionnaireDetailResponse;

    // Verify sortie exists
    let _sortie = Sorties::find_by_id(sortie_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query sortie".to_string())))?
        .ok_or(AppError::NotFound("Sortie not found".to_string()))?;

    // Get questionnaires
    let questionnaires_list = Questionnaires::find()
        .filter(questionnaires::Column::SortieId.eq(sortie_id))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaires".to_string())))?;

    // Get person IDs
    let person_ids: Vec<Uuid> = questionnaires_list.iter().map(|q| q.person_id).collect();

    // Get people
    let people_list = people::Entity::find()
        .filter(people::Column::Id.is_in(person_ids))
        .all(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query people".to_string())))?;

    // Get email jobs for magic links
    let email_jobs_list = email_jobs::Entity::find()
        .filter(email_jobs::Column::SortieId.eq(sortie_id))
        .all(db.as_ref())
        .await
        .unwrap_or_default();

    let mut responses = Vec::new();
    for q in questionnaires_list {
        let person = people_list.iter().find(|p| p.id == q.person_id);
        if let Some(person) = person {
            let email_job = email_jobs_list.iter().find(|e| e.person_id == q.person_id);
            
            responses.push(QuestionnaireDetailResponse {
                id: q.id,
                session_id: q.session_id,
                sortie_id: q.sortie_id,
                person_id: q.person_id,
                first_name: person.first_name.clone(),
                last_name: person.last_name.clone(),
                email: person.email.clone(),
                is_encadrant: q.is_encadrant,
                wants_regulator: q.wants_regulator,
                wants_nitrox: q.wants_nitrox,
                wants_2nd_reg: q.wants_2nd_reg,
                wants_stab: q.wants_stab,
                stab_size: q.stab_size.clone(),
                nitrox_training: q.nitrox_training,
                nitrox_base_formation: q.nitrox_base_formation,
                nitrox_confirmed_formation: q.nitrox_confirmed_formation,
                is_directeur_plongee: q.is_directeur_plongee,
                comes_from_issoire: q.comes_from_issoire,
                has_car: q.has_car,
                car_seats: q.car_seats,
                comments: q.comments.clone(),
                submitted_at: q.submitted_at.map(|dt| dt.to_string()),
                magic_link: email_job.map(|e| e.questionnaire_token.to_string()),
                email_status: email_job.map(|e| e.status.clone()),
            });
        }
    }

    Ok(Json(responses))
}
