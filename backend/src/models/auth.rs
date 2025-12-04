use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleCallbackRequest {
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub expires_in: i64,
    pub token_type: String,
    pub id_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleUserInfo {
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub email: String,
    pub name: String,
    pub is_admin: bool,
    pub impersonating: Option<ImpersonationInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpersonationInfo {
    pub user_id: String,
    pub user_email: String,
    pub user_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub name: String,
    pub exp: i64,
    pub is_admin: bool,
    /// Si présent, l'admin impersonnifie cet utilisateur
    #[serde(skip_serializing_if = "Option::is_none")]
    pub impersonating: Option<ImpersonationInfo>,
}

#[derive(Debug, Deserialize)]
pub struct ImpersonateRequest {
    pub user_id: String,
}

#[derive(Debug, Serialize)]
pub struct ImpersonateResponse {
    pub token: String,
    pub impersonating: ImpersonationInfo,
}

