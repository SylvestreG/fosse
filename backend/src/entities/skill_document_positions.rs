use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "skill_document_positions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub skill_id: Uuid,
    pub level: String,
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub font_size: f32,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::competency_skills::Entity",
        from = "Column::SkillId",
        to = "super::competency_skills::Column::Id"
    )]
    CompetencySkill,
}

impl Related<super::competency_skills::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CompetencySkill.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

// DTO pour la création/mise à jour
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SkillPositionInput {
    pub skill_id: Uuid,
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    #[serde(default = "default_font_size")]
    pub font_size: f32,
}

fn default_font_size() -> f32 {
    8.0
}

// DTO étendu avec infos du skill
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SkillPositionWithInfo {
    pub id: Uuid,
    pub skill_id: Uuid,
    pub skill_name: String,
    pub skill_number: i32,
    pub module_name: String,
    pub domain_name: String,
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub font_size: f32,
}

