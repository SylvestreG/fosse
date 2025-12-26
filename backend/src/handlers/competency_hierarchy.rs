use crate::entities::prelude::*;
use crate::entities::{
    competency_domains, competency_modules, competency_skills, people, skill_validations,
    validation_stages,
};
use crate::errors::AppError;
use crate::middleware::acl::{check_permission, AuthUser};
use crate::models::{
    CompetencyDomainResponse, CompetencyDomainWithProgress, CompetencyHierarchyResponse,
    CompetencyModuleResponse, CompetencyModuleWithProgress, CompetencySkillResponse,
    CompetencySkillWithValidation, CreateCompetencyDomainRequest, CreateCompetencyModuleRequest,
    CreateCompetencySkillRequest, CreateSkillValidationRequest, CreateValidationStageRequest,
    Permission, ProgressStats, SkillValidationInfo, SkillValidationResponse,
    UpdateCompetencyDomainRequest, UpdateCompetencyModuleRequest, UpdateCompetencySkillRequest,
    UpdateSkillValidationRequest, UpdateValidationStageRequest, ValidationLogEntry, ValidationStageResponse,
};
use crate::models::diving_level::DivingLevel;
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::{NaiveDate, Utc};
use sea_orm::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// VALIDATION STAGES HANDLERS
// ============================================================================

pub async fn list_validation_stages(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<ValidationStageResponse>>, AppError> {
    let stages = ValidationStages::find()
        .order_by_asc(validation_stages::Column::SortOrder)
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Failed to query stages: {}", e))))?;

    let response: Vec<ValidationStageResponse> = stages
        .into_iter()
        .map(|s| ValidationStageResponse {
            id: s.id,
            code: s.code,
            name: s.name,
            description: s.description,
            color: s.color,
            icon: s.icon,
            sort_order: s.sort_order,
            is_final: s.is_final,
        })
        .collect();

    Ok(Json(response))
}

pub async fn create_validation_stage(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateValidationStageRequest>,
) -> Result<Json<ValidationStageResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesEdit)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let now = Utc::now().naive_utc();
    let max_order = ValidationStages::find()
        .order_by_desc(validation_stages::Column::SortOrder)
        .one(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .map(|s| s.sort_order)
        .unwrap_or(0);

    let stage = validation_stages::ActiveModel {
        id: Set(Uuid::new_v4()),
        code: Set(payload.code),
        name: Set(payload.name),
        description: Set(payload.description),
        color: Set(payload.color.unwrap_or_else(|| "#6B7280".to_string())),
        icon: Set(payload.icon.unwrap_or_else(|| "⏳".to_string())),
        sort_order: Set(payload.sort_order.unwrap_or(max_order + 1)),
        is_final: Set(payload.is_final.unwrap_or(false)),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let stage = stage.insert(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to create stage: {}", e)))
    })?;

    Ok(Json(ValidationStageResponse {
        id: stage.id,
        code: stage.code,
        name: stage.name,
        description: stage.description,
        color: stage.color,
        icon: stage.icon,
        sort_order: stage.sort_order,
        is_final: stage.is_final,
    }))
}

pub async fn update_validation_stage(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateValidationStageRequest>,
) -> Result<Json<ValidationStageResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesEdit)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let stage = ValidationStages::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Stage non trouvé".to_string()))?;

    let mut stage: validation_stages::ActiveModel = stage.into();

    if let Some(code) = payload.code {
        stage.code = Set(code);
    }
    if let Some(name) = payload.name {
        stage.name = Set(name);
    }
    if payload.description.is_some() {
        stage.description = Set(payload.description);
    }
    if let Some(color) = payload.color {
        stage.color = Set(color);
    }
    if let Some(icon) = payload.icon {
        stage.icon = Set(icon);
    }
    if let Some(sort_order) = payload.sort_order {
        stage.sort_order = Set(sort_order);
    }
    if let Some(is_final) = payload.is_final {
        stage.is_final = Set(is_final);
    }
    stage.updated_at = Set(Utc::now().naive_utc());

    let updated = stage.update(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to update: {}", e)))
    })?;

    Ok(Json(ValidationStageResponse {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        description: updated.description,
        color: updated.color,
        icon: updated.icon,
        sort_order: updated.sort_order,
        is_final: updated.is_final,
    }))
}

pub async fn delete_validation_stage(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_permission(&auth, Permission::CompetenciesDelete)?;

    let stage = ValidationStages::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Stage non trouvé".to_string()))?;

    stage.delete(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to delete: {}", e)))
    })?;

    Ok(Json(serde_json::json!({ "message": "Stage supprimé" })))
}

