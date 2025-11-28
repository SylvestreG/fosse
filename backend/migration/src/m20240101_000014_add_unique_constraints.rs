use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 1. Add unique constraint on people.email
        manager
            .create_index(
                Index::create()
                    .name("idx_people_email_unique")
                    .table(People::Table)
                    .col(People::Email)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // 2. Add unique constraint on questionnaires(session_id, person_id)
        // to prevent duplicate enrollments
        manager
            .create_index(
                Index::create()
                    .name("idx_questionnaires_session_person_unique")
                    .table(Questionnaires::Table)
                    .col(Questionnaires::SessionId)
                    .col(Questionnaires::PersonId)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop the unique indexes
        manager
            .drop_index(
                Index::drop()
                    .name("idx_questionnaires_session_person_unique")
                    .table(Questionnaires::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_people_email_unique")
                    .table(People::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum People {
    Table,
    Email,
}

#[derive(DeriveIden)]
enum Questionnaires {
    Table,
    SessionId,
    PersonId,
}

