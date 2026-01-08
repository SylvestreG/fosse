use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// Rôles dans la palanquée : "E" (Encadrant), "P" (Plongeur), "GP" (Guide de Palanquée)
// Stockés en String pour simplicité

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "palanquee_members")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub palanquee_id: Uuid,
    pub questionnaire_id: Uuid,
    pub role: String,     // E, P, GP
    pub gas_type: String, // Air, Nitrox, Trimix, Heliox
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::palanquees::Entity",
        from = "Column::PalanqueeId",
        to = "super::palanquees::Column::Id"
    )]
    Palanquee,
    #[sea_orm(
        belongs_to = "super::questionnaires::Entity",
        from = "Column::QuestionnaireId",
        to = "super::questionnaires::Column::Id"
    )]
    Questionnaire,
}

impl Related<super::palanquees::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Palanquee.def()
    }
}

impl Related<super::questionnaires::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Questionnaire.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

