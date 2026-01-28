use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::SessionResponse;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SortieType {
    Exploration,
    Technique,
}

impl std::fmt::Display for SortieType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SortieType::Exploration => write!(f, "exploration"),
            SortieType::Technique => write!(f, "technique"),
        }
    }
}

impl std::str::FromStr for SortieType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "exploration" => Ok(SortieType::Exploration),
            "technique" => Ok(SortieType::Technique),
            _ => Err(format!("Invalid sortie type: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateSortieRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(min = 1, max = 255))]
    pub location: String,
    pub sortie_type: SortieType,
    #[validate(range(min = 1, max = 14))]
    pub days_count: i32,
    #[validate(range(min = 1, max = 4))]
    pub dives_per_day: i32,
    pub nitrox_compatible: bool,
    pub start_date: NaiveDate,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SortieResponse {
    pub id: Uuid,
    pub name: String,
    pub location: String,
    pub sortie_type: String,
    pub days_count: i32,
    pub dives_per_day: i32,
    pub nitrox_compatible: bool,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub description: Option<String>,
    pub summary_token: Option<Uuid>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SortieWithDivesResponse {
    #[serde(flatten)]
    pub sortie: SortieResponse,
    pub dives: Vec<SessionResponse>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateSortieRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    #[validate(length(min = 1, max = 255))]
    pub location: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CopyAttendeesRequest {
    pub source_dive_id: Uuid,
    pub target_dive_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CopyAttendeesResponse {
    pub copied_count: usize,
    pub skipped_count: usize, // Already present in target
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiveDirectorRequest {
    pub questionnaire_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiveDirectorResponse {
    pub id: Uuid,
    pub session_id: Uuid,
    pub questionnaire_id: Uuid,
    pub created_at: String,
}
