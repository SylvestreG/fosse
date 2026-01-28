use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "dive_directors")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub session_id: Uuid,
    pub questionnaire_id: Uuid,
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::sessions::Entity",
        from = "Column::SessionId",
        to = "super::sessions::Column::Id"
    )]
    Session,
    #[sea_orm(
        belongs_to = "super::questionnaires::Entity",
        from = "Column::QuestionnaireId",
        to = "super::questionnaires::Column::Id"
    )]
    Questionnaire,
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl Related<super::questionnaires::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Questionnaire.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
