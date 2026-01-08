use crate::entities::prelude::*;
use crate::entities::people;
use crate::errors::AppError;
use crate::models::auth::{AuthResponse, GoogleCallbackRequest, GoogleIdTokenRequest, ImpersonateRequest, ImpersonateResponse};
use crate::services::{AuthService, EmailService};
use crate::services::auth::AuthResponseWithPasswordStatus;
use crate::middleware::acl::AuthUser;
use axum::{extract::State, Extension, Json};
use chrono::{Duration, Utc};
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

/// Niveaux qui permettent de valider des compétences (encadrants)
const VALIDATOR_LEVELS: &[&str] = &["E2", "E3", "E4"];

/// Vérifie si un utilisateur peut valider des compétences basé sur son niveau de plongée
/// Le diving_level peut être une liste séparée par des virgules (ex: "N1,N2,N3,N4,N5,E2")
fn can_validate_from_diving_level(diving_level: Option<&String>) -> bool {
    diving_level
        .map(|levels| {
            levels.split(',')
                .map(|l| l.trim())
                .any(|level| VALIDATOR_LEVELS.contains(&level))
        })
        .unwrap_or(false)
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
    let person = People::find()
        .filter(people::Column::Email.eq(&user_info.email))
        .one(state.db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query person: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })?;
    
    // Si ni admin ni utilisateur existant → refuser
    if !is_admin && person.is_none() {
        return Err(AppError::Forbidden(
            "Accès refusé. Vous devez être administrateur ou avoir un compte utilisateur.".to_string()
        ));
    }
    
    // Vérifier si l'utilisateur peut valider des compétences (basé sur son niveau de plongée)
    let can_validate_competencies = is_admin || can_validate_from_diving_level(
        person.as_ref().and_then(|p| p.diving_level.as_ref())
    );
    
    // Générer la réponse d'authentification
    let response = state.auth_service.generate_auth_response(
        &user_info.email,
        &user_info.name,
        is_admin,
        can_validate_competencies,
    )?;
    
    Ok(Json(response))
}

