use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct SubmitQuestionnaireRequest {
    pub token: Uuid,
    pub is_encadrant: bool,
    pub wants_regulator: bool,
    pub wants_nitrox: bool,
    pub wants_2nd_reg: bool,
    pub wants_stab: bool,
    pub stab_size: Option<String>,
    pub comes_from_issoire: bool,
    pub has_car: bool,
    pub car_seats: Option<i32>,
    pub comments: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestionnaireResponse {
    pub id: Uuid,
    pub session_id: Uuid,
    pub person_id: Uuid,
    pub is_encadrant: bool,
    pub wants_regulator: bool,
    pub wants_nitrox: bool,
    pub wants_2nd_reg: bool,
    pub wants_stab: bool,
    pub stab_size: Option<String>,
    pub comes_from_issoire: bool,
    pub has_car: bool,
    pub car_seats: Option<i32>,
    pub comments: Option<String>,
    pub submitted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestionnaireTokenData {
    pub token: Uuid,
    pub person: super::PersonResponse,
    pub session_id: Uuid,
    pub questionnaire: Option<QuestionnaireResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestionnaireDetailResponse {
    pub id: Uuid,
    pub session_id: Uuid,
    pub person_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub is_encadrant: bool,
    pub wants_regulator: bool,
    pub wants_nitrox: bool,
    pub wants_2nd_reg: bool,
    pub wants_stab: bool,
    pub stab_size: Option<String>,
    pub comes_from_issoire: bool,
    pub has_car: bool,
    pub car_seats: Option<i32>,
    pub comments: Option<String>,
    pub submitted_at: Option<String>,
    pub magic_link: Option<String>,
    pub email_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateQuestionnaireRequest {
    pub is_encadrant: bool,
    pub wants_regulator: bool,
    pub wants_nitrox: bool,
    pub wants_2nd_reg: bool,
    pub wants_stab: bool,
    pub stab_size: Option<String>,
    pub comes_from_issoire: bool,
    pub has_car: bool,
    pub car_seats: Option<i32>,
    pub comments: Option<String>,
    pub mark_as_submitted: Option<bool>, // True to mark as submitted, False to mark as not submitted
}

