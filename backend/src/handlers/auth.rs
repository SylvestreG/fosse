use crate::models::auth::{AuthResponse, GoogleCallbackRequest};
use crate::services::AuthService;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthConfigResponse {
    pub client_id: String,
}

pub async fn get_oauth_config(
    State(auth_service): State<Arc<AuthService>>,
) -> Json<OAuthConfigResponse> {
    Json(OAuthConfigResponse {
        client_id: auth_service.get_client_id().to_string(),
    })
}

pub async fn google_callback(
    State(auth_service): State<Arc<AuthService>>,
    Json(payload): Json<GoogleCallbackRequest>,
) -> Result<Json<AuthResponse>, crate::errors::AppError> {
    let response = auth_service.handle_google_callback(payload.code).await?;
    Ok(Json(response))
}

