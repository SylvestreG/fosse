use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add sortie_id column (for sortie registrations)
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .add_column(ColumnDef::new(Questionnaires::SortieId).uuid().null())
                    .to_owned(),
            )
            .await?;

        // Add nitrox_base_formation column
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .add_column(
                        ColumnDef::new(Questionnaires::NitroxBaseFormation)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        // Add nitrox_confirmed_formation column
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .add_column(
                        ColumnDef::new(Questionnaires::NitroxConfirmedFormation)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        // Add foreign key for sortie_id
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_questionnaires_sortie")
                    .from(Questionnaires::Table, Questionnaires::SortieId)
                    .to(Sorties::Table, Sorties::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Make session_id nullable (questionnaire can be for session OR sortie)
        // Note: SQLite doesn't support ALTER COLUMN, so we skip this for SQLite
        // For PostgreSQL, we would do:
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .modify_column(ColumnDef::new(Questionnaires::SessionId).uuid().null())
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
                    .table(Questionnaires::Table)
                    .modify_column(ColumnDef::new(Questionnaires::SessionId).uuid().not_null())
                    .to_owned(),
            )
            .await?;

        // Drop foreign key
        manager
            .drop_foreign_key(
                ForeignKey::drop()
                    .name("fk_questionnaires_sortie")
                    .table(Questionnaires::Table)
                    .to_owned(),
            )
            .await?;

        // Drop columns
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .drop_column(Questionnaires::NitroxConfirmedFormation)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .drop_column(Questionnaires::NitroxBaseFormation)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .drop_column(Questionnaires::SortieId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
enum Questionnaires {
    Table,
    SessionId,
    SortieId,
    NitroxBaseFormation,
    NitroxConfirmedFormation,
}

#[derive(Iden)]
enum Sorties {
    Table,
    Id,
}