// ============================================================================
// COMPETENCY DOMAINS HANDLERS
// ============================================================================

#[derive(Deserialize)]
pub struct ListDomainsQuery {
    pub diving_level: Option<String>,
    pub include_modules: Option<bool>,
}

pub async fn list_competency_domains(
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<ListDomainsQuery>,
) -> Result<Json<Vec<CompetencyDomainResponse>>, AppError> {
    let mut select = CompetencyDomains::find();

    if let Some(level) = query.diving_level {
        select = select.filter(competency_domains::Column::DivingLevel.eq(level));
    }

    let domains = select
        .order_by_asc(competency_domains::Column::DivingLevel)
        .order_by_asc(competency_domains::Column::SortOrder)
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let include_modules = query.include_modules.unwrap_or(false);
    let mut response: Vec<CompetencyDomainResponse> = Vec::new();

    for domain in domains {
        let modules = if include_modules {
            let mods = CompetencyModules::find()
                .filter(competency_modules::Column::DomainId.eq(domain.id))
                .order_by_asc(competency_modules::Column::SortOrder)
                .all(db.as_ref())
                .await
                .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

            Some(
                mods.into_iter()
                    .map(|m| CompetencyModuleResponse {
                        id: m.id,
                        domain_id: m.domain_id,
                        name: m.name,
                        sort_order: m.sort_order,
                        skills: None,
                    })
                    .collect(),
            )
        } else {
            None
        };

        response.push(CompetencyDomainResponse {
            id: domain.id,
            diving_level: domain.diving_level,
            name: domain.name,
            sort_order: domain.sort_order,
            modules,
        });
    }

    Ok(Json(response))
}

pub async fn create_competency_domain(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateCompetencyDomainRequest>,
) -> Result<Json<CompetencyDomainResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesCreate)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let now = Utc::now().naive_utc();
    let max_order = CompetencyDomains::find()
        .filter(competency_domains::Column::DivingLevel.eq(&payload.diving_level))
        .order_by_desc(competency_domains::Column::SortOrder)
        .one(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .map(|d| d.sort_order)
        .unwrap_or(0);

    let domain = competency_domains::ActiveModel {
        id: Set(Uuid::new_v4()),
        diving_level: Set(payload.diving_level),
        name: Set(payload.name),
        sort_order: Set(payload.sort_order.unwrap_or(max_order + 1)),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let domain = domain.insert(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to create domain: {}", e)))
    })?;

    Ok(Json(CompetencyDomainResponse {
        id: domain.id,
        diving_level: domain.diving_level,
        name: domain.name,
        sort_order: domain.sort_order,
        modules: None,
    }))
}

pub async fn update_competency_domain(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCompetencyDomainRequest>,
) -> Result<Json<CompetencyDomainResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesEdit)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let domain = CompetencyDomains::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Domaine non trouvé".to_string()))?;

    let mut domain: competency_domains::ActiveModel = domain.into();

    if let Some(diving_level) = payload.diving_level {
        domain.diving_level = Set(diving_level);
    }
    if let Some(name) = payload.name {
        domain.name = Set(name);
    }
    if let Some(sort_order) = payload.sort_order {
        domain.sort_order = Set(sort_order);
    }
    domain.updated_at = Set(Utc::now().naive_utc());

    let updated = domain.update(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to update: {}", e)))
    })?;

    Ok(Json(CompetencyDomainResponse {
        id: updated.id,
        diving_level: updated.diving_level,
        name: updated.name,
        sort_order: updated.sort_order,
        modules: None,
    }))
}

pub async fn delete_competency_domain(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_permission(&auth, Permission::CompetenciesDelete)?;

    let domain = CompetencyDomains::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Domaine non trouvé".to_string()))?;

    domain.delete(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to delete: {}", e)))
    })?;

    Ok(Json(serde_json::json!({ "message": "Domaine supprimé" })))
}

// ============================================================================
// COMPETENCY MODULES HANDLERS
// ============================================================================

#[derive(Deserialize)]
pub struct ListModulesQuery {
    pub domain_id: Option<Uuid>,
    pub include_skills: Option<bool>,
}

