use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Sorties::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Sorties::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Sorties::Name).string().not_null())
                    .col(ColumnDef::new(Sorties::Location).string().not_null())
                    .col(ColumnDef::new(Sorties::SortieType).string().not_null()) // 'exploration' or 'technique'
                    .col(ColumnDef::new(Sorties::DaysCount).integer().not_null())
                    .col(ColumnDef::new(Sorties::DivesPerDay).integer().not_null())
                    .col(
                        ColumnDef::new(Sorties::NitroxCompatible)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(Sorties::StartDate).date().not_null())
                    .col(ColumnDef::new(Sorties::EndDate).date().not_null())
                    .col(ColumnDef::new(Sorties::Description).text())
                    .col(ColumnDef::new(Sorties::SummaryToken).uuid().unique_key())
                    .col(
                        ColumnDef::new(Sorties::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Sorties::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Sorties::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Sorties {
    Table,
    Id,
    Name,
    Location,
    SortieType,
    DaysCount,
    DivesPerDay,
    NitroxCompatible,
    StartDate,
    EndDate,
    Description,
    SummaryToken,
    CreatedAt,
    UpdatedAt,
}
