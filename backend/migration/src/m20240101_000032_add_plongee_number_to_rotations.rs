use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Rotations::Table)
                    .add_column(
                        ColumnDef::new(Rotations::PlongeeNumber)
                            .integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Rotations::Table)
                    .drop_column(Rotations::PlongeeNumber)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
enum Rotations {
    Table,
    PlongeeNumber,
}
