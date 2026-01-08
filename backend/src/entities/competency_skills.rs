use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "competency_skills")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub module_id: Uuid,
    pub name: String,
    /// Description optionnelle pour aider les encadrants lors de la validation
    pub description: Option<String>,
    pub sort_order: i32,
    /// Niveau minimum requis pour valider cette compétence (ex: "E2", "E3", "N4")
    pub min_validator_level: String,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::competency_modules::Entity",
        from = "Column::ModuleId",
        to = "super::competency_modules::Column::Id"
    )]
    Module,
    #[sea_orm(has_many = "super::skill_validations::Entity")]
    Validations,
}

impl Related<super::competency_modules::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Module.def()
    }
}

impl Related<super::skill_validations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Validations.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

