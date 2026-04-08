//! Accès aux sorties (lecture, outils DP, mutations questionnaires liés).

use crate::entities::{dive_directors, prelude::*, questionnaires, sorties};
use crate::errors::AppError;
use crate::middleware::acl::AuthUser;
use crate::models::Permission;
use chrono::Utc;
use sea_orm::*;
use std::collections::HashSet;
use uuid::Uuid;

pub fn auth_effective_email(auth: &AuthUser) -> &str {
    auth.claims
        .impersonating
        .as_ref()
        .map(|i| i.user_email.as_str())
        .unwrap_or(&auth.claims.email)
}

pub async fn person_id_by_email(
    db: &DatabaseConnection,
    email: &str,
) -> Result<Option<Uuid>, AppError> {
    Ok(
        crate::person_lookup::find_person_by_email_ci(db, email)
            .await?
            .map(|p| p.id),
    )
}

async fn is_registered_on_sortie(
    db: &DatabaseConnection,
    person_id: Uuid,
    sortie_id: Uuid,
) -> Result<bool, AppError> {
    Ok(Questionnaires::find()
        .filter(questionnaires::Column::SortieId.eq(sortie_id))
        .filter(questionnaires::Column::PersonId.eq(person_id))
        .one(db)
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string()))
        })?
        .is_some())
}

async fn next_upcoming_sortie_id(db: &DatabaseConnection) -> Result<Option<Uuid>, AppError> {
    let today = Utc::now().date_naive();
    let row = Sorties::find()
        .filter(sorties::Column::EndDate.gte(today))
        .order_by_asc(sorties::Column::StartDate)
        .one(db)
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query sorties".to_string()))
        })?;
    Ok(row.map(|s| s.id))
}

/// Sorties où la personne a été / est DP (`is_directeur_plongee` et/ou `dive_directors`),
/// plus la prochaine sortie à venir si encadrant ou ancien DP.
pub async fn director_accessible_sortie_ids(
    db: &DatabaseConnection,
    person_id: Uuid,
) -> Result<HashSet<Uuid>, AppError> {
    let mut set = HashSet::new();

    let sortie_questionnaires = Questionnaires::find()
        .filter(questionnaires::Column::PersonId.eq(person_id))
        .filter(questionnaires::Column::SortieId.is_not_null())
        .all(db)
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaires".to_string()))
        })?;

    let q_ids: Vec<Uuid> = sortie_questionnaires.iter().map(|q| q.id).collect();
    let mut was_dp = false;

    // DP au niveau sortie (drapeau questionnaire), même sans ligne dive_directors
    for q in &sortie_questionnaires {
        if q.is_directeur_plongee {
            if let Some(sid) = q.sortie_id {
                set.insert(sid);
                was_dp = true;
            }
        }
    }

    if !q_ids.is_empty() {
        let dds = DiveDirectors::find()
            .filter(dive_directors::Column::QuestionnaireId.is_in(q_ids.clone()))
            .all(db)
            .await
            .map_err(|_| {
                AppError::Database(sea_orm::DbErr::Custom("Failed to query dive directors".to_string()))
            })?;
        if !dds.is_empty() {
            was_dp = true;
        }
        for dd in dds {
            let session = Sessions::find_by_id(dd.session_id)
                .one(db)
                .await
                .map_err(|_| {
                    AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string()))
                })?;
            if let Some(s) = session {
                if let Some(sid) = s.sortie_id {
                    set.insert(sid);
                }
            }
        }
    }

    let is_encadrant_anywhere = Questionnaires::find()
        .filter(questionnaires::Column::PersonId.eq(person_id))
        .filter(questionnaires::Column::IsEncadrant.eq(true))
        .one(db)
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaires".to_string()))
        })?
        .is_some();

    if is_encadrant_anywhere || was_dp {
        if let Some(nid) = next_upcoming_sortie_id(db).await? {
            set.insert(nid);
        }
    }

    Ok(set)
}

