use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "level_documents")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub level: String,
    pub file_name: String,
    #[serde(skip_serializing)]
    pub file_data: Vec<u8>,
    pub page_count: i32,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// DTO pour la réponse API (sans le fichier binaire)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LevelDocumentInfo {
    pub id: Uuid,
    pub level: String,
    pub file_name: String,
    pub page_count: i32,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

impl From<Model> for LevelDocumentInfo {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,
            level: model.level,
            file_name: model.file_name,
            page_count: model.page_count,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}

