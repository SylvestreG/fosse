use serde::{Deserialize, Serialize};
use validator::Validate;

// ============================================================================
// VALIDATION STAGES (Étapes de validation)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationStageResponse {
    pub id: uuid::Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: String,
    pub sort_order: i32,
    pub is_final: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateValidationStageRequest {
    #[validate(length(min = 1, max = 50))]
    pub code: String,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub description: Option<String>,
    #[validate(length(min = 1, max = 20))]
    pub color: Option<String>,
    #[validate(length(min = 1, max = 10))]
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
    pub is_final: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateValidationStageRequest {
    #[validate(length(min = 1, max = 50))]
    pub code: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub description: Option<String>,
    #[validate(length(min = 1, max = 20))]
    pub color: Option<String>,
    #[validate(length(min = 1, max = 10))]
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
    pub is_final: Option<bool>,
}

// ============================================================================
// COMPETENCY DOMAINS (Domaines - COMMUNES, PE40, PA20, etc.)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencyDomainResponse {
    pub id: uuid::Uuid,
    pub diving_level: String,
    pub name: String,
    pub sort_order: i32,
    pub modules: Option<Vec<CompetencyModuleResponse>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCompetencyDomainRequest {
    #[validate(length(min = 1, max = 10))]
    pub diving_level: String,
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateCompetencyDomainRequest {
    #[validate(length(min = 1, max = 10))]
    pub diving_level: Option<String>,
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub sort_order: Option<i32>,
}

// ============================================================================
// COMPETENCY MODULES (Modules dans un domaine)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencyModuleResponse {
    pub id: uuid::Uuid,
    pub domain_id: uuid::Uuid,
    pub name: String,
    pub sort_order: i32,
    pub skills: Option<Vec<CompetencySkillResponse>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCompetencyModuleRequest {
    pub domain_id: uuid::Uuid,
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateCompetencyModuleRequest {
    pub domain_id: Option<uuid::Uuid>,
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub sort_order: Option<i32>,
}

// ============================================================================
// COMPETENCY SKILLS (Acquis individuels)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencySkillResponse {
    pub id: uuid::Uuid,
    pub module_id: uuid::Uuid,
    pub name: String,
    pub sort_order: i32,
    pub min_validator_level: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCompetencySkillRequest {
    pub module_id: uuid::Uuid,
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub sort_order: Option<i32>,
    #[validate(length(min = 1, max = 10))]
    pub min_validator_level: Option<String>, // Default: "E2"
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateCompetencySkillRequest {
    pub module_id: Option<uuid::Uuid>,
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub sort_order: Option<i32>,
    #[validate(length(min = 1, max = 10))]
    pub min_validator_level: Option<String>,
}

// ============================================================================
// SKILL VALIDATIONS (Progression d'un élève)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillValidationResponse {
    pub id: uuid::Uuid,
    pub person_id: uuid::Uuid,
    pub person_name: Option<String>,
    pub skill_id: uuid::Uuid,
    pub skill_name: Option<String>,
    pub stage_id: uuid::Uuid,
    pub stage: Option<ValidationStageResponse>,
    pub validated_at: String,
    pub validated_by_id: uuid::Uuid,
    pub validated_by_name: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateSkillValidationRequest {
    pub person_id: uuid::Uuid,
    pub skill_id: uuid::Uuid,
    pub stage_id: uuid::Uuid,
    pub validated_at: Option<String>, // ISO date, default: today
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSkillValidationRequest {
    pub stage_id: Option<uuid::Uuid>,
    pub validated_at: Option<String>,
    pub notes: Option<String>,
}

// ============================================================================
// RESPONSE WITH FULL HIERARCHY (for user view)
// ============================================================================

/// Full hierarchical view of competencies for a diving level
#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencyHierarchyResponse {
    pub diving_level: String,
    pub domains: Vec<CompetencyDomainWithProgress>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencyDomainWithProgress {
    pub id: uuid::Uuid,
    pub name: String,
    pub sort_order: i32,
    pub modules: Vec<CompetencyModuleWithProgress>,
    pub progress: ProgressStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencyModuleWithProgress {
    pub id: uuid::Uuid,
    pub name: String,
    pub sort_order: i32,
    pub skills: Vec<CompetencySkillWithValidation>,
    pub progress: ProgressStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencySkillWithValidation {
    pub id: uuid::Uuid,
    pub name: String,
    pub sort_order: i32,
    pub min_validator_level: String,
    pub validation: Option<SkillValidationInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillValidationInfo {
    pub id: uuid::Uuid,
    pub stage_id: uuid::Uuid,
    pub stage_code: String,
    pub stage_name: String,
    pub stage_color: String,
    pub stage_icon: String,
    pub is_final: bool,
    pub validated_at: String,
    pub validated_by_name: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ProgressStats {
    pub total: i32,
    pub validated: i32,      // Final stage
    pub in_progress: i32,    // Any non-final stage
    pub not_started: i32,
    pub percentage: f32,
}

// ============================================================================
// LEGACY (for backward compatibility) - Keep old simple model
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CompetencyResponse {
    pub id: uuid::Uuid,
    pub level: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCompetencyRequest {
    #[validate(length(min = 1, max = 10, message = "Le niveau doit faire entre 1 et 10 caractères"))]
    pub level: String,
    #[validate(length(min = 1, max = 255, message = "Le nom doit faire entre 1 et 255 caractères"))]
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateCompetencyRequest {
    #[validate(length(min = 1, max = 10, message = "Le niveau doit faire entre 1 et 10 caractères"))]
    pub level: Option<String>,
    #[validate(length(min = 1, max = 255, message = "Le nom doit faire entre 1 et 255 caractères"))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}

/// Grouped competencies by level
#[derive(Debug, Serialize)]
pub struct CompetenciesByLevel {
    pub level: String,
    pub competencies: Vec<CompetencyResponse>,
}
