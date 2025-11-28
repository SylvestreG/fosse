use crate::errors::AppError;
use crate::models::Claims;
use crate::services::AuthService;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AdminAuth {
    #[allow(dead_code)]
    pub claims: Claims,
}

pub async fn admin_auth_middleware(
    State(auth_service): State<Arc<AuthService>>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let token = auth_header
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("Missing or invalid Authorization header".to_string()))?;

    let claims = auth_service
        .verify_jwt(token)
        .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    request.extensions_mut().insert(AdminAuth { claims });

    Ok(next.run(request).await)
}

