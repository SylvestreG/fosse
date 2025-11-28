use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(People::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(People::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(People::FirstName).string().not_null())
                    .col(ColumnDef::new(People::LastName).string().not_null())
                    .col(ColumnDef::new(People::Email).string().not_null())
                    .col(ColumnDef::new(People::Phone).string())
                    .col(ColumnDef::new(People::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(People::UpdatedAt).timestamp().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_people_email")
                    .table(People::Table)
                    .col(People::Email)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(People::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum People {
    Table,
    Id,
    FirstName,
    LastName,
    Email,
    Phone,
    CreatedAt,
    UpdatedAt,
}

