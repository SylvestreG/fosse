use crate::entities::prelude::*;
use crate::entities::competencies;
use crate::errors::AppError;
use crate::models::{CompetencyResponse, CreateCompetencyRequest, UpdateCompetencyRequest, CompetenciesByLevel};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use sea_orm::*;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct ListCompetenciesQuery {
    pub level: Option<String>,
}

/// Liste toutes les compétences, optionnellement filtrées par niveau
pub async fn list_competencies(
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<ListCompetenciesQuery>,
) -> Result<Json<Vec<CompetencyResponse>>, AppError> {
    let mut select = Competencies::find();
    
    if let Some(level) = query.level {
        select = select.filter(competencies::Column::Level.eq(level));
    }
    
    let competencies_list = select
        .order_by_asc(competencies::Column::Level)
        .order_by_asc(competencies::Column::SortOrder)
        .order_by_asc(competencies::Column::Name)
        .all(db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query competencies: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query competencies: {}", e)))
        })?;

    let response: Vec<CompetencyResponse> = competencies_list
        .into_iter()
        .map(|c| CompetencyResponse {
            id: c.id,
            level: c.level,
            name: c.name,
            description: c.description,
            sort_order: c.sort_order,
            created_at: c.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: c.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();

    Ok(Json(response))
}

/// Liste les compétences groupées par niveau
pub async fn list_competencies_by_level(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<CompetenciesByLevel>>, AppError> {
    let competencies_list = Competencies::find()
        .order_by_asc(competencies::Column::Level)
        .order_by_asc(competencies::Column::SortOrder)
        .order_by_asc(competencies::Column::Name)
        .all(db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query competencies: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query competencies: {}", e)))
        })?;

    // Group by level
    let mut grouped: HashMap<String, Vec<CompetencyResponse>> = HashMap::new();
    
    for c in competencies_list {
        let response = CompetencyResponse {
            id: c.id,
            level: c.level.clone(),
            name: c.name,
            description: c.description,
            sort_order: c.sort_order,
            created_at: c.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: c.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        };
        grouped.entry(c.level).or_default().push(response);
    }

    // Convert to sorted vec
    let level_order = ["N1", "N2", "N3", "E1", "N4", "N5", "E2", "E3", "E4"];
    let mut result: Vec<CompetenciesByLevel> = Vec::new();
    
    for level in level_order {
        if let Some(competencies) = grouped.remove(level) {
            result.push(CompetenciesByLevel {
                level: level.to_string(),
                competencies,
            });
        }
    }
    
    // Add any remaining levels not in the predefined order
    for (level, competencies) in grouped {
        result.push(CompetenciesByLevel {
            level,
            competencies,
        });
    }

    Ok(Json(result))
}

/// Récupère une compétence par ID
pub async fn get_competency(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<CompetencyResponse>, AppError> {
    let competency = Competencies::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query competency".to_string())))?
        .ok_or(AppError::NotFound("Compétence non trouvée".to_string()))?;

    Ok(Json(CompetencyResponse {
        id: competency.id,
        level: competency.level,
        name: competency.name,
        description: competency.description,
        sort_order: competency.sort_order,
        created_at: competency.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: competency.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

/// Crée une nouvelle compétence
pub async fn create_competency(
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateCompetencyRequest>,
) -> Result<Json<CompetencyResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Calculer le sort_order si non fourni
    let sort_order = if let Some(order) = payload.sort_order {
        order
    } else {
        // Trouver le max sort_order pour ce niveau et ajouter 1
        let max_order = Competencies::find()
            .filter(competencies::Column::Level.eq(&payload.level))
            .order_by_desc(competencies::Column::SortOrder)
            .one(db.as_ref())
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query max order: {}", e))))?
            .map(|c| c.sort_order)
            .unwrap_or(-1);
        max_order + 1
    };

    let now = Utc::now().naive_utc();
    let new_competency = competencies::ActiveModel {
        id: Set(Uuid::new_v4()),
        level: Set(payload.level),
        name: Set(payload.name),
        description: Set(payload.description),
        sort_order: Set(sort_order),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let competency = new_competency
        .insert(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create competency: {}", e))))?;

    Ok(Json(CompetencyResponse {
        id: competency.id,
        level: competency.level,
        name: competency.name,
        description: competency.description,
        sort_order: competency.sort_order,
        created_at: competency.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: competency.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

/// Met à jour une compétence existante
pub async fn update_competency(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCompetencyRequest>,
) -> Result<Json<CompetencyResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let competency = Competencies::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query competency".to_string())))?
        .ok_or(AppError::NotFound("Compétence non trouvée".to_string()))?;

    let mut competency: competencies::ActiveModel = competency.into();
    
    if let Some(level) = payload.level {
        competency.level = Set(level);
    }
    if let Some(name) = payload.name {
        competency.name = Set(name);
    }
    if let Some(description) = payload.description {
        competency.description = Set(Some(description));
    }
    if let Some(sort_order) = payload.sort_order {
        competency.sort_order = Set(sort_order);
    }
    
    competency.updated_at = Set(Utc::now().naive_utc());

    let updated = competency
        .update(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to update competency: {}", e))))?;

    Ok(Json(CompetencyResponse {
        id: updated.id,
        level: updated.level,
        name: updated.name,
        description: updated.description,
        sort_order: updated.sort_order,
        created_at: updated.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: updated.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

/// Supprime une compétence
pub async fn delete_competency(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let competency = Competencies::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query competency".to_string())))?
        .ok_or(AppError::NotFound("Compétence non trouvée".to_string()))?;

    competency
        .delete(db.as_ref())
        .await
        .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to delete competency: {}", e))))?;

    Ok(Json(serde_json::json!({
        "message": "Compétence supprimée avec succès"
    })))
}

