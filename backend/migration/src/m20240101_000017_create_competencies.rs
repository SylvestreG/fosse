use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Competencies::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Competencies::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Competencies::Level)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Competencies::Name)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Competencies::Description)
                            .text()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(Competencies::SortOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Competencies::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Competencies::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Create index on level for faster queries
        manager
            .create_index(
                Index::create()
                    .name("idx_competencies_level")
                    .table(Competencies::Table)
                    .col(Competencies::Level)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Competencies::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Competencies {
    Table,
    Id,
    Level,
    Name,
    Description,
    SortOrder,
    CreatedAt,
    UpdatedAt,
}

