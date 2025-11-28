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
    pub fn validate(&self, _row_number: usize) -> Result<(), String> {
        // Validate first_name
        if self.first_name.trim().is_empty() {
            return Err(format!("Le prénom est obligatoire"));
        }
        if self.first_name.len() > 100 {
            return Err(format!("Le prénom est trop long (max 100 caractères)"));
        }

        // Validate last_name
        if self.last_name.trim().is_empty() {
            return Err(format!("Le nom est obligatoire"));
        }
        if self.last_name.len() > 100 {
            return Err(format!("Le nom est trop long (max 100 caractères)"));
        }

        // Validate email
        if self.email.trim().is_empty() {
            return Err(format!("L'email est obligatoire"));
        }
        if !self.email.contains('@') {
            return Err(format!("L'email '{}' n'est pas valide", self.email));
        }
        if self.email.len() > 255 {
            return Err(format!("L'email est trop long (max 255 caractères)"));
        }

        // Validate phone (optionnel)
        if let Some(phone) = &self.phone {
            if !phone.trim().is_empty() && phone.len() > 20 {
                return Err(format!("Le téléphone est trop long (max 20 caractères)"));
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

