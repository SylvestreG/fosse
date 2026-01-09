use crate::entities::{prelude::*, rotations, palanquees, palanquee_members, questionnaires};
use crate::errors::AppError;
use crate::models::{
    RotationResponse, CreateRotationRequest, PalanqueeResponse, CreatePalanqueeRequest,
    UpdatePalanqueeRequest, PalanqueeMemberResponse, AddMemberRequest, UpdateMemberRequest,
    SessionPalanqueesResponse, UnassignedParticipant, parse_time, format_time, DiverLevel,
};
use crate::services::{generate_fiche_securite, FicheSecuriteOptions};
use axum::{
    extract::{Path, State, Query},
    Json,
    response::IntoResponse,
    http::header,
};
use chrono::Utc;
use sea_orm::*;
use std::sync::Arc;
use uuid::Uuid;

// ============ ROTATIONS ============

/// Crée une nouvelle rotation pour une session
pub async fn create_rotation(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateRotationRequest>,
) -> Result<Json<RotationResponse>, AppError> {
    // Vérifier que la session existe
    let _session = Sessions::find_by_id(payload.session_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    // Déterminer le numéro de rotation (auto-increment si non fourni)
    let number = match payload.number {
        Some(n) => n,
        None => {
            let max_rotation = Rotations::find()
                .filter(rotations::Column::SessionId.eq(payload.session_id))
                .order_by_desc(rotations::Column::Number)
                .one(db.as_ref())
                .await?;
            max_rotation.map_or(1, |r| r.number + 1)
        }
    };

    let now = Utc::now().naive_utc();
    let rotation = rotations::ActiveModel {
        id: Set(Uuid::new_v4()),
        session_id: Set(payload.session_id),
        number: Set(number),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let rotation = rotation.insert(db.as_ref()).await?;

    Ok(Json(RotationResponse {
        id: rotation.id,
        session_id: rotation.session_id,
        number: rotation.number,
        palanquees: vec![],
    }))
}

/// Liste les rotations d'une session
pub async fn list_rotations(
    State(db): State<Arc<DatabaseConnection>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Vec<RotationResponse>>, AppError> {
    let rotations_list = Rotations::find()
        .filter(rotations::Column::SessionId.eq(session_id))
        .order_by_asc(rotations::Column::Number)
        .all(db.as_ref())
        .await?;

    let mut responses = vec![];
    for rotation in rotations_list {
        let palanquees_list = get_palanquees_for_rotation(db.as_ref(), rotation.id).await?;
        responses.push(RotationResponse {
            id: rotation.id,
            session_id: rotation.session_id,
            number: rotation.number,
            palanquees: palanquees_list,
        });
    }

    Ok(Json(responses))
}

/// Supprime une rotation
pub async fn delete_rotation(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, AppError> {
    Rotations::delete_by_id(id)
        .exec(db.as_ref())
        .await?;
    Ok(Json(()))
}

// ============ PALANQUEES ============

/// Crée une nouvelle palanquée dans une rotation
pub async fn create_palanquee(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreatePalanqueeRequest>,
) -> Result<Json<PalanqueeResponse>, AppError> {
    // Vérifier que la rotation existe
    let _rotation = Rotations::find_by_id(payload.rotation_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Rotation not found".to_string()))?;

    // Déterminer le numéro de palanquée (auto-increment si non fourni)
    let number = match payload.number {
        Some(n) => n,
        None => {
            let max_palanquee = Palanquees::find()
                .filter(palanquees::Column::RotationId.eq(payload.rotation_id))
                .order_by_desc(palanquees::Column::Number)
                .one(db.as_ref())
                .await?;
            max_palanquee.map_or(1, |p| p.number + 1)
        }
    };

    let now = Utc::now().naive_utc();
    let palanquee = palanquees::ActiveModel {
        id: Set(Uuid::new_v4()),
        rotation_id: Set(payload.rotation_id),
        number: Set(number),
        call_sign: Set(payload.call_sign),
        planned_departure_time: Set(None),
        planned_time: Set(None),
        planned_depth: Set(None),
        actual_departure_time: Set(None),
        actual_return_time: Set(None),
        actual_time: Set(None),
        actual_depth: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let palanquee = palanquee.insert(db.as_ref()).await?;

    Ok(Json(PalanqueeResponse {
        id: palanquee.id,
        rotation_id: palanquee.rotation_id,
        number: palanquee.number,
        call_sign: palanquee.call_sign,
        planned_departure_time: palanquee.planned_departure_time.map(|t| format_time(&t)),
        planned_time: palanquee.planned_time,
        planned_depth: palanquee.planned_depth,
        actual_departure_time: palanquee.actual_departure_time.map(|t| format_time(&t)),
        actual_return_time: palanquee.actual_return_time.map(|t| format_time(&t)),
        actual_time: palanquee.actual_time,
        actual_depth: palanquee.actual_depth,
        members: vec![],
    }))
}

/// Met à jour une palanquée
pub async fn update_palanquee(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePalanqueeRequest>,
) -> Result<Json<PalanqueeResponse>, AppError> {
    let palanquee = Palanquees::find_by_id(id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Palanquée not found".to_string()))?;

    let now = Utc::now().naive_utc();
    let mut active_model: palanquees::ActiveModel = palanquee.into();

    if let Some(call_sign) = payload.call_sign {
        active_model.call_sign = Set(Some(call_sign));
    }
    if let Some(ref t) = payload.planned_departure_time {
        active_model.planned_departure_time = Set(parse_time(t));
    }
    if let Some(planned_time) = payload.planned_time {
        active_model.planned_time = Set(Some(planned_time));
    }
    if let Some(planned_depth) = payload.planned_depth {
        active_model.planned_depth = Set(Some(planned_depth));
    }
    if let Some(ref t) = payload.actual_departure_time {
        active_model.actual_departure_time = Set(parse_time(t));
    }
    if let Some(ref t) = payload.actual_return_time {
        active_model.actual_return_time = Set(parse_time(t));
    }
    if let Some(actual_time) = payload.actual_time {
        active_model.actual_time = Set(Some(actual_time));
    }
    if let Some(actual_depth) = payload.actual_depth {
        active_model.actual_depth = Set(Some(actual_depth));
    }
    active_model.updated_at = Set(now);

    let updated = active_model.update(db.as_ref()).await?;
    let members = get_palanquee_members(db.as_ref(), updated.id).await?;

    Ok(Json(PalanqueeResponse {
        id: updated.id,
        rotation_id: updated.rotation_id,
        number: updated.number,
        call_sign: updated.call_sign,
        planned_departure_time: updated.planned_departure_time.map(|t| format_time(&t)),
        planned_time: updated.planned_time,
        planned_depth: updated.planned_depth,
        actual_departure_time: updated.actual_departure_time.map(|t| format_time(&t)),
        actual_return_time: updated.actual_return_time.map(|t| format_time(&t)),
        actual_time: updated.actual_time,
        actual_depth: updated.actual_depth,
        members,
    }))
}

/// Supprime une palanquée
pub async fn delete_palanquee(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, AppError> {
    Palanquees::delete_by_id(id)
        .exec(db.as_ref())
        .await?;
    Ok(Json(()))
}

// ============ PALANQUEE MEMBERS ============

/// Ajoute un membre à une palanquée
pub async fn add_member(
    State(db): State<Arc<DatabaseConnection>>,
    Path(palanquee_id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<Json<PalanqueeMemberResponse>, AppError> {
    // Vérifier que la palanquée existe
    let _palanquee = Palanquees::find_by_id(palanquee_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Palanquée not found".to_string()))?;

    // Vérifier que le questionnaire existe et récupérer les infos
    let questionnaire = Questionnaires::find_by_id(payload.questionnaire_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Questionnaire not found".to_string()))?;

    // Récupérer les infos de la personne
    let person = People::find_by_id(questionnaire.person_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;

    // Déterminer le type de gaz par défaut
    let gas_type = payload.gas_type.unwrap_or_else(|| {
        if questionnaire.wants_nitrox || questionnaire.nitrox_training {
            "Nitrox".to_string()
        } else {
            "Air".to_string()
        }
    });

    let now = Utc::now().naive_utc();
    let member = palanquee_members::ActiveModel {
        id: Set(Uuid::new_v4()),
        palanquee_id: Set(palanquee_id),
        questionnaire_id: Set(payload.questionnaire_id),
        role: Set(payload.role.clone()),
        gas_type: Set(gas_type.clone()),
        created_at: Set(now),
    };

    let member = member.insert(db.as_ref()).await?;

    let preparing_level = person.diving_level.as_ref()
        .and_then(|s| DiverLevel::extract_preparing_level(s));
    
    Ok(Json(PalanqueeMemberResponse {
        id: member.id,
        palanquee_id: member.palanquee_id,
        questionnaire_id: member.questionnaire_id,
        role: member.role,
        gas_type: member.gas_type,
        person_id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        diving_level: person.diving_level,
        preparing_level,
        is_encadrant: questionnaire.is_encadrant,
    }))
}

/// Met à jour un membre
pub async fn update_member(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMemberRequest>,
) -> Result<Json<PalanqueeMemberResponse>, AppError> {
    let member = PalanqueeMembers::find_by_id(id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    let mut active_model: palanquee_members::ActiveModel = member.clone().into();

    if let Some(role) = payload.role {
        active_model.role = Set(role);
    }
    if let Some(gas_type) = payload.gas_type {
        active_model.gas_type = Set(gas_type);
    }

    let updated = active_model.update(db.as_ref()).await?;

    // Récupérer les infos du questionnaire et de la personne
    let questionnaire = Questionnaires::find_by_id(updated.questionnaire_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Questionnaire not found".to_string()))?;

    let person = People::find_by_id(questionnaire.person_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;

    let preparing_level = person.diving_level.as_ref()
        .and_then(|s| DiverLevel::extract_preparing_level(s));

    Ok(Json(PalanqueeMemberResponse {
        id: updated.id,
        palanquee_id: updated.palanquee_id,
        questionnaire_id: updated.questionnaire_id,
        role: updated.role,
        gas_type: updated.gas_type,
        person_id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        diving_level: person.diving_level,
        preparing_level,
        is_encadrant: questionnaire.is_encadrant,
    }))
}

/// Supprime un membre d'une palanquée
pub async fn remove_member(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, AppError> {
    PalanqueeMembers::delete_by_id(id)
        .exec(db.as_ref())
        .await?;
    Ok(Json(()))
}

// ============ SESSION PALANQUEES (VUE COMPLETE) ============

/// Récupère toutes les palanquées d'une session avec les participants non assignés
pub async fn get_session_palanquees(
    State(db): State<Arc<DatabaseConnection>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<SessionPalanqueesResponse>, AppError> {
    // Vérifier que la session existe
    let _session = Sessions::find_by_id(session_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    // Récupérer toutes les rotations avec leurs palanquées
    let rotations_list = Rotations::find()
        .filter(rotations::Column::SessionId.eq(session_id))
        .order_by_asc(rotations::Column::Number)
        .all(db.as_ref())
        .await?;

    let mut rotations_responses = vec![];
    let mut assigned_questionnaire_ids: Vec<Uuid> = vec![];

    for rotation in rotations_list {
        let palanquees_list = get_palanquees_for_rotation(db.as_ref(), rotation.id).await?;
        
        // Collecter les IDs des questionnaires assignés
        for palanquee in &palanquees_list {
            for member in &palanquee.members {
                assigned_questionnaire_ids.push(member.questionnaire_id);
            }
        }
        
        rotations_responses.push(RotationResponse {
            id: rotation.id,
            session_id: rotation.session_id,
            number: rotation.number,
            palanquees: palanquees_list,
        });
    }

    // Récupérer tous les questionnaires de la session (soumis ou non)
    let all_questionnaires = Questionnaires::find()
        .filter(questionnaires::Column::SessionId.eq(session_id))
        .all(db.as_ref())
        .await?;

    let mut unassigned_participants = vec![];
    for q in all_questionnaires {
        if !assigned_questionnaire_ids.contains(&q.id) {
            let person = People::find_by_id(q.person_id)
                .one(db.as_ref())
                .await?
                .ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;

            let preparing_level = person.diving_level.as_ref()
                .and_then(|s| DiverLevel::extract_preparing_level(s));

            unassigned_participants.push(UnassignedParticipant {
                questionnaire_id: q.id,
                person_id: person.id,
                first_name: person.first_name,
                last_name: person.last_name,
                diving_level: person.diving_level,
                preparing_level,
                is_encadrant: q.is_encadrant,
                wants_nitrox: q.wants_nitrox,
                nitrox_training: q.nitrox_training,
            });
        }
    }

    // Trier : encadrants d'abord, puis par nom
    unassigned_participants.sort_by(|a, b| {
        b.is_encadrant.cmp(&a.is_encadrant)
            .then_with(|| a.last_name.cmp(&b.last_name))
            .then_with(|| a.first_name.cmp(&b.first_name))
    });

    Ok(Json(SessionPalanqueesResponse {
        session_id,
        rotations: rotations_responses,
        unassigned_participants,
    }))
}

// ============ HELPERS ============

async fn get_palanquees_for_rotation(
    db: &DatabaseConnection,
    rotation_id: Uuid,
) -> Result<Vec<PalanqueeResponse>, AppError> {
    let palanquees_list = Palanquees::find()
        .filter(palanquees::Column::RotationId.eq(rotation_id))
        .order_by_asc(palanquees::Column::Number)
        .all(db)
        .await?;

    let mut responses = vec![];
    for p in palanquees_list {
        let members = get_palanquee_members(db, p.id).await?;
        responses.push(PalanqueeResponse {
            id: p.id,
            rotation_id: p.rotation_id,
            number: p.number,
            call_sign: p.call_sign,
            planned_departure_time: p.planned_departure_time.map(|t| format_time(&t)),
            planned_time: p.planned_time,
            planned_depth: p.planned_depth,
            actual_departure_time: p.actual_departure_time.map(|t| format_time(&t)),
            actual_return_time: p.actual_return_time.map(|t| format_time(&t)),
            actual_time: p.actual_time,
            actual_depth: p.actual_depth,
            members,
        });
    }

    Ok(responses)
}

async fn get_palanquee_members(
    db: &DatabaseConnection,
    palanquee_id: Uuid,
) -> Result<Vec<PalanqueeMemberResponse>, AppError> {
    let members = PalanqueeMembers::find()
        .filter(palanquee_members::Column::PalanqueeId.eq(palanquee_id))
        .all(db)
        .await?;

    let mut responses = vec![];
    for m in members {
        let questionnaire = Questionnaires::find_by_id(m.questionnaire_id)
            .one(db)
            .await?;

        if let Some(q) = questionnaire {
            let person = People::find_by_id(q.person_id)
                .one(db)
                .await?;

            if let Some(p) = person {
                let preparing_level = p.diving_level.as_ref()
                    .and_then(|s| DiverLevel::extract_preparing_level(s));
                
                responses.push(PalanqueeMemberResponse {
                    id: m.id,
                    palanquee_id: m.palanquee_id,
                    questionnaire_id: m.questionnaire_id,
                    role: m.role,
                    gas_type: m.gas_type,
                    person_id: p.id,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    diving_level: p.diving_level,
                    preparing_level,
                    is_encadrant: q.is_encadrant,
                });
            }
        }
    }

    // Trier : encadrants d'abord (E, GP), puis plongeurs
    responses.sort_by(|a, b| {
        let role_order = |r: &str| match r {
            "E" => 0,
            "GP" => 1,
            _ => 2,
        };
        role_order(&a.role).cmp(&role_order(&b.role))
            .then_with(|| a.last_name.cmp(&b.last_name))
    });

    Ok(responses)
}

// ============ FICHE DE SÉCURITÉ PDF ============

/// Query params pour la génération de la fiche de sécurité
#[derive(Debug, serde::Deserialize)]
pub struct FicheSecuriteQueryParams {
    pub date: Option<String>,
    pub club: Option<String>,
    pub directeur_plongee: Option<String>,
    pub site: Option<String>,
    pub position: Option<String>,
    pub securite_surface: Option<String>,
    pub observations: Option<String>,
}

/// Génère et télécharge la fiche de sécurité PDF
pub async fn download_fiche_securite(
    State(db): State<Arc<DatabaseConnection>>,
    Path(session_id): Path<Uuid>,
    Query(params): Query<FicheSecuriteQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let options = FicheSecuriteOptions {
        date: params.date,
        club: params.club,
        directeur_plongee: params.directeur_plongee,
        site: params.site,
        position: params.position,
        securite_surface: params.securite_surface,
        observations: params.observations,
    };

    let pdf_data = generate_fiche_securite(db.as_ref(), session_id, options).await?;

    let filename = format!("Fiche_Securite_{}.pdf", session_id);
    let headers = [
        (header::CONTENT_TYPE, "application/pdf".to_string()),
        (
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        ),
    ];

    Ok((headers, pdf_data))
}

