use crate::entities::prelude::*;
use crate::entities::{groups, group_permissions};
use crate::errors::AppError;
use crate::models::{Permission, PermissionInfo, GroupResponse, UpdateGroupPermissionsRequest};
use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use sea_orm::*;
use std::sync::Arc;
use uuid::Uuid;

/// Liste toutes les permissions disponibles
pub async fn list_permissions() -> Json<Vec<PermissionInfo>> {
    let permissions: Vec<PermissionInfo> = Permission::all()
        .into_iter()
        .map(|p| p.into())
        .collect();
    Json(permissions)
}

/// Liste tous les groupes avec leurs permissions
pub async fn list_groups(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<GroupResponse>>, AppError> {
    let groups_list = Groups::find()
        .order_by_asc(groups::Column::Name)
        .all(db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query groups: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query groups: {}", e)))
        })?;

    let mut response = Vec::new();
    for group in groups_list {
        let permissions = GroupPermissions::find()
            .filter(group_permissions::Column::GroupId.eq(group.id))
            .all(db.as_ref())
            .await
            .map_err(|e| {
                tracing::error!("Failed to query group permissions: {:?}", e);
                AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query permissions: {}", e)))
            })?;

        let perm_strings: Vec<String> = permissions.iter().map(|p| p.permission.clone()).collect();

        response.push(GroupResponse {
            id: group.id,
            name: group.name,
            group_type: group.group_type,
            description: group.description,
            permissions: perm_strings,
            created_at: group.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: group.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        });
    }

    Ok(Json(response))
}

/// Récupère un groupe par ID
pub async fn get_group(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
) -> Result<Json<GroupResponse>, AppError> {
    let group = Groups::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query group".to_string())))?
        .ok_or(AppError::NotFound("Groupe non trouvé".to_string()))?;

    let permissions = GroupPermissions::find()
        .filter(group_permissions::Column::GroupId.eq(group.id))
        .all(db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query group permissions: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query permissions: {}", e)))
        })?;

    let perm_strings: Vec<String> = permissions.iter().map(|p| p.permission.clone()).collect();

    Ok(Json(GroupResponse {
        id: group.id,
        name: group.name,
        group_type: group.group_type,
        description: group.description,
        permissions: perm_strings,
        created_at: group.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: group.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

/// Met à jour les permissions d'un groupe
pub async fn update_group_permissions(
    State(db): State<Arc<DatabaseConnection>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGroupPermissionsRequest>,
) -> Result<Json<GroupResponse>, AppError> {
    // Vérifier que le groupe existe
    let group = Groups::find_by_id(id)
        .one(db.as_ref())
        .await
        .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query group".to_string())))?
        .ok_or(AppError::NotFound("Groupe non trouvé".to_string()))?;

    // Valider toutes les permissions
    let valid_permissions: Vec<Permission> = payload.permissions
        .iter()
        .filter_map(|p| Permission::parse(p))
        .collect();

    if valid_permissions.len() != payload.permissions.len() {
        return Err(AppError::Validation("Certaines permissions sont invalides".to_string()));
    }

    // Supprimer les anciennes permissions
    group_permissions::Entity::delete_many()
        .filter(group_permissions::Column::GroupId.eq(id))
        .exec(db.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete old permissions: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to delete permissions: {}", e)))
        })?;

    // Ajouter les nouvelles permissions
    let now = Utc::now().naive_utc();
    for perm in &valid_permissions {
        let new_perm = group_permissions::ActiveModel {
            id: Set(Uuid::new_v4()),
            group_id: Set(id),
            permission: Set(perm.as_str().to_string()),
            created_at: Set(now),
        };
        new_perm.insert(db.as_ref()).await.map_err(|e| {
            tracing::error!("Failed to insert permission: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to insert permission: {}", e)))
        })?;
    }

    // Mettre à jour updated_at du groupe
    let mut group_active: groups::ActiveModel = group.into();
    group_active.updated_at = Set(now);
    let updated_group = group_active.update(db.as_ref()).await.map_err(|e| {
        tracing::error!("Failed to update group: {:?}", e);
        AppError::Database(sea_orm::DbErr::Custom(format!("Failed to update group: {}", e)))
    })?;

    let perm_strings: Vec<String> = valid_permissions.iter().map(|p| p.as_str().to_string()).collect();

    Ok(Json(GroupResponse {
        id: updated_group.id,
        name: updated_group.name,
        group_type: updated_group.group_type,
        description: updated_group.description,
        permissions: perm_strings,
        created_at: updated_group.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: updated_group.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

/// Helper: récupère les permissions d'un utilisateur par son email
#[allow(dead_code)]
pub async fn get_user_permissions(
    db: &DatabaseConnection,
    email: &str,
) -> Result<Vec<Permission>, AppError> {
    // Trouver l'utilisateur par email
    let person = People::find()
        .filter(crate::entities::people::Column::Email.eq(email))
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query person: {:?}", e);
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })?;

    let Some(person) = person else {
        // Si pas d'utilisateur trouvé, retourner permissions vides
        return Ok(Vec::new());
    };

    let Some(group_id) = person.group_id else {
        // Si pas de groupe assigné, retourner permissions vides
        return Ok(Vec::new());
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_validation() {
        // Valid permissions
        assert!(Permission::parse("sessions_view").is_some());
        assert!(Permission::parse("users_edit").is_some());
        
        // Invalid permissions
        assert!(Permission::parse("invalid_perm").is_none());
        assert!(Permission::parse("").is_none());
    }
}

