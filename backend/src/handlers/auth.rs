use crate::entities::prelude::*;
use crate::entities::people;
use crate::errors::AppError;
use crate::models::auth::{AuthResponse, GoogleCallbackRequest, ImpersonateRequest, ImpersonateResponse};
use crate::services::AuthService;
use crate::middleware::acl::AuthUser;
use axum::{extract::State, Extension, Json};
use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// État partagé pour les routes d'auth qui ont besoin de la DB
#[derive(Clone)]
pub struct AuthState {
    pub auth_service: Arc<AuthService>,
    pub db: Arc<DatabaseConnection>,
}

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
    State(state): State<AuthState>,
    Json(payload): Json<GoogleCallbackRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Récupérer les infos Google
    let user_info = state.auth_service.get_google_user_info(payload.code).await?;
    
    // Vérifier si c'est un admin
    let is_admin = state.auth_service.is_admin(&user_info.email);
    
    // Vérifier si l'utilisateur existe dans la base de données
    let person_exists = People::find()
        .filter(people::Column::Email.eq(&user_info.email))
        .one(state.db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query person: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })?;
    
    // Si ni admin ni utilisateur existant → refuser
    if !is_admin && person_exists.is_none() {
        return Err(AppError::Forbidden(
            "Accès refusé. Vous devez être administrateur ou avoir un compte utilisateur.".to_string()
        ));
    }
    
    // Générer la réponse d'authentification
    let response = state.auth_service.generate_auth_response(
        &user_info.email,
        &user_info.name,
        is_admin,
    )?;
    
    Ok(Json(response))
}

/// Impersonnifier un utilisateur (admin only)
pub async fn impersonate_user(
    State(state): State<AuthState>,
    Extension(auth): Extension<AuthUser>,
    Json(payload): Json<ImpersonateRequest>,
) -> Result<Json<ImpersonateResponse>, AppError> {
    // Vérifier que c'est un admin
    if !auth.claims.is_admin {
        return Err(AppError::Forbidden(
            "Seuls les administrateurs peuvent impersonnifier des utilisateurs".to_string()
        ));
    }
    
    // Récupérer l'utilisateur cible
    let user_id = Uuid::parse_str(&payload.user_id)
        .map_err(|_| AppError::Validation("ID utilisateur invalide".to_string()))?;
    
    let target_user = People::find_by_id(user_id)
        .one(state.db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query person: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })?
        .ok_or(AppError::NotFound("Utilisateur non trouvé".to_string()))?;
    
    // Générer le token d'impersonification
    let response = state.auth_service.generate_impersonation_token(
        &auth.claims.email,
        &auth.claims.name,
        &target_user.id.to_string(),
        &target_user.email,
        &format!("{} {}", target_user.first_name, target_user.last_name),
    )?;
    
    tracing::info!(
        "Admin {} is impersonating user {} ({})",
        auth.claims.email,
        target_user.email,
        target_user.id
    );
    
    Ok(Json(response))
}

/// Arrêter l'impersonification et revenir à l'admin
pub async fn stop_impersonation(
    State(state): State<AuthState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<AuthResponse>, AppError> {
    // Vérifier que c'est un admin qui impersonnifie
    if !auth.claims.is_admin {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas administrateur".to_string()
        ));
    }
    
    if auth.claims.impersonating.is_none() {
        return Err(AppError::Validation(
            "Vous n'impersonnifiez personne actuellement".to_string()
        ));
    }
    
    // Générer un nouveau token sans impersonification
    let response = state.auth_service.generate_auth_response(
        &auth.claims.email,
        &auth.claims.name,
        true,
    )?;
    
    tracing::info!(
        "Admin {} stopped impersonating",
        auth.claims.email
    );
    
    Ok(Json(response))
}
