use crate::entities::prelude::*;
use crate::entities::{group_permissions, people};
use crate::errors::AppError;
use crate::models::{Claims, Permission};
use crate::services::AuthService;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use sea_orm::*;
use std::sync::Arc;

/// Extension pour stocker les infos d'auth avec permissions
#[derive(Clone)]
pub struct AuthUser {
    #[allow(dead_code)]
    pub claims: Claims,
    pub permissions: Vec<Permission>,
}

impl AuthUser {
    #[allow(dead_code)]
    pub fn has_permission(&self, perm: Permission) -> bool {
        self.permissions.contains(&perm)
    }

    #[allow(dead_code)]
    pub fn has_any_permission(&self, perms: &[Permission]) -> bool {
        perms.iter().any(|p| self.permissions.contains(p))
    }
}

/// State pour le middleware ACL
#[derive(Clone)]
pub struct AclState {
    pub auth_service: Arc<AuthService>,
    pub db: Arc<DatabaseConnection>,
}

/// Middleware qui authentifie et charge les permissions
pub async fn acl_auth_middleware(
    State(state): State<AclState>,
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

    let claims = state.auth_service
        .verify_jwt(token)
        .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    // Récupérer les permissions de l'utilisateur
    let permissions = get_permissions_for_email(&state.db, &claims.email).await?;

    request.extensions_mut().insert(AuthUser { claims, permissions });

    Ok(next.run(request).await)
}

/// Récupère les permissions d'un utilisateur par email
async fn get_permissions_for_email(
    db: &DatabaseConnection,
    email: &str,
) -> Result<Vec<Permission>, AppError> {
    // Trouver l'utilisateur par email
    let person = People::find()
        .filter(people::Column::Email.eq(email))
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query person: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })?;

    let Some(person) = person else {
        // Si utilisateur pas trouvé mais authentifié via Google OAuth admin,
        // on lui donne toutes les permissions admin par défaut
        return Ok(Permission::all());
    };

    let Some(group_id) = person.group_id else {
        // Si pas de groupe, permissions admin par défaut si l'email est dans les admins config
        // (comportement legacy pour compatibilité)
        return Ok(Permission::all());
    };

    // Récupérer les permissions du groupe
    let permissions = GroupPermissions::find()
        .filter(group_permissions::Column::GroupId.eq(group_id))
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query permissions: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query permissions: {}", e)))
        })?;

    let perms: Vec<Permission> = permissions
        .iter()
        .filter_map(|p| Permission::parse(&p.permission))
        .collect();

    Ok(perms)
}

/// Macro pour créer un middleware qui vérifie une permission spécifique
#[macro_export]
macro_rules! require_permission {
    ($perm:expr) => {
        |auth: axum::Extension<$crate::middleware::acl::AuthUser>| async move {
            if !auth.has_permission($perm) {
                return Err($crate::errors::AppError::Forbidden(
                    format!("Permission requise: {}", $perm.description())
                ));
            }
            Ok(())
        }
    };
}

/// Helper pour vérifier une permission depuis un handler
#[allow(dead_code)]
pub fn check_permission(auth: &AuthUser, perm: Permission) -> Result<(), AppError> {
    if auth.has_permission(perm) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "Permission requise: {}",
            perm.description()
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_user_has_permission() {
        let auth = AuthUser {
            claims: Claims {
                sub: "test".to_string(),
                email: "test@example.com".to_string(),
                name: "Test User".to_string(),
                exp: 0,
                is_admin: false,
                impersonating: None,
            },
            permissions: vec![Permission::SessionsView, Permission::UsersView],
        };

        assert!(auth.has_permission(Permission::SessionsView));
        assert!(auth.has_permission(Permission::UsersView));
        assert!(!auth.has_permission(Permission::SessionsCreate));
    }

    #[test]
    fn test_auth_user_has_any_permission() {
        let auth = AuthUser {
            claims: Claims {
                sub: "test".to_string(),
                email: "test@example.com".to_string(),
                name: "Test User".to_string(),
                exp: 0,
                is_admin: false,
                impersonating: None,
            },
            permissions: vec![Permission::SessionsView],
        };

        assert!(auth.has_any_permission(&[Permission::SessionsView, Permission::SessionsCreate]));
        assert!(!auth.has_any_permission(&[Permission::UsersEdit, Permission::UsersDelete]));
    }

    #[test]
    fn test_check_permission_success() {
        let auth = AuthUser {
            claims: Claims {
                sub: "test".to_string(),
                email: "test@example.com".to_string(),
                name: "Test User".to_string(),
                exp: 0,
                is_admin: false,
                impersonating: None,
            },
            permissions: vec![Permission::SessionsView],
        };

        assert!(check_permission(&auth, Permission::SessionsView).is_ok());
    }

    #[test]
    fn test_check_permission_denied() {
        let auth = AuthUser {
            claims: Claims {
                sub: "test".to_string(),
                email: "test@example.com".to_string(),
                name: "Test User".to_string(),
                exp: 0,
                is_admin: false,
                impersonating: None,
            },
            permissions: vec![Permission::SessionsView],
        };

        let result = check_permission(&auth, Permission::SessionsCreate);
        assert!(result.is_err());
    }
}

