use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveTime;

// ============ ROTATIONS ============

#[derive(Debug, Serialize, Deserialize)]
pub struct RotationResponse {
    pub id: Uuid,
    pub session_id: Uuid,
    pub number: i32,
    pub palanquees: Vec<PalanqueeResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRotationRequest {
    pub session_id: Uuid,
    pub number: Option<i32>, // Auto-increment si non fourni
}

// ============ PALANQUEES ============

#[derive(Debug, Serialize, Deserialize)]
pub struct PalanqueeResponse {
    pub id: Uuid,
    pub rotation_id: Uuid,
    pub number: i32,
    pub call_sign: Option<String>,
    // Paramètres prévus
    pub planned_departure_time: Option<String>,
    pub planned_time: Option<i32>,
    pub planned_depth: Option<i32>,
    // Paramètres réalisés
    pub actual_departure_time: Option<String>,
    pub actual_return_time: Option<String>,
    pub actual_time: Option<i32>,
    pub actual_depth: Option<i32>,
    // Membres
    pub members: Vec<PalanqueeMemberResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePalanqueeRequest {
    pub rotation_id: Uuid,
    pub number: Option<i32>,
    pub call_sign: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePalanqueeRequest {
    pub call_sign: Option<String>,
    pub planned_departure_time: Option<String>,
    pub planned_time: Option<i32>,
    pub planned_depth: Option<i32>,
    pub actual_departure_time: Option<String>,
    pub actual_return_time: Option<String>,
    pub actual_time: Option<i32>,
    pub actual_depth: Option<i32>,
}

// ============ PALANQUEE MEMBERS ============

#[derive(Debug, Serialize, Deserialize)]
pub struct PalanqueeMemberResponse {
    pub id: Uuid,
    pub palanquee_id: Uuid,
    pub questionnaire_id: Uuid,
    pub role: String,
    pub gas_type: String,
    // Infos du plongeur
    pub person_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub diving_level: Option<String>,
    pub preparing_level: Option<String>,
    pub is_encadrant: bool,
    pub instructor_level: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddMemberRequest {
    pub questionnaire_id: Uuid,
    pub role: String,     // E, P, GP
    pub gas_type: Option<String>, // Air par défaut
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateMemberRequest {
    pub role: Option<String>,
    pub gas_type: Option<String>,
}

// ============ FULL SESSION PALANQUEES ============

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionPalanqueesResponse {
    pub session_id: Uuid,
    pub rotations: Vec<RotationResponse>,
    // Liste des participants non assignés
    pub unassigned_participants: Vec<UnassignedParticipant>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnassignedParticipant {
    pub questionnaire_id: Uuid,
    pub person_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub diving_level: Option<String>,
    pub preparing_level: Option<String>,
    pub is_encadrant: bool,
    pub wants_nitrox: bool,
    pub nitrox_training: bool,
    pub nitrox_confirmed_formation: bool,
    pub instructor_level: Option<String>,
}

// Helper pour parser les heures
pub fn parse_time(s: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(s, "%H:%M").ok()
        .or_else(|| NaiveTime::parse_from_str(s, "%H:%M:%S").ok())
}

pub fn format_time(t: &NaiveTime) -> String {
    t.format("%H:%M").to_string()
}

