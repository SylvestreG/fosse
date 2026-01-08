use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "palanquees")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub rotation_id: Uuid,
    pub number: i32,
    pub call_sign: Option<String>,
    // Paramètres prévus
    pub planned_departure_time: Option<Time>,
    pub planned_time: Option<i32>,  // Durée prévue en minutes
    pub planned_depth: Option<i32>, // Profondeur prévue en mètres
    // Paramètres réalisés
    pub actual_departure_time: Option<Time>,
    pub actual_return_time: Option<Time>,
    pub actual_time: Option<i32>,   // Durée réalisée en minutes
    pub actual_depth: Option<i32>,  // Profondeur réalisée en mètres
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::rotations::Entity",
        from = "Column::RotationId",
        to = "super::rotations::Column::Id"
    )]
    Rotation,
    #[sea_orm(has_many = "super::palanquee_members::Entity")]
    Members,
}

impl Related<super::rotations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Rotation.def()
    }
}

impl Related<super::palanquee_members::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Members.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

