use crate::config::{GoogleOAuthConfig, JwtConfig};
use crate::errors::{AppError, AppResult};
use crate::models::{AuthResponse, Claims, GoogleTokenResponse, GoogleUserInfo};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

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

    pub async fn handle_google_callback(&self, code: String) -> AppResult<AuthResponse> {
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

        // Check if user is admin
        if !self.admin_emails.contains(&user_info.email) {
            return Err(AppError::Forbidden("User is not an admin".to_string()));
        }

        // Generate JWT
        let exp = Utc::now() + Duration::hours(self.jwt_config.expiration_hours);
        let claims = Claims {
            sub: user_info.email.clone(),
            email: user_info.email.clone(),
            name: user_info.name.clone(),
            exp: exp.timestamp(),
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_config.secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("Failed to generate JWT: {}", e)))?;

        Ok(AuthResponse {
            token,
            email: user_info.email,
            name: user_info.name,
        })
    }

    pub fn verify_jwt(&self, token: &str) -> AppResult<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_config.secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

        Ok(token_data.claims)
    }

    pub fn get_client_id(&self) -> &str {
        &self.google_config.client_id
    }
}

