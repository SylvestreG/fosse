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
                    .add_column(
                        ColumnDef::new(Questionnaires::WantsRegulator)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Questionnaires::Table)
                    .drop_column(Questionnaires::WantsRegulator)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
enum Questionnaires {
    Table,
    WantsRegulator,
}

