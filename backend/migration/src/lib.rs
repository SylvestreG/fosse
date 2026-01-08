pub use sea_orm_migration::prelude::*;

mod m20240101_000001_create_sessions;
mod m20240101_000002_create_people;
mod m20240101_000003_create_questionnaires;
mod m20240101_000004_create_email_jobs;
mod m20240101_000005_create_import_jobs;
mod m20240101_000006_add_email_content;
mod m20240101_000007_make_end_date_optional;
mod m20240101_000008_add_wants_regulator;
mod m20240101_000009_add_comes_from_issoire;
mod m20240101_000010_add_user_preferences;
mod m20240101_000011_remove_session_specific_prefs;
mod m20240101_000012_recreate_people_clean;
mod m20240101_000013_ensure_people_structure;
mod m20240101_000014_add_unique_constraints;
mod m20240101_000015_add_session_summary_token;
mod m20240101_000016_add_diving_level;
mod m20240101_000017_create_competencies;
mod m20240101_000018_create_groups_acl;
mod m20240101_000019_create_competency_hierarchy;
mod m20240101_000020_add_password_auth;
mod m20240101_000021_create_level_documents;
mod m20240101_000022_add_skill_description;
mod m20240101_000023_add_nitrox_training;
mod m20240101_000024_add_optimization_mode;
mod m20240101_000025_create_palanquees;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
        Box::new(m20240101_000001_create_sessions::Migration),
        Box::new(m20240101_000002_create_people::Migration),
        Box::new(m20240101_000003_create_questionnaires::Migration),
        Box::new(m20240101_000004_create_email_jobs::Migration),
        Box::new(m20240101_000005_create_import_jobs::Migration),
        Box::new(m20240101_000006_add_email_content::Migration),
        Box::new(m20240101_000007_make_end_date_optional::Migration),
        Box::new(m20240101_000008_add_wants_regulator::Migration),
        Box::new(m20240101_000009_add_comes_from_issoire::Migration),
        Box::new(m20240101_000010_add_user_preferences::Migration),
        Box::new(m20240101_000011_remove_session_specific_prefs::Migration),
        Box::new(m20240101_000012_recreate_people_clean::Migration),
        Box::new(m20240101_000013_ensure_people_structure::Migration),
        Box::new(m20240101_000014_add_unique_constraints::Migration),
        Box::new(m20240101_000015_add_session_summary_token::Migration),
        Box::new(m20240101_000016_add_diving_level::Migration),
        Box::new(m20240101_000017_create_competencies::Migration),
        Box::new(m20240101_000018_create_groups_acl::Migration),
        Box::new(m20240101_000019_create_competency_hierarchy::Migration),
        Box::new(m20240101_000020_add_password_auth::Migration),
        Box::new(m20240101_000021_create_level_documents::Migration),
        Box::new(m20240101_000022_add_skill_description::Migration),
        Box::new(m20240101_000023_add_nitrox_training::Migration),
        Box::new(m20240101_000024_add_optimization_mode::Migration),
        Box::new(m20240101_000025_create_palanquees::Migration),
        ]
    }
}

