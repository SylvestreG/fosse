use crate::entities::prelude::*;
use crate::entities::people;
use crate::errors::AppError;
use crate::models::{CreatePersonRequest, UpdatePersonRequest, PersonResponse, DiverLevel};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use sea_orm::*;
use sea_orm::sea_query::Expr;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

/// Helper function pour calculer le display du niveau de plongée
fn compute_diving_level_display(diving_level: &Option<String>) -> Option<String> {
    diving_level.as_ref().and_then(|level_str| {
        DiverLevel::from_string(level_str).map(|diver_level| diver_level.display())
    })
}

/// Helper function pour vérifier si un plongeur est encadrant
fn compute_is_instructor(diving_level: &Option<String>) -> bool {
    diving_level.as_ref()
        .and_then(|level_str| DiverLevel::from_string(level_str))
        .map(|diver_level| diver_level.is_instructor())
        .unwrap_or(false)
}

/// Helper function pour calculer le niveau préparé
fn compute_preparing_level(diving_level: &Option<String>) -> Option<String> {
    diving_level.as_ref()
        .and_then(|level_str| DiverLevel::extract_preparing_level(level_str))
}

#[derive(Deserialize)]
pub struct ListPeopleQuery {
    pub search: Option<String>,
}

pub async fn list_people(
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<ListPeopleQuery>,
) -> Result<Json<Vec<PersonResponse>>, AppError> {
    let mut select = People::find();
    
    if let Some(search) = query.search {
        let search_lower = search.to_lowercase();
        let search_pattern = format!("%{}%", search_lower);
        select = select.filter(
            Condition::any()
                .add(Expr::expr(Expr::cust("LOWER(first_name)")).like(&search_pattern))
                .add(Expr::expr(Expr::cust("LOWER(last_name)")).like(&search_pattern))
                .add(Expr::expr(Expr::cust("LOWER(email)")).like(&search_pattern))
        );
    }
    
    let people_list = select
        .order_by_asc(people::Column::LastName)
        .order_by_asc(people::Column::FirstName)
        .all(db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query people: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query people: {}", e)))
        })?;

    // Get all groups to map group_id to group_name
    let groups_map = get_groups_map(db.as_ref()).await?;

    let response: Vec<PersonResponse> = people_list
        .into_iter()
        .map(|p| {
            let diving_level_display = compute_diving_level_display(&p.diving_level);
            let is_instructor = compute_is_instructor(&p.diving_level);
            let preparing_level = compute_preparing_level(&p.diving_level);
            let group_name = p.group_id.and_then(|gid| groups_map.get(&gid).cloned());
            PersonResponse {
                id: p.id,
                first_name: p.first_name.clone(),
                last_name: p.last_name.clone(),
                email: p.email.clone(),
                phone: p.phone.clone(),
                default_is_encadrant: p.default_is_encadrant,
                default_wants_regulator: p.default_wants_regulator,
                default_wants_nitrox: p.default_wants_nitrox,
                default_wants_2nd_reg: p.default_wants_2nd_reg,
                default_wants_stab: p.default_wants_stab,
                default_stab_size: p.default_stab_size.clone(),
                diving_level: p.diving_level,
                diving_level_display,
                is_instructor,
                preparing_level,
                group_id: p.group_id,
                group_name,
                created_at: p.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                updated_at: p.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            }
        })
        .collect();

    Ok(Json(response))
}

/// Helper pour récupérer la map des groupes
async fn get_groups_map(db: &DatabaseConnection) -> Result<HashMap<Uuid, String>, AppError> {
    let groups_list = Groups::find()
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query groups: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query groups: {}", e)))
        })?;
    
    Ok(groups_list.into_iter().map(|g| (g.id, g.name)).collect())
}

/// Helper pour récupérer le nom d'un groupe
async fn get_group_name(db: &DatabaseConnection, group_id: Option<Uuid>) -> Result<Option<String>, AppError> {
    let Some(gid) = group_id else {
        return Ok(None);
    };
    
    let group = Groups::find_by_id(gid)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query group: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query group: {}", e)))
        })?;
    
    Ok(group.map(|g| g.name))
}