/// Authentification via Google One Tap / ID token
/// Permet de se connecter directement avec un compte Google connecté sur l'appareil
pub async fn google_id_token_callback(
    State(state): State<AuthState>,
    Json(payload): Json<GoogleIdTokenRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Vérifier l'ID token et récupérer les infos utilisateur
    let user_info = state.auth_service.verify_google_id_token(&payload.id_token).await?;
    
    tracing::info!("Google One Tap login for: {}", user_info.email);
    
    // Vérifier si c'est un admin
    let is_admin = state.auth_service.is_admin(&user_info.email);
    
    // Vérifier si l'utilisateur existe dans la base de données
    let person = People::find()
        .filter(people::Column::Email.eq(&user_info.email))
        .one(state.db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query person: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })?;
    
    // Si ni admin ni utilisateur existant → refuser
    if !is_admin && person.is_none() {
        return Err(AppError::Forbidden(
            "Accès refusé. Vous devez être administrateur ou avoir un compte utilisateur.".to_string()
        ));
    }
    
    // Vérifier si l'utilisateur peut valider des compétences (basé sur son niveau de plongée)
    let can_validate_competencies = is_admin || can_validate_from_diving_level(
        person.as_ref().and_then(|p| p.diving_level.as_ref())
    );
    
    // Générer la réponse d'authentification
    let response = state.auth_service.generate_auth_response(
        &user_info.email,
        &user_info.name,
        is_admin,
        can_validate_competencies,
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
    
    // Vérifier si l'utilisateur impersonnifié peut valider des compétences
    let can_validate_competencies = can_validate_from_diving_level(target_user.diving_level.as_ref());
    
    tracing::info!(
        "Impersonating {} - diving_level: {:?}, can_validate: {}",
        target_user.email,
        target_user.diving_level,
        can_validate_competencies
    );
    
    // Générer le token d'impersonification
    let response = state.auth_service.generate_impersonation_token(
        &auth.claims.email,
        &auth.claims.name,
        &target_user.id.to_string(),
        &target_user.email,
        &format!("{} {}", target_user.first_name, target_user.last_name),
        can_validate_competencies,
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
    // Admin peut toujours valider des compétences
    let response = state.auth_service.generate_auth_response(
        &auth.claims.email,
        &auth.claims.name,
        true,
        true, // Admin can validate
    )?;
    
    tracing::info!(
        "Admin {} stopped impersonating",
        auth.claims.email
    );
    
    Ok(Json(response))
}

// ===== Password-based Authentication =====

/// État pour les routes d'auth email/password qui ont besoin de l'EmailService
#[derive(Clone)]
pub struct PasswordAuthState {
    pub auth_service: Arc<AuthService>,
    pub email_service: Arc<EmailService>,
    pub db: Arc<DatabaseConnection>,
}

#[derive(Debug, Deserialize)]
pub struct RequestPasswordRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct RequestPasswordResponse {
    pub success: bool,
    pub message: String,
}

/// Demande un mot de passe temporaire par email (premier login ou mot de passe oublié)
pub async fn request_temp_password(
    State(state): State<PasswordAuthState>,
    Json(payload): Json<RequestPasswordRequest>,
) -> Result<Json<RequestPasswordResponse>, AppError> {
    let email = payload.email.trim().to_lowercase();
    
    // Chercher l'utilisateur
    let person = People::find()
        .filter(people::Column::Email.eq(&email))
        .one(state.db.as_ref())
        .await
        .map_err(|e| AppError::Database(e))?;

    // Pour des raisons de sécurité, on renvoie toujours le même message
    // même si l'utilisateur n'existe pas
    let Some(person) = person else {
        tracing::warn!("Password request for non-existent email: {}", email);
        return Ok(Json(RequestPasswordResponse {
            success: true,
            message: "Si cette adresse email existe, un mot de passe temporaire a été envoyé.".to_string(),
        }));
    };

    // Générer un mot de passe temporaire
    let temp_password = AuthService::generate_temp_password();
    let temp_password_hash = AuthService::hash_password(&temp_password)?;
    let expires_at = Utc::now().naive_utc() + Duration::hours(24);

    // Mettre à jour l'utilisateur
    let mut active: people::ActiveModel = person.clone().into();
    active.temp_password = Set(Some(temp_password_hash));
    active.temp_password_expires_at = Set(Some(expires_at));
    active.must_change_password = Set(true);
    active.updated_at = Set(Utc::now().naive_utc());
    
    active.update(state.db.as_ref()).await
        .map_err(|e| AppError::Database(e))?;

    // Envoyer l'email avec le mot de passe temporaire
    let person_name = format!("{} {}", person.first_name, person.last_name);
    let email_body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f5f5f5;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #1e3a5f; margin-bottom: 24px; font-size: 24px;">Bonjour {person_name}</h1>
        
        <p style="color: #4a5568; line-height: 1.6;">Voici votre mot de passe temporaire pour vous connecter à USI - Commission Technique :</p>
        
        <div style="background: #f0f4f8; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1e3a5f; font-family: monospace;">{temp_password}</span>
        </div>
        
        <p style="color: #718096; font-size: 14px; line-height: 1.6;">
            ⚠️ Ce mot de passe expire dans <strong>24 heures</strong>.<br>
            Vous devrez choisir un nouveau mot de passe lors de votre première connexion.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        
        <p style="color: #a0aec0; font-size: 12px;">
            Si vous n'avez pas demandé ce mot de passe, ignorez cet email.
        </p>
    </div>
</body>
</html>"#
    );

    if let Err(e) = state.email_service.send_email(
        &email,
        &person_name,
        "USI Commission Technique - Votre mot de passe temporaire",
        &email_body,
    ).await {
        tracing::error!("Failed to send temp password email: {:?}", e);
        // On ne révèle pas l'erreur à l'utilisateur
    }

    tracing::info!("Temp password sent to: {}", email);
    
    Ok(Json(RequestPasswordResponse {
        success: true,
        message: "Si cette adresse email existe, un mot de passe temporaire a été envoyé.".to_string(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct EmailLoginRequest {
    pub email: String,
    pub password: String,
}

/// Login avec email et mot de passe
pub async fn email_login(
    State(state): State<PasswordAuthState>,
    Json(payload): Json<EmailLoginRequest>,
) -> Result<Json<AuthResponseWithPasswordStatus>, AppError> {
    let email = payload.email.trim().to_lowercase();
    
    // Chercher l'utilisateur
    let person = People::find()
        .filter(people::Column::Email.eq(&email))
        .one(state.db.as_ref())
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::Unauthorized("Email ou mot de passe incorrect".to_string()))?;

    // Vérifier le mot de passe (essayer d'abord le temp password, puis le password normal)
    let password_valid = if let Some(ref temp_hash) = person.temp_password {
        // Vérifier si le temp password n'est pas expiré
        let not_expired = person.temp_password_expires_at
            .map(|exp| exp > Utc::now().naive_utc())
            .unwrap_or(false);
        
        if not_expired && AuthService::verify_password(&payload.password, temp_hash)? {
            true
        } else if let Some(ref hash) = person.password_hash {
            AuthService::verify_password(&payload.password, hash)?
        } else {
            false
        }
    } else if let Some(ref hash) = person.password_hash {
        AuthService::verify_password(&payload.password, hash)?
    } else {
        false
    };

    if !password_valid {
        return Err(AppError::Unauthorized("Email ou mot de passe incorrect".to_string()));
    }

    // Si login avec temp password, effacer le temp password
    if person.temp_password.is_some() {
        let mut active: people::ActiveModel = person.clone().into();
        active.temp_password = Set(None);
        active.temp_password_expires_at = Set(None);
        active.updated_at = Set(Utc::now().naive_utc());
        active.update(state.db.as_ref()).await.map_err(|e| AppError::Database(e))?;
    }

    let is_admin = state.auth_service.is_admin(&email);
    let can_validate_competencies = is_admin || can_validate_from_diving_level(person.diving_level.as_ref());
    let person_name = format!("{} {}", person.first_name, person.last_name);
    
    let response = state.auth_service.generate_auth_response_with_password_status(
        &email,
        &person_name,
        is_admin,
        can_validate_competencies,
        person.must_change_password,
    )?;

    tracing::info!("Email login successful for: {}", email);

    Ok(Json(response))
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct ChangePasswordResponse {
    pub success: bool,
    pub message: String,
}

/// Changer le mot de passe (nécessite d'être authentifié)
pub async fn change_password(
    State(state): State<PasswordAuthState>,
    Extension(auth): Extension<AuthUser>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<ChangePasswordResponse>, AppError> {
    // Validation du mot de passe
    if payload.new_password.len() < 8 {
        return Err(AppError::Validation("Le mot de passe doit contenir au moins 8 caractères".to_string()));
    }

    // Chercher l'utilisateur
    let person = People::find()
        .filter(people::Column::Email.eq(&auth.claims.email))
        .one(state.db.as_ref())
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::NotFound("Utilisateur non trouvé".to_string()))?;

    // Hasher le nouveau mot de passe
    let password_hash = AuthService::hash_password(&payload.new_password)?;

    // Mettre à jour l'utilisateur
    let mut active: people::ActiveModel = person.into();
    active.password_hash = Set(Some(password_hash));
    active.must_change_password = Set(false);
    active.temp_password = Set(None);
    active.temp_password_expires_at = Set(None);
    active.updated_at = Set(Utc::now().naive_utc());
    
    active.update(state.db.as_ref()).await
        .map_err(|e| AppError::Database(e))?;

    tracing::info!("Password changed for: {}", auth.claims.email);

    Ok(Json(ChangePasswordResponse {
        success: true,
        message: "Mot de passe modifié avec succès".to_string(),
    }))
}
