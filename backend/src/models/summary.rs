use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionSummary {
    pub total_questionnaires: i64,
    pub submitted_count: i64,
    pub encadrants_count: i64,
    pub students_count: i64,
    pub from_issoire_count: i64,
    pub total_bottles: i64,
    pub nitrox_bottles: i64,
    pub air_bottles: i64,
    pub regulators_count: i64,
    pub nitrox_count: i64,
    pub nitrox_training_count: i64,
    pub second_reg_count: i64,
    pub stab_count: i64,
    pub stab_sizes: Vec<StabSize>,
    pub vehicles_count: i64,
    pub total_car_seats: i64,
    pub participants: Vec<ParticipantInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StabSize {
    pub size: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub magic_link: String,
    pub submitted: bool,
    pub is_encadrant: bool,
    pub nitrox_training: bool,
    pub comes_from_issoire: bool,
    pub diving_level: Option<String>,
    pub preparing_level: Option<String>,
}

