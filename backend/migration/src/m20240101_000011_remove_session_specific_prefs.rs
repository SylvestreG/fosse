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
                    .drop_column(People::DefaultComesFromIssoire)
                    .drop_column(People::DefaultHasCar)
                    .drop_column(People::DefaultCarSeats)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultComesFromIssoire)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultHasCar)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultCarSeats)
                            .integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum People {
    Table,
    DefaultComesFromIssoire,
    DefaultHasCar,
    DefaultCarSeats,
}