pub async fn list_competency_modules(
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<ListModulesQuery>,
) -> Result<Json<Vec<CompetencyModuleResponse>>, AppError> {
    let mut select = CompetencyModules::find();

    if let Some(domain_id) = query.domain_id {
        select = select.filter(competency_modules::Column::DomainId.eq(domain_id));
    }

    let modules = select
        .order_by_asc(competency_modules::Column::SortOrder)
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let include_skills = query.include_skills.unwrap_or(false);
    let mut response: Vec<CompetencyModuleResponse> = Vec::new();

    for module in modules {
        let skills = if include_skills {
            let sk = CompetencySkills::find()
                .filter(competency_skills::Column::ModuleId.eq(module.id))
                .order_by_asc(competency_skills::Column::SortOrder)
                .all(db.as_ref())
                .await
                .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

            Some(
                sk.into_iter()
                    .map(|s| CompetencySkillResponse {
                        id: s.id,
                        module_id: s.module_id,
                        name: s.name,
                        description: s.description,
                        sort_order: s.sort_order,
                        min_validator_level: s.min_validator_level,
                    })
                    .collect(),
            )
        } else {
            None
        };

        response.push(CompetencyModuleResponse {
            id: module.id,
            domain_id: module.domain_id,
            name: module.name,
            sort_order: module.sort_order,
            skills,
        });
    }

    Ok(Json(response))
}

pub async fn create_competency_module(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateCompetencyModuleRequest>,
) -> Result<Json<CompetencyModuleResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesCreate)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Verify domain exists
    CompetencyDomains::find_by_id(payload.domain_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Domaine non trouvé".to_string()))?;

    let now = Utc::now().naive_utc();
    let max_order = CompetencyModules::find()
        .filter(competency_modules::Column::DomainId.eq(payload.domain_id))
        .order_by_desc(competency_modules::Column::SortOrder)
        .one(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .map(|m| m.sort_order)
        .unwrap_or(0);

    let module = competency_modules::ActiveModel {
        id: Set(Uuid::new_v4()),
        domain_id: Set(payload.domain_id),
        name: Set(payload.name),
        sort_order: Set(payload.sort_order.unwrap_or(max_order + 1)),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let module = module.insert(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to create module: {}", e)))
    })?;

    Ok(Json(CompetencyModuleResponse {
        id: module.id,
        domain_id: module.domain_id,
        name: module.name,
        sort_order: module.sort_order,
        skills: None,
    }))
}

pub async fn update_competency_module(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCompetencyModuleRequest>,
) -> Result<Json<CompetencyModuleResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesEdit)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let module = CompetencyModules::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Module non trouvé".to_string()))?;

    let mut module: competency_modules::ActiveModel = module.into();

    if let Some(domain_id) = payload.domain_id {
        module.domain_id = Set(domain_id);
    }
    if let Some(name) = payload.name {
        module.name = Set(name);
    }
    if let Some(sort_order) = payload.sort_order {
        module.sort_order = Set(sort_order);
    }
    module.updated_at = Set(Utc::now().naive_utc());

    let updated = module.update(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to update: {}", e)))
    })?;

    Ok(Json(CompetencyModuleResponse {
        id: updated.id,
        domain_id: updated.domain_id,
        name: updated.name,
        sort_order: updated.sort_order,
        skills: None,
    }))
}

pub async fn delete_competency_module(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_permission(&auth, Permission::CompetenciesDelete)?;

    let module = CompetencyModules::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Module non trouvé".to_string()))?;

    module.delete(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to delete: {}", e)))
    })?;

    Ok(Json(serde_json::json!({ "message": "Module supprimé" })))
}

// ============================================================================
// COMPETENCY SKILLS HANDLERS
// ============================================================================

#[derive(Deserialize)]
pub struct ListSkillsQuery {
    pub module_id: Option<Uuid>,
}

pub async fn list_competency_skills(
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<ListSkillsQuery>,
) -> Result<Json<Vec<CompetencySkillResponse>>, AppError> {
    let mut select = CompetencySkills::find();

    if let Some(module_id) = query.module_id {
        select = select.filter(competency_skills::Column::ModuleId.eq(module_id));
    }

    let skills = select
        .order_by_asc(competency_skills::Column::SortOrder)
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let response: Vec<CompetencySkillResponse> = skills
        .into_iter()
        .map(|s| CompetencySkillResponse {
            id: s.id,
            module_id: s.module_id,
            name: s.name,
            description: s.description,
            sort_order: s.sort_order,
            min_validator_level: s.min_validator_level,
        })
        .collect();

    Ok(Json(response))
}

