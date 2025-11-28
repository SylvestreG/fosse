use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Sessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Sessions::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Sessions::Name).string().not_null())
                    .col(ColumnDef::new(Sessions::StartDate).date().not_null())
                    .col(ColumnDef::new(Sessions::EndDate).date().not_null())
                    .col(ColumnDef::new(Sessions::Location).string())
                    .col(ColumnDef::new(Sessions::Description).text())
                    .col(ColumnDef::new(Sessions::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(Sessions::UpdatedAt).timestamp().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Sessions::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
    Name,
    StartDate,
    EndDate,
    Location,
    Description,
    CreatedAt,
    UpdatedAt,
}

