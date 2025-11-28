use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(EmailJobs::Table)
                    .add_column(ColumnDef::new(EmailJobs::EmailSubject).string())
                    .add_column(ColumnDef::new(EmailJobs::EmailBody).text())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(EmailJobs::Table)
                    .drop_column(EmailJobs::EmailSubject)
                    .drop_column(EmailJobs::EmailBody)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum EmailJobs {
    Table,
    EmailSubject,
    EmailBody,
}

