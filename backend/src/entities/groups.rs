use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "groups")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub group_type: String,
    pub description: Option<String>,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::group_permissions::Entity")]
    GroupPermissions,
    #[sea_orm(has_many = "super::people::Entity")]
    People,
}

impl Related<super::group_permissions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::GroupPermissions.def()
    }
}

impl Related<super::people::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::People.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

