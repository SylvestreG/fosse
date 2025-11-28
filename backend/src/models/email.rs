use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailToSend {
    pub id: Uuid,
    pub to_email: String,
    pub to_name: String,
    pub subject: String,
    pub body: String,
    pub status: String,
    pub sent_at: Option<String>,
    pub expires_at: String,
}