pub async fn create_competency_skill(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateCompetencySkillRequest>,
) -> Result<Json<CompetencySkillResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesCreate)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Verify module exists
    CompetencyModules::find_by_id(payload.module_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Module non trouvé".to_string()))?;

    let now = Utc::now().naive_utc();
    let max_order = CompetencySkills::find()
        .filter(competency_skills::Column::ModuleId.eq(payload.module_id))
        .order_by_desc(competency_skills::Column::SortOrder)
        .one(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .map(|s| s.sort_order)
        .unwrap_or(0);

    let skill = competency_skills::ActiveModel {
        id: Set(Uuid::new_v4()),
        module_id: Set(payload.module_id),
        name: Set(payload.name),
        description: Set(payload.description),
        sort_order: Set(payload.sort_order.unwrap_or(max_order + 1)),
        min_validator_level: Set(payload.min_validator_level.unwrap_or_else(|| "E2".to_string())),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let skill = skill.insert(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to create skill: {}", e)))
    })?;

    Ok(Json(CompetencySkillResponse {
        id: skill.id,
        module_id: skill.module_id,
        name: skill.name,
        description: skill.description,
        sort_order: skill.sort_order,
        min_validator_level: skill.min_validator_level,
    }))
}

pub async fn update_competency_skill(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCompetencySkillRequest>,
) -> Result<Json<CompetencySkillResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesEdit)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let skill = CompetencySkills::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Acquis non trouvé".to_string()))?;

    let mut skill: competency_skills::ActiveModel = skill.into();

    if let Some(module_id) = payload.module_id {
        skill.module_id = Set(module_id);
    }
    if let Some(name) = payload.name {
        skill.name = Set(name);
    }
    if let Some(description) = payload.description {
        skill.description = Set(Some(description));
    }
    if let Some(sort_order) = payload.sort_order {
        skill.sort_order = Set(sort_order);
    }
    if let Some(min_validator_level) = payload.min_validator_level {
        skill.min_validator_level = Set(min_validator_level);
    }
    skill.updated_at = Set(Utc::now().naive_utc());

    let updated = skill.update(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to update: {}", e)))
    })?;

    Ok(Json(CompetencySkillResponse {
        id: updated.id,
        module_id: updated.module_id,
        name: updated.name,
        description: updated.description,
        sort_order: updated.sort_order,
        min_validator_level: updated.min_validator_level,
    }))
}

pub async fn delete_competency_skill(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_permission(&auth, Permission::CompetenciesDelete)?;

    let skill = CompetencySkills::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Acquis non trouvé".to_string()))?;

    skill.delete(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to delete: {}", e)))
    })?;

    Ok(Json(serde_json::json!({ "message": "Acquis supprimé" })))
}

// ============================================================================
// SKILL VALIDATIONS HANDLERS
// ============================================================================

#[derive(Deserialize)]
pub struct ListValidationsQuery {
    pub person_id: Option<Uuid>,
    pub skill_id: Option<Uuid>,
}

