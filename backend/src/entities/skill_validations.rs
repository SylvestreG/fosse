use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "skill_validations")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub person_id: Uuid,
    pub skill_id: Uuid,
    pub stage_id: Uuid,
    pub validated_at: Date,
    pub validated_by_id: Uuid,
    pub notes: Option<String>,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::people::Entity",
        from = "Column::PersonId",
        to = "super::people::Column::Id"
    )]
    Person,
    #[sea_orm(
        belongs_to = "super::people::Entity",
        from = "Column::ValidatedById",
        to = "super::people::Column::Id"
    )]
    ValidatedBy,
    #[sea_orm(
        belongs_to = "super::competency_skills::Entity",
        from = "Column::SkillId",
        to = "super::competency_skills::Column::Id"
    )]
    Skill,
    #[sea_orm(
        belongs_to = "super::validation_stages::Entity",
        from = "Column::StageId",
        to = "super::validation_stages::Column::Id"
    )]
    Stage,
}

impl Related<super::competency_skills::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Skill.def()
    }
}

impl Related<super::validation_stages::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Stage.def()
    }
}

// Note: Relations to people need specific link methods because there are two FKs
#[allow(dead_code)]
pub struct PersonLink;
impl Linked for PersonLink {
    type FromEntity = Entity;
    type ToEntity = super::people::Entity;

    fn link(&self) -> Vec<RelationDef> {
        vec![Relation::Person.def()]
    }
}

#[allow(dead_code)]
pub struct ValidatedByLink;
impl Linked for ValidatedByLink {
    type FromEntity = Entity;
    type ToEntity = super::people::Entity;

    fn link(&self) -> Vec<RelationDef> {
        vec![Relation::ValidatedBy.def()]
    }
}

impl ActiveModelBehavior for ActiveModel {}

