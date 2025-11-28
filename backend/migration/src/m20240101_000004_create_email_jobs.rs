use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(EmailJobs::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(EmailJobs::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(EmailJobs::SessionId).uuid().not_null())
                    .col(ColumnDef::new(EmailJobs::PersonId).uuid().not_null())
                    .col(ColumnDef::new(EmailJobs::QuestionnaireToken).uuid().not_null())
                    .col(ColumnDef::new(EmailJobs::Status).string().not_null())
                    .col(ColumnDef::new(EmailJobs::RetryCount).integer().not_null().default(0))
                    .col(ColumnDef::new(EmailJobs::SentAt).timestamp())
                    .col(ColumnDef::new(EmailJobs::ExpiresAt).timestamp().not_null())
                    .col(ColumnDef::new(EmailJobs::Consumed).boolean().not_null().default(false))
                    .col(ColumnDef::new(EmailJobs::ErrorMessage).text())
                    .col(ColumnDef::new(EmailJobs::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(EmailJobs::UpdatedAt).timestamp().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_email_jobs_session")
                            .from(EmailJobs::Table, EmailJobs::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_email_jobs_person")
                            .from(EmailJobs::Table, EmailJobs::PersonId)
                            .to(People::Table, People::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_jobs_token")
                    .table(EmailJobs::Table)
                    .col(EmailJobs::QuestionnaireToken)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(EmailJobs::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum EmailJobs {
    Table,
    Id,
    SessionId,
    PersonId,
    QuestionnaireToken,
    Status,
    RetryCount,
    SentAt,
    ExpiresAt,
    Consumed,
    ErrorMessage,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum People {
    Table,
    Id,
}