/// Admin connecté en propre personne (pas en impersonation).
pub fn acting_as_real_admin(auth: &AuthUser) -> bool {
    auth.claims.is_admin && auth.claims.impersonating.is_none()
}

pub async fn ensure_sortie_read_access(
    db: &DatabaseConnection,
    auth: &AuthUser,
    sortie_id: Uuid,
) -> Result<(), AppError> {
    if acting_as_real_admin(auth) {
        return Ok(());
    }
    let email = auth_effective_email(auth);
    let Some(pid) = person_id_by_email(db, email).await? else {
        return Err(AppError::Forbidden(
            "Accès à cette sortie non autorisé".to_string(),
        ));
    };
    if is_registered_on_sortie(db, pid, sortie_id).await? {
        return Ok(());
    }
    let allowed = director_accessible_sortie_ids(db, pid).await?;
    if allowed.contains(&sortie_id) {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Accès à cette sortie non autorisé".to_string(),
        ))
    }
}

pub async fn ensure_sortie_director_tool_access(
    db: &DatabaseConnection,
    auth: &AuthUser,
    sortie_id: Uuid,
) -> Result<(), AppError> {
    if acting_as_real_admin(auth) {
        return Ok(());
    }
    let email = auth_effective_email(auth);
    let Some(pid) = person_id_by_email(db, email).await? else {
        return Err(AppError::Forbidden(
            "Action non autorisée sur cette sortie".to_string(),
        ));
    };
    let allowed = director_accessible_sortie_ids(db, pid).await?;
    if allowed.contains(&sortie_id) {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Action non autorisée sur cette sortie".to_string(),
        ))
    }
}

/// Session **fosse** (sans sortie) : admin réel, `SessionsView`, ou DP sur cette session.
pub async fn ensure_can_manage_fosse_session_participants(
    db: &DatabaseConnection,
    auth: &AuthUser,
    session_id: Uuid,
) -> Result<(), AppError> {
    if acting_as_real_admin(auth) {
        return Ok(());
    }
    if auth.has_permission(Permission::SessionsView) {
        return Ok(());
    }
    let email = auth_effective_email(auth);
    let Some(pid) = person_id_by_email(db, email).await? else {
        return Err(AppError::Forbidden(
            "Gestion des participants non autorisée".to_string(),
        ));
    };
    let is_dp = Questionnaires::find()
        .filter(questionnaires::Column::SessionId.eq(session_id))
        .filter(questionnaires::Column::PersonId.eq(pid))
        .filter(questionnaires::Column::IsDirecteurPlongee.eq(true))
        .one(db)
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom(
                "Failed to query questionnaire".to_string(),
            ))
        })?
        .is_some();
    if is_dp {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Gestion des participants non autorisée".to_string(),
        ))
    }
}

/// Admin config, accès outils DP sur une sortie, ou propriétaire (questionnaire fosse).
pub async fn ensure_questionnaire_mutation_access(
    db: &DatabaseConnection,
    auth: &AuthUser,
    questionnaire: &questionnaires::Model,
) -> Result<(), AppError> {
    if acting_as_real_admin(auth) {
        return Ok(());
    }
    if let Some(sortie_id) = questionnaire.sortie_id {
        return ensure_sortie_director_tool_access(db, auth, sortie_id).await;
    }
    let email = auth_effective_email(auth);
    let owner = People::find_by_id(questionnaire.person_id)
        .one(db)
        .await
        .map_err(|_| {
            AppError::Database(sea_orm::DbErr::Custom("Failed to query person".to_string()))
        })?
        .ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;
    if owner.email.eq_ignore_ascii_case(email) {
        return Ok(());
    }
    let Some(session_id) = questionnaire.session_id else {
        return Err(AppError::Forbidden(
            "Modification de ce questionnaire non autorisée".to_string(),
        ));
    };
    ensure_can_manage_fosse_session_participants(db, auth, session_id).await
}
