use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add password authentication fields to people table
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .add_column(
                        ColumnDef::new(People::PasswordHash)
                            .string()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(People::TempPassword)
                            .string()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(People::TempPasswordExpiresAt)
                            .timestamp()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(People::MustChangePassword)
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
                    .table(People::Table)
                    .drop_column(People::PasswordHash)
                    .drop_column(People::TempPassword)
                    .drop_column(People::TempPasswordExpiresAt)
                    .drop_column(People::MustChangePassword)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
enum People {
    Table,
    PasswordHash,
    TempPassword,
    TempPasswordExpiresAt,
    MustChangePassword,
}

