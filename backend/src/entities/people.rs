use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "people")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub default_is_encadrant: bool,
    pub default_wants_regulator: bool,
    pub default_wants_nitrox: bool,
    #[sea_orm(column_name = "default_wants2nd_reg")]
    pub default_wants_2nd_reg: bool,
    pub default_wants_stab: bool,
    pub default_stab_size: Option<String>,
    pub diving_level: Option<String>,
    pub group_id: Option<Uuid>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    #[serde(skip_serializing)]
    pub temp_password: Option<String>,
    #[serde(skip_serializing)]
    pub temp_password_expires_at: Option<DateTime>,
    pub must_change_password: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::questionnaires::Entity")]
    Questionnaires,
    #[sea_orm(has_many = "super::email_jobs::Entity")]
    EmailJobs,
    #[sea_orm(
        belongs_to = "super::groups::Entity",
        from = "Column::GroupId",
        to = "super::groups::Column::Id"
    )]
    Group,
}

impl Related<super::questionnaires::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Questionnaires.def()
    }
}

impl Related<super::email_jobs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::EmailJobs.def()
    }
}

impl Related<super::groups::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Group.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

