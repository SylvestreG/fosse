use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "validation_stages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: String,
    pub sort_order: i32,
    pub is_final: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::skill_validations::Entity")]
    SkillValidations,
}

impl Related<super::skill_validations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SkillValidations.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

