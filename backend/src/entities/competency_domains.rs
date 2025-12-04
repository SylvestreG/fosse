use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "competency_domains")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub diving_level: String,
    pub name: String,
    pub sort_order: i32,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::competency_modules::Entity")]
    Modules,
}

impl Related<super::competency_modules::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Modules.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

