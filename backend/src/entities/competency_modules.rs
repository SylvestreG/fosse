use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "competency_modules")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub domain_id: Uuid,
    pub name: String,
    pub sort_order: i32,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::competency_domains::Entity",
        from = "Column::DomainId",
        to = "super::competency_domains::Column::Id"
    )]
    Domain,
    #[sea_orm(has_many = "super::competency_skills::Entity")]
    Skills,
}

impl Related<super::competency_domains::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Domain.def()
    }
}

impl Related<super::competency_skills::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Skills.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

