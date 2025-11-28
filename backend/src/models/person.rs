use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize)]
pub struct PersonResponse {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub default_is_encadrant: bool,
    pub default_wants_regulator: bool,
    pub default_wants_nitrox: bool,
    pub default_wants_2nd_reg: bool,
    pub default_wants_stab: bool,
    pub default_stab_size: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePersonRequest {
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,
    
    #[validate(email, length(max = 255))]
    pub email: String,
    
    #[validate(length(max = 20))]
    pub phone: Option<String>,
    
    pub default_is_encadrant: Option<bool>,
    pub default_wants_regulator: Option<bool>,
    pub default_wants_nitrox: Option<bool>,
    pub default_wants_2nd_reg: Option<bool>,
    pub default_wants_stab: Option<bool>,
    pub default_stab_size: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePersonRequest {
    #[validate(length(min = 1, max = 100))]
    pub first_name: Option<String>,
    
    #[validate(length(min = 1, max = 100))]
    pub last_name: Option<String>,
    
    #[validate(email, length(max = 255))]
    pub email: Option<String>,
    
    #[validate(length(max = 20))]
    pub phone: Option<String>,
    
    pub default_is_encadrant: Option<bool>,
    pub default_wants_regulator: Option<bool>,
    pub default_wants_nitrox: Option<bool>,
    pub default_wants_2nd_reg: Option<bool>,
    pub default_wants_stab: Option<bool>,
    pub default_stab_size: Option<String>,
}
