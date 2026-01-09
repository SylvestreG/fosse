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
                        ColumnDef::new(Questionnaires::IsDirecteurPlongee)
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
                    .drop_column(Questionnaires::IsDirecteurPlongee)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
enum Questionnaires {
    Table,
    IsDirecteurPlongee,
}