pub async fn list_skill_validations(
    Extension(_auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<ListValidationsQuery>,
) -> Result<Json<Vec<SkillValidationResponse>>, AppError> {
    // Encadrants et admins peuvent voir toutes les validations
    // Les élèves ne peuvent voir que les leurs (géré via le frontend)
    
    let mut select = SkillValidations::find();

    if let Some(person_id) = query.person_id {
        select = select.filter(skill_validations::Column::PersonId.eq(person_id));
    }
    if let Some(skill_id) = query.skill_id {
        select = select.filter(skill_validations::Column::SkillId.eq(skill_id));
    }

    let validations = select
        .order_by_desc(skill_validations::Column::ValidatedAt)
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    // Load related data
    let mut response: Vec<SkillValidationResponse> = Vec::new();

    for v in validations {
        let stage = ValidationStages::find_by_id(v.stage_id)
            .one(db.as_ref())
            .await
            .ok()
            .flatten();

        let person = People::find_by_id(v.person_id)
            .one(db.as_ref())
            .await
            .ok()
            .flatten();

        let validated_by = People::find_by_id(v.validated_by_id)
            .one(db.as_ref())
            .await
            .ok()
            .flatten();

        let skill = CompetencySkills::find_by_id(v.skill_id)
            .one(db.as_ref())
            .await
            .ok()
            .flatten();

        response.push(SkillValidationResponse {
            id: v.id,
            person_id: v.person_id,
            person_name: person.map(|p| format!("{} {}", p.first_name, p.last_name)),
            skill_id: v.skill_id,
            skill_name: skill.map(|s| s.name),
            stage_id: v.stage_id,
            stage: stage.map(|s| ValidationStageResponse {
                id: s.id,
                code: s.code,
                name: s.name,
                description: s.description,
                color: s.color,
                icon: s.icon,
                sort_order: s.sort_order,
                is_final: s.is_final,
            }),
            validated_at: v.validated_at.to_string(),
            validated_by_id: v.validated_by_id,
            validated_by_name: validated_by.map(|p| format!("{} {}", p.first_name, p.last_name)),
            notes: v.notes,
        });
    }

    Ok(Json(response))
}

pub async fn create_skill_validation(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Json(payload): Json<CreateSkillValidationRequest>,
) -> Result<Json<SkillValidationResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesValidate)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Verify skill exists and get min_validator_level
    let skill = CompetencySkills::find_by_id(payload.skill_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Acquis non trouvé".to_string()))?;

    // Get the validator - use impersonated user if impersonating
    let validator_email = auth.claims.impersonating
        .as_ref()
        .map(|imp| imp.user_email.as_str())
        .unwrap_or(&auth.claims.email);
    
    let validator = People::find()
        .filter(people::Column::Email.eq(validator_email))
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Validateur non trouvé".to_string()))?;

    // Check if validator has the required level
    if let Some(validator_level_str) = &validator.diving_level {
        if let Some(min_level) = DivingLevel::parse(&skill.min_validator_level) {
            // Parse validator's highest level
            let validator_levels: Vec<&str> = validator_level_str.split(',').collect();
            let mut has_required_level = false;

            for level_str in validator_levels {
                let trimmed = level_str.trim();
                if trimmed.starts_with("preparing_") {
                    continue;
                }
                if let Some(level) = DivingLevel::parse(trimmed) {
                    if level.hierarchy() >= min_level.hierarchy() {
                        has_required_level = true;
                        break;
                    }
                }
            }

            if !has_required_level {
                return Err(AppError::Forbidden(format!(
                    "Niveau minimum requis pour valider: {}",
                    skill.min_validator_level
                )));
            }
        }
    } else {
        return Err(AppError::Forbidden(
            "Vous n'avez pas de niveau de plongée enregistré".to_string(),
        ));
    }

    // Verify stage exists
    let stage = ValidationStages::find_by_id(payload.stage_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Étape non trouvée".to_string()))?;

    // Verify person exists
    let person = People::find_by_id(payload.person_id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Élève non trouvé".to_string()))?;

    // Parse validated_at date
    let validated_at = if let Some(date_str) = &payload.validated_at {
        NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map_err(|_| AppError::Validation("Format de date invalide (YYYY-MM-DD)".to_string()))?
    } else {
        Utc::now().naive_utc().date()
    };

    let now = Utc::now().naive_utc();

    // Check if validation already exists (upsert)
    let existing = SkillValidations::find()
        .filter(skill_validations::Column::PersonId.eq(payload.person_id))
        .filter(skill_validations::Column::SkillId.eq(payload.skill_id))
        .one(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    // Check if trying to go backwards - only admins (not impersonating) can do this
    if let Some(ref existing_validation) = existing {
        let current_stage = ValidationStages::find_by_id(existing_validation.stage_id)
            .one(db.as_ref())
            .await
            .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?;
        
        if let Some(current_stage) = current_stage {
            // Check if new stage is lower than current
            if stage.sort_order < current_stage.sort_order {
                // Only allow if admin AND not impersonating
                let is_real_admin = auth.claims.is_admin && auth.claims.impersonating.is_none();
                if !is_real_admin {
                    return Err(AppError::Forbidden(
                        "Vous ne pouvez pas revenir en arrière sur une étape de validation. Seuls les administrateurs peuvent le faire.".to_string()
                    ));
                }
            }
        }
    }

    let validation = if let Some(existing) = existing {
        // Update existing
        let mut existing: skill_validations::ActiveModel = existing.into();
        existing.stage_id = Set(payload.stage_id);
        existing.validated_at = Set(validated_at);
        existing.validated_by_id = Set(validator.id);
        existing.notes = Set(payload.notes);
        existing.updated_at = Set(now);
        existing.update(db.as_ref()).await.map_err(|e| {
            AppError::Database(DbErr::Custom(format!("Failed to update: {}", e)))
        })?
    } else {
        // Create new
        let new_validation = skill_validations::ActiveModel {
            id: Set(Uuid::new_v4()),
            person_id: Set(payload.person_id),
            skill_id: Set(payload.skill_id),
            stage_id: Set(payload.stage_id),
            validated_at: Set(validated_at),
            validated_by_id: Set(validator.id),
            notes: Set(payload.notes),
            created_at: Set(now),
            updated_at: Set(now),
        };
        new_validation.insert(db.as_ref()).await.map_err(|e| {
            AppError::Database(DbErr::Custom(format!("Failed to create: {}", e)))
        })?
    };

    Ok(Json(SkillValidationResponse {
        id: validation.id,
        person_id: validation.person_id,
        person_name: Some(format!("{} {}", person.first_name, person.last_name)),
        skill_id: validation.skill_id,
        skill_name: Some(skill.name),
        stage_id: validation.stage_id,
        stage: Some(ValidationStageResponse {
            id: stage.id,
            code: stage.code,
            name: stage.name,
            description: stage.description,
            color: stage.color,
            icon: stage.icon,
            sort_order: stage.sort_order,
            is_final: stage.is_final,
        }),
        validated_at: validation.validated_at.to_string(),
        validated_by_id: validation.validated_by_id,
        validated_by_name: Some(format!("{} {}", validator.first_name, validator.last_name)),
        notes: validation.notes,
    }))
}

pub async fn update_skill_validation(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSkillValidationRequest>,
) -> Result<Json<SkillValidationResponse>, AppError> {
    check_permission(&auth, Permission::CompetenciesValidate)?;
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let validation = SkillValidations::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Validation non trouvée".to_string()))?;

    // Get the validator (current user)
    let validator = People::find()
        .filter(people::Column::Email.eq(&auth.claims.email))
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Validateur non trouvé".to_string()))?;

    let mut validation_model: skill_validations::ActiveModel = validation.clone().into();

    if let Some(stage_id) = payload.stage_id {
        validation_model.stage_id = Set(stage_id);
    }
    if let Some(date_str) = &payload.validated_at {
        let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map_err(|_| AppError::Validation("Format de date invalide".to_string()))?;
        validation_model.validated_at = Set(date);
    }
    if payload.notes.is_some() {
        validation_model.notes = Set(payload.notes);
    }
    validation_model.validated_by_id = Set(validator.id);
    validation_model.updated_at = Set(Utc::now().naive_utc());

    let updated = validation_model.update(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to update: {}", e)))
    })?;

    // Load related data for response
    let stage = ValidationStages::find_by_id(updated.stage_id)
        .one(db.as_ref())
        .await
        .ok()
        .flatten();

    let person = People::find_by_id(updated.person_id)
        .one(db.as_ref())
        .await
        .ok()
        .flatten();

    let skill = CompetencySkills::find_by_id(updated.skill_id)
        .one(db.as_ref())
        .await
        .ok()
        .flatten();

    Ok(Json(SkillValidationResponse {
        id: updated.id,
        person_id: updated.person_id,
        person_name: person.map(|p| format!("{} {}", p.first_name, p.last_name)),
        skill_id: updated.skill_id,
        skill_name: skill.map(|s| s.name),
        stage_id: updated.stage_id,
        stage: stage.map(|s| ValidationStageResponse {
            id: s.id,
            code: s.code,
            name: s.name,
            description: s.description,
            color: s.color,
            icon: s.icon,
            sort_order: s.sort_order,
            is_final: s.is_final,
        }),
        validated_at: updated.validated_at.to_string(),
        validated_by_id: updated.validated_by_id,
        validated_by_name: Some(format!("{} {}", validator.first_name, validator.last_name)),
        notes: updated.notes,
    }))
}

pub async fn delete_skill_validation(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_permission(&auth, Permission::CompetenciesValidate)?;

    let validation = SkillValidations::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Validation non trouvée".to_string()))?;

    validation.delete(db.as_ref()).await.map_err(|e| {
        AppError::Database(DbErr::Custom(format!("Failed to delete: {}", e)))
    })?;

    Ok(Json(serde_json::json!({ "message": "Validation supprimée" })))
}

/// Get all validation logs (admin only)
pub async fn get_validation_logs(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<ValidationLogEntry>>, AppError> {
    // Only real admins can view validation logs
    if !auth.claims.is_admin || auth.claims.impersonating.is_some() {
        return Err(AppError::Forbidden(
            "Seuls les administrateurs peuvent voir les logs de validation".to_string()
        ));
    }

    // Load all validations ordered by date desc
    let validations = SkillValidations::find()
        .order_by_desc(skill_validations::Column::ValidatedAt)
        .order_by_desc(skill_validations::Column::CreatedAt)
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    // Preload all people for efficiency
    let people_map: HashMap<Uuid, people::Model> = People::find()
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .into_iter()
        .map(|p| (p.id, p))
        .collect();

    // Preload all skills with their modules and domains
    let skills: Vec<competency_skills::Model> = CompetencySkills::find()
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let modules: Vec<competency_modules::Model> = CompetencyModules::find()
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let domains: Vec<competency_domains::Model> = CompetencyDomains::find()
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let stages: Vec<validation_stages::Model> = ValidationStages::find()
        .all(db.as_ref())
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    // Create lookup maps
    let skills_map: HashMap<Uuid, &competency_skills::Model> = skills.iter().map(|s| (s.id, s)).collect();
    let modules_map: HashMap<Uuid, &competency_modules::Model> = modules.iter().map(|m| (m.id, m)).collect();
    let domains_map: HashMap<Uuid, &competency_domains::Model> = domains.iter().map(|d| (d.id, d)).collect();
    let stages_map: HashMap<Uuid, &validation_stages::Model> = stages.iter().map(|s| (s.id, s)).collect();

    let mut response: Vec<ValidationLogEntry> = Vec::new();

    for validation in validations {
        let student = people_map.get(&validation.person_id);
        let instructor = people_map.get(&validation.validated_by_id);
        let skill = skills_map.get(&validation.skill_id);
        let stage = stages_map.get(&validation.stage_id);

        // Get module and domain from skill
        let (module_name, domain_name, diving_level) = if let Some(sk) = skill {
            if let Some(module) = modules_map.get(&sk.module_id) {
                if let Some(domain) = domains_map.get(&module.domain_id) {
                    (module.name.clone(), domain.name.clone(), domain.diving_level.clone())
                } else {
                    (module.name.clone(), "?".to_string(), "?".to_string())
                }
            } else {
                ("?".to_string(), "?".to_string(), "?".to_string())
            }
        } else {
            ("?".to_string(), "?".to_string(), "?".to_string())
        };

        response.push(ValidationLogEntry {
            id: validation.id,
            validated_at: validation.validated_at.to_string(),
            student_name: student.map(|p| format!("{} {}", p.first_name, p.last_name)).unwrap_or_else(|| "?".to_string()),
            student_email: student.map(|p| p.email.clone()).unwrap_or_else(|| "?".to_string()),
            instructor_name: instructor.map(|p| format!("{} {}", p.first_name, p.last_name)).unwrap_or_else(|| "?".to_string()),
            instructor_email: instructor.map(|p| p.email.clone()).unwrap_or_else(|| "?".to_string()),
            skill_name: skill.map(|s| s.name.clone()).unwrap_or_else(|| "?".to_string()),
            module_name,
            domain_name,
            diving_level,
            stage_name: stage.map(|s| s.name.clone()).unwrap_or_else(|| "?".to_string()),
            stage_color: stage.map(|s| s.color.clone()).unwrap_or_else(|| "#888888".to_string()),
            is_final: stage.map(|s| s.is_final).unwrap_or(false),
            notes: validation.notes,
        });
    }

    Ok(Json(response))
}

// ============================================================================
// HIERARCHY VIEW (for user's competency page)
// ============================================================================

#[derive(Deserialize)]
pub struct MyCompetenciesQuery {
    pub diving_level: String,
}

/// Get full competency hierarchy with user's progress
/// Élèves: peuvent voir seulement leurs propres compétences
/// Encadrants/Admin: peuvent voir n'importe qui via person_id
pub async fn get_my_competencies(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Query(query): Query<MyCompetenciesQuery>,
) -> Result<Json<CompetencyHierarchyResponse>, AppError> {
    // Use impersonated user's email if impersonating, otherwise use own email
    let target_email = auth.claims.impersonating
        .as_ref()
        .map(|imp| imp.user_email.as_str())
        .unwrap_or(&auth.claims.email);
    
    // Get target user's person record
    let person = People::find()
        .filter(people::Column::Email.eq(target_email))
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(DbErr::Custom("Query failed".to_string())))?
        .ok_or(AppError::NotFound("Profil non trouvé".to_string()))?;

    get_competency_hierarchy_for_person(&db, &query.diving_level, person.id).await
}

#[derive(Deserialize)]
pub struct PersonCompetenciesQuery {
    pub diving_level: String,
}

/// Get competency hierarchy for a specific person (encadrants/admins only)
pub async fn get_person_competencies(
    Extension(auth): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Path(person_id): Path<Uuid>,
    Query(query): Query<PersonCompetenciesQuery>,
) -> Result<Json<CompetencyHierarchyResponse>, AppError> {
    // Check if user can view this person's competencies
    let is_viewing_self = {
        let viewer = People::find()
            .filter(people::Column::Email.eq(&auth.claims.email))
            .one(db.as_ref())
            .await
            .ok()
            .flatten();
        viewer.map(|v| v.id == person_id).unwrap_or(false)
    };

    if !is_viewing_self {
        // Need CompetenciesValidate permission to view others
        check_permission(&auth, Permission::CompetenciesValidate)?;
    }

    get_competency_hierarchy_for_person(&db, &query.diving_level, person_id).await
}

async fn get_competency_hierarchy_for_person(
    db: &DatabaseConnection,
    diving_level: &str,
    person_id: Uuid,
) -> Result<Json<CompetencyHierarchyResponse>, AppError> {
    // Load all stages for reference
    let stages: HashMap<Uuid, validation_stages::Model> = ValidationStages::find()
        .all(db)
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .into_iter()
        .map(|s| (s.id, s))
        .collect();

    // Load all validations for this person
    let validations: HashMap<Uuid, skill_validations::Model> = SkillValidations::find()
        .filter(skill_validations::Column::PersonId.eq(person_id))
        .all(db)
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
        .into_iter()
        .map(|v| (v.skill_id, v))
        .collect();

    // Load validators names
    let validator_ids: Vec<Uuid> = validations.values().map(|v| v.validated_by_id).collect();
    let validators: HashMap<Uuid, people::Model> = if !validator_ids.is_empty() {
        People::find()
            .filter(people::Column::Id.is_in(validator_ids))
            .all(db)
            .await
            .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?
            .into_iter()
            .map(|p| (p.id, p))
            .collect()
    } else {
        HashMap::new()
    };

    // Load domains for this level
    let domains = CompetencyDomains::find()
        .filter(competency_domains::Column::DivingLevel.eq(diving_level))
        .order_by_asc(competency_domains::Column::SortOrder)
        .all(db)
        .await
        .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

    let mut domains_with_progress: Vec<CompetencyDomainWithProgress> = Vec::new();

    for domain in domains {
        // Load modules for this domain
        let modules = CompetencyModules::find()
            .filter(competency_modules::Column::DomainId.eq(domain.id))
            .order_by_asc(competency_modules::Column::SortOrder)
            .all(db)
            .await
            .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

        let mut modules_with_progress: Vec<CompetencyModuleWithProgress> = Vec::new();

        for module in modules {
            // Load skills for this module
            let skills = CompetencySkills::find()
                .filter(competency_skills::Column::ModuleId.eq(module.id))
                .order_by_asc(competency_skills::Column::SortOrder)
                .all(db)
                .await
                .map_err(|e| AppError::Database(DbErr::Custom(format!("Query failed: {}", e))))?;

            let mut skills_with_validation: Vec<CompetencySkillWithValidation> = Vec::new();
            let mut module_stats = ProgressStats::default();

            for skill in skills {
                module_stats.total += 1;

                let validation_info = if let Some(validation) = validations.get(&skill.id) {
                    if let Some(stage) = stages.get(&validation.stage_id) {
                        if stage.is_final {
                            module_stats.validated += 1;
                        } else {
                            module_stats.in_progress += 1;
                        }

                        let validator_name = validators
                            .get(&validation.validated_by_id)
                            .map(|p| format!("{} {}", p.first_name, p.last_name))
                            .unwrap_or_else(|| "Inconnu".to_string());

                        Some(SkillValidationInfo {
                            id: validation.id,
                            stage_id: stage.id,
                            stage_code: stage.code.clone(),
                            stage_name: stage.name.clone(),
                            stage_color: stage.color.clone(),
                            stage_icon: stage.icon.clone(),
                            is_final: stage.is_final,
                            validated_at: validation.validated_at.to_string(),
                            validated_by_name: validator_name,
                            notes: validation.notes.clone(),
                        })
                    } else {
                        module_stats.not_started += 1;
                        None
                    }
                } else {
                    module_stats.not_started += 1;
                    None
                };

                skills_with_validation.push(CompetencySkillWithValidation {
                    id: skill.id,
                    name: skill.name,
                    description: skill.description,
                    sort_order: skill.sort_order,
                    min_validator_level: skill.min_validator_level,
                    validation: validation_info,
                });
            }

            if module_stats.total > 0 {
                module_stats.percentage =
                    (module_stats.validated as f32 / module_stats.total as f32) * 100.0;
            }

            modules_with_progress.push(CompetencyModuleWithProgress {
                id: module.id,
                name: module.name,
                sort_order: module.sort_order,
                skills: skills_with_validation,
                progress: module_stats,
            });
        }

        // Calculate domain stats
        let mut domain_stats = ProgressStats::default();
        for module in &modules_with_progress {
            domain_stats.total += module.progress.total;
            domain_stats.validated += module.progress.validated;
            domain_stats.in_progress += module.progress.in_progress;
            domain_stats.not_started += module.progress.not_started;
        }
        if domain_stats.total > 0 {
            domain_stats.percentage =
                (domain_stats.validated as f32 / domain_stats.total as f32) * 100.0;
        }

        domains_with_progress.push(CompetencyDomainWithProgress {
            id: domain.id,
            name: domain.name,
            sort_order: domain.sort_order,
            modules: modules_with_progress,
            progress: domain_stats,
        });
    }

    Ok(Json(CompetencyHierarchyResponse {
        diving_level: diving_level.to_string(),
        domains: domains_with_progress,
    }))
}

