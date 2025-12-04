use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvImportRow {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
}

impl CsvImportRow {
    #[allow(dead_code)]
    pub fn validate(&self, _row_number: usize) -> Result<(), String> {
        // Validate first_name
        if self.first_name.trim().is_empty() {
            return Err("Le prénom est obligatoire".to_string());
        }
        if self.first_name.len() > 100 {
            return Err("Le prénom est trop long (max 100 caractères)".to_string());
        }

        // Validate last_name
        if self.last_name.trim().is_empty() {
            return Err("Le nom est obligatoire".to_string());
        }
        if self.last_name.len() > 100 {
            return Err("Le nom est trop long (max 100 caractères)".to_string());
        }

        // Validate email
        if self.email.trim().is_empty() {
            return Err("L'email est obligatoire".to_string());
        }
        if !self.email.contains('@') {
            return Err(format!("L'email '{}' n'est pas valide", self.email));
        }
        if self.email.len() > 255 {
            return Err("L'email est trop long (max 255 caractères)".to_string());
        }

        // Validate phone (optionnel)
        if let Some(phone) = &self.phone {
            if !phone.trim().is_empty() && phone.len() > 20 {
                return Err("Le téléphone est trop long (max 20 caractères)".to_string());
            }
        }

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportJobResponse {
    pub id: Uuid,
    pub session_id: Uuid,
    pub filename: String,
    pub status: String,
    pub total_rows: i32,
    pub success_count: i32,
    pub error_count: i32,
    pub errors: Option<Vec<ImportError>>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportError {
    pub row: usize,
    pub message: String,
}