pub async fn get_person(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<PersonResponse>, AppError> {
    let person = People::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query person".to_string())))?
        .ok_or(AppError::NotFound("Person not found".to_string()))?;

    let diving_level_display = compute_diving_level_display(&person.diving_level);
    let is_instructor = compute_is_instructor(&person.diving_level);
    let preparing_level = compute_preparing_level(&person.diving_level);
    let group_name = get_group_name(db.as_ref(), person.group_id).await?;

    Ok(Json(PersonResponse {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        default_is_encadrant: person.default_is_encadrant,
        default_wants_regulator: person.default_wants_regulator,
        default_wants_nitrox: person.default_wants_nitrox,
        default_wants_2nd_reg: person.default_wants_2nd_reg,
        default_wants_stab: person.default_wants_stab,
        default_stab_size: person.default_stab_size,
        diving_level: person.diving_level,
        diving_level_display,
        is_instructor,
        preparing_level,
        group_id: person.group_id,
        group_name,
        created_at: person.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: person.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

pub async fn create_person(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreatePersonRequest>,
) -> Result<Json<PersonResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let now = Utc::now().naive_utc();
    let new_person = people::ActiveModel {
        id: Set(Uuid::new_v4()),
        first_name: Set(payload.first_name),
        last_name: Set(payload.last_name),
        email: Set(payload.email),
        phone: Set(payload.phone),
        default_is_encadrant: Set(payload.default_is_encadrant.unwrap_or(false)),
        default_wants_regulator: Set(payload.default_wants_regulator.unwrap_or(true)),
        default_wants_nitrox: Set(payload.default_wants_nitrox.unwrap_or(false)),
        default_wants_2nd_reg: Set(payload.default_wants_2nd_reg.unwrap_or(false)),
        default_wants_stab: Set(payload.default_wants_stab.unwrap_or(true)),
        default_stab_size: Set(payload.default_stab_size),
        diving_level: Set(payload.diving_level),
        group_id: Set(payload.group_id),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let person = new_person
        .insert(db.as_ref())
        .await
        .map_err(|e| {
            // Check for unique constraint violation on email
            if let DbErr::Exec(RuntimeErr::SqlxError(sqlx_error)) = &e {
                if let Some(db_error) = sqlx_error.as_database_error() {
                    if db_error.is_unique_violation() {
                        return AppError::Validation(
                            "Un utilisateur avec cet email existe déjà".to_string()
                        );
                    }
                }
            }
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create person: {}", e)))
        })?;

    let diving_level_display = compute_diving_level_display(&person.diving_level);
    let is_instructor = compute_is_instructor(&person.diving_level);
    let preparing_level = compute_preparing_level(&person.diving_level);
    let group_name = get_group_name(db.as_ref(), person.group_id).await?;

    Ok(Json(PersonResponse {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        default_is_encadrant: person.default_is_encadrant,
        default_wants_regulator: person.default_wants_regulator,
        default_wants_nitrox: person.default_wants_nitrox,
        default_wants_2nd_reg: person.default_wants_2nd_reg,
        default_wants_stab: person.default_wants_stab,
        default_stab_size: person.default_stab_size,
        diving_level: person.diving_level,
        diving_level_display,
        is_instructor,
        preparing_level,
        group_id: person.group_id,
        group_name,
        created_at: person.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: person.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

pub async fn update_person(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePersonRequest>,
) -> Result<Json<PersonResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let person = People::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query person".to_string())))?
        .ok_or(AppError::NotFound("Person not found".to_string()))?;

    let mut person: people::ActiveModel = person.into();
    
    if let Some(first_name) = payload.first_name {
        person.first_name = Set(first_name);
    }
    if let Some(last_name) = payload.last_name {
        person.last_name = Set(last_name);
    }
    if let Some(email) = payload.email {
        person.email = Set(email);
    }
    if let Some(phone) = payload.phone {
        person.phone = Set(Some(phone));
    }
    if let Some(val) = payload.default_is_encadrant {
        person.default_is_encadrant = Set(val);
    }
    if let Some(val) = payload.default_wants_regulator {
        person.default_wants_regulator = Set(val);
    }
    if let Some(val) = payload.default_wants_nitrox {
        person.default_wants_nitrox = Set(val);
    }
    if let Some(val) = payload.default_wants_2nd_reg {
        person.default_wants_2nd_reg = Set(val);
    }
    if let Some(val) = payload.default_wants_stab {
        person.default_wants_stab = Set(val);
    }
    if let Some(val) = payload.default_stab_size {
        person.default_stab_size = Set(Some(val));
    }
    if let Some(val) = payload.diving_level {
        person.diving_level = Set(Some(val));
    }
    if let Some(val) = payload.group_id {
        person.group_id = Set(Some(val));
    }
    
    person.updated_at = Set(Utc::now().naive_utc());

    let updated = person
        .update(db.as_ref())
        .await
        .map_err(|e| {
            // Check for unique constraint violation on email
            if let DbErr::Exec(RuntimeErr::SqlxError(sqlx_error)) = &e {
                if let Some(db_error) = sqlx_error.as_database_error() {
                    if db_error.is_unique_violation() {
                        return AppError::Validation(
                            "Un utilisateur avec cet email existe déjà".to_string()
                        );
                    }
                }
            }
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to update person: {}", e)))
        })?;

    let diving_level_display = compute_diving_level_display(&updated.diving_level);
    let is_instructor = compute_is_instructor(&updated.diving_level);
    let preparing_level = compute_preparing_level(&updated.diving_level);
    let group_name = get_group_name(db.as_ref(), updated.group_id).await?;

    Ok(Json(PersonResponse {
        id: updated.id,
        first_name: updated.first_name,
        last_name: updated.last_name,
        email: updated.email,
        phone: updated.phone,
        default_is_encadrant: updated.default_is_encadrant,
        default_wants_regulator: updated.default_wants_regulator,
        default_wants_nitrox: updated.default_wants_nitrox,
        default_wants_2nd_reg: updated.default_wants_2nd_reg,
        default_wants_stab: updated.default_wants_stab,
        default_stab_size: updated.default_stab_size,
        diving_level: updated.diving_level,
        diving_level_display,
        is_instructor,
        preparing_level,
        group_id: updated.group_id,
        group_name,
        created_at: updated.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: updated.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

pub async fn delete_person(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let person = People::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query person".to_string())))?
        .ok_or(AppError::NotFound("Person not found".to_string()))?;

    person
        .delete(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to delete person: {}", e))))?;

    Ok(Json(serde_json::json!({
        "message": "Person deleted successfully"
    })))
}

