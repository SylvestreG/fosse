use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ImportJobs::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ImportJobs::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ImportJobs::SessionId).uuid().not_null())
                    .col(ColumnDef::new(ImportJobs::Filename).string().not_null())
                    .col(ColumnDef::new(ImportJobs::Status).string().not_null())
                    .col(ColumnDef::new(ImportJobs::TotalRows).integer().not_null())
                    .col(ColumnDef::new(ImportJobs::SuccessCount).integer().not_null().default(0))
                    .col(ColumnDef::new(ImportJobs::ErrorCount).integer().not_null().default(0))
                    .col(ColumnDef::new(ImportJobs::Errors).json())
                    .col(ColumnDef::new(ImportJobs::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(ImportJobs::UpdatedAt).timestamp().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_import_jobs_session")
                            .from(ImportJobs::Table, ImportJobs::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ImportJobs::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ImportJobs {
    Table,
    Id,
    SessionId,
    Filename,
    Status,
    TotalRows,
    SuccessCount,
    ErrorCount,
    Errors,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
}

