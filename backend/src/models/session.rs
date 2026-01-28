use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateSessionRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub id: Uuid,
    pub name: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub description: Option<String>,
    pub summary_token: Option<Uuid>,
    pub optimization_mode: bool,
    pub sortie_id: Option<Uuid>,
    pub dive_number: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSessionRequest {
    pub optimization_mode: Option<bool>,
}

