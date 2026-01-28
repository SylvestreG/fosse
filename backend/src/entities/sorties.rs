use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "sorties")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub location: String,
    pub sortie_type: String, // "exploration" or "technique"
    pub days_count: i32,
    pub dives_per_day: i32,
    pub nitrox_compatible: bool,
    pub start_date: Date,
    pub end_date: Date,
    pub description: Option<String>,
    pub summary_token: Option<Uuid>,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::sessions::Entity")]
    Sessions,
    #[sea_orm(has_many = "super::questionnaires::Entity")]
    Questionnaires,
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Sessions.def()
    }
}

impl Related<super::questionnaires::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Questionnaires.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
