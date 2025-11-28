use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .add_column(ColumnDef::new(Questionnaires::ComesFromIssoire).boolean().not_null().default(true))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .drop_column(Questionnaires::ComesFromIssoire)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Questionnaires {
    Table,
    ComesFromIssoire,
}

