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
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultIsEncadrant)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultWantsRegulator)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultWantsNitrox)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultWants2ndReg)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultWantsStab)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(People::DefaultStabSize)
                            .string()
                            .null(),
                    )
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

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .drop_column(People::DefaultIsEncadrant)
                    .drop_column(People::DefaultWantsRegulator)
                    .drop_column(People::DefaultWantsNitrox)
                    .drop_column(People::DefaultWants2ndReg)
                    .drop_column(People::DefaultWantsStab)
                    .drop_column(People::DefaultStabSize)
                    .drop_column(People::DefaultComesFromIssoire)
                    .drop_column(People::DefaultHasCar)
                    .drop_column(People::DefaultCarSeats)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum People {
    Table,
    DefaultIsEncadrant,
    DefaultWantsRegulator,
    DefaultWantsNitrox,
    DefaultWants2ndReg,
    DefaultWantsStab,
    DefaultStabSize,
    DefaultComesFromIssoire,
    DefaultHasCar,
    DefaultCarSeats,
}

