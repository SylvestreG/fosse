use crate::config::{GoogleOAuthConfig, JwtConfig};
use crate::errors::{AppError, AppResult};
use crate::models::{AuthResponse, Claims, GoogleTokenResponse, GoogleUserInfo, ImpersonationInfo, ImpersonateResponse};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;

pub struct AuthService {
    google_config: GoogleOAuthConfig,
    jwt_config: JwtConfig,
    admin_emails: Vec<String>,
}

impl AuthService {
    pub fn new(
        google_config: GoogleOAuthConfig,
        jwt_config: JwtConfig,
        admin_emails: Vec<String>,
    ) -> Self {
        Self {
            google_config,
            jwt_config,
            admin_emails,
        }
    }

    /// Vérifie si un email est admin
    pub fn is_admin(&self, email: &str) -> bool {
        self.admin_emails.contains(&email.to_string())
    }

    /// Échange le code OAuth contre les infos utilisateur Google
    pub async fn get_google_user_info(&self, code: String) -> AppResult<GoogleUserInfo> {
        // Exchange code for token
        let client = reqwest::Client::new();
        let token_response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("code", code.as_str()),
                ("client_id", self.google_config.client_id.as_str()),
                ("client_secret", self.google_config.client_secret.as_str()),
                ("redirect_uri", self.google_config.redirect_uri.as_str()),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| AppError::ExternalService(format!("Failed to exchange code: {}", e)))?;

        if !token_response.status().is_success() {
            let error_text = token_response.text().await.unwrap_or_default();
            return Err(AppError::ExternalService(format!(
                "Google OAuth error: {}",
                error_text
            )));
        }

        let token_data: GoogleTokenResponse = token_response.json().await.map_err(|e| AppError::ExternalService(format!(
                "Failed to parse token response: {}",
                e
            )))?;

        // Get user info
        let user_info = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(&token_data.access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalService(format!("Failed to get user info: {}", e)))?
            .json::<GoogleUserInfo>()
            .await
            .map_err(|e| AppError::ExternalService(format!("Failed to parse user info: {}", e)))?;

        Ok(user_info)
    }

    /// Vérifie un ID token Google (One Tap / Identity Services)
    /// Retourne les infos utilisateur si le token est valide
    pub async fn verify_google_id_token(&self, id_token: &str) -> AppResult<GoogleUserInfo> {
        let client = reqwest::Client::new();
        
        // Vérifier le token via l'endpoint tokeninfo de Google
        let response = client
            .get("https://oauth2.googleapis.com/tokeninfo")
            .query(&[("id_token", id_token)])
            .send()
            .await
            .map_err(|e| AppError::ExternalService(format!("Failed to verify ID token: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Unauthorized(format!(
                "Invalid Google ID token: {}",
                error_text
            )));
        }

        #[derive(serde::Deserialize)]
        struct TokenInfo {
            email: String,
            name: Option<String>,
            given_name: Option<String>,
            family_name: Option<String>,
            picture: Option<String>,
            aud: String,
        }

        let token_info: TokenInfo = response.json().await.map_err(|e| {
            AppError::ExternalService(format!("Failed to parse token info: {}", e))
        })?;

        // Vérifier que le token est pour notre application
        if token_info.aud != self.google_config.client_id {
            return Err(AppError::Unauthorized(
                "ID token was not issued for this application".to_string()
            ));
        }

        // Construire le nom à partir des champs disponibles
        let name = token_info.name.unwrap_or_else(|| {
            match (&token_info.given_name, &token_info.family_name) {
                (Some(first), Some(last)) => format!("{} {}", first, last),
                (Some(first), None) => first.clone(),
                (None, Some(last)) => last.clone(),
                (None, None) => token_info.email.split('@').next().unwrap_or("User").to_string(),
            }
        });

        Ok(GoogleUserInfo {
            email: token_info.email,
            name,
            picture: token_info.picture,
        })
    }

    /// Génère un JWT pour un utilisateur authentifié
    pub fn generate_token(&self, email: &str, name: &str, is_admin: bool, impersonating: Option<ImpersonationInfo>) -> AppResult<String> {
        let exp = Utc::now() + Duration::hours(self.jwt_config.expiration_hours);
        let claims = Claims {
            sub: email.to_string(),
            email: email.to_string(),
            name: name.to_string(),
            exp: exp.timestamp(),
            is_admin,
            impersonating,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_config.secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("Failed to generate JWT: {}", e)))?;

        Ok(token)
    }

    /// Génère une réponse d'authentification complète
    pub fn generate_auth_response(&self, email: &str, name: &str, is_admin: bool, can_validate_competencies: bool) -> AppResult<AuthResponse> {
        let token = self.generate_token(email, name, is_admin, None)?;

        Ok(AuthResponse {
            token,
            email: email.to_string(),
            name: name.to_string(),
            is_admin,
            can_validate_competencies,
            impersonating: None,
        })
    }

    /// Génère un token d'impersonification
    pub fn generate_impersonation_token(
        &self, 
        admin_email: &str, 
        admin_name: &str,
        target_id: &str,
        target_email: &str, 
        target_name: &str,
        can_validate_competencies: bool,
    ) -> AppResult<ImpersonateResponse> {
        let impersonation = ImpersonationInfo {
            user_id: target_id.to_string(),
            user_email: target_email.to_string(),
            user_name: target_name.to_string(),
        };

        let token = self.generate_token(admin_email, admin_name, true, Some(impersonation.clone()))?;

        Ok(ImpersonateResponse {
            token,
            impersonating: impersonation,
            can_validate_competencies,
        })
    }

    pub fn verify_jwt(&self, token: &str) -> AppResult<Claims> {
        let mut validation = Validation::default();
        // Permettre les tokens sans impersonating (backward compat)
        validation.required_spec_claims.clear();
        
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_config.secret.as_bytes()),
            &validation,
        )
        .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

        Ok(token_data.claims)
    }

    pub fn get_client_id(&self) -> &str {
        &self.google_config.client_id
    }

    // ===== Password Authentication Methods =====

    /// Generate a random temporary password (6 alphanumeric characters)
    pub fn generate_temp_password() -> String {
        let mut rng = rand::thread_rng();
        const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars (0/O, 1/I/L)
        (0..6)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }

    /// Hash a password using Argon2
    pub fn hash_password(password: &str) -> AppResult<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))
    }

    /// Verify a password against a hash
    pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash: {}", e)))?;
        
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    /// Generate auth response with must_change_password flag
    pub fn generate_auth_response_with_password_status(
        &self, 
        email: &str, 
        name: &str, 
        is_admin: bool, 
        can_validate_competencies: bool,
        must_change_password: bool,
    ) -> AppResult<AuthResponseWithPasswordStatus> {
        let token = self.generate_token(email, name, is_admin, None)?;

        Ok(AuthResponseWithPasswordStatus {
            token,
            email: email.to_string(),
            name: name.to_string(),
            is_admin,
            can_validate_competencies,
            impersonating: None,
            must_change_password,
        })
    }
}

/// Extended auth response that includes password change requirement
#[derive(Debug, serde::Serialize)]
pub struct AuthResponseWithPasswordStatus {
    pub token: String,
    pub email: String,
    pub name: String,
    pub is_admin: bool,
    pub can_validate_competencies: bool,
    pub impersonating: Option<ImpersonationInfo>,
    pub must_change_password: bool,
}
