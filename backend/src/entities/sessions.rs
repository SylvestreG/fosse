use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "sessions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub start_date: Date,
    pub end_date: Option<Date>,
    pub location: Option<String>,
    pub description: Option<String>,
    pub summary_token: Option<Uuid>,
    pub optimization_mode: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::questionnaires::Entity")]
    Questionnaires,
    #[sea_orm(has_many = "super::import_jobs::Entity")]
    ImportJobs,
}

impl Related<super::questionnaires::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Questionnaires.def()
    }
}

impl Related<super::import_jobs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ImportJobs.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

