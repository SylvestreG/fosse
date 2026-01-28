use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add sortie_id column (for sortie email invitations)
        manager
            .alter_table(
                Table::alter()
                    .table(EmailJobs::Table)
                    .add_column(ColumnDef::new(EmailJobs::SortieId).uuid().null())
                    .to_owned(),
            )
            .await?;

        // Add foreign key for sortie_id
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_email_jobs_sortie")
                    .from(EmailJobs::Table, EmailJobs::SortieId)
                    .to(Sorties::Table, Sorties::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Make session_id nullable (email can be for session OR sortie)
        manager
            .alter_table(
                Table::alter()
                    .table(EmailJobs::Table)
                    .modify_column(ColumnDef::new(EmailJobs::SessionId).uuid().null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Make session_id not null again
        manager
            .alter_table(
                Table::alter()
                    .table(EmailJobs::Table)
                    .modify_column(ColumnDef::new(EmailJobs::SessionId).uuid().not_null())
                    .to_owned(),
            )
            .await?;

        // Drop foreign key
        manager
            .drop_foreign_key(
                ForeignKey::drop()
                    .name("fk_email_jobs_sortie")
                    .table(EmailJobs::Table)
                    .to_owned(),
            )
            .await?;

        // Drop column
        manager
            .alter_table(
                Table::alter()
                    .table(EmailJobs::Table)
                    .drop_column(EmailJobs::SortieId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
enum EmailJobs {
    Table,
    SessionId,
    SortieId,
}

#[derive(Iden)]
enum Sorties {
    Table,
    Id,
}
