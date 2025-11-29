use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .add_column(
                        ColumnDef::new(People::DivingLevel)
                            .string()
                            .null()
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .drop_column(People::DivingLevel)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum People {
    Table,
    DivingLevel,
}

