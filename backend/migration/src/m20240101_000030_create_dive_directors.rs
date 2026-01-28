use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create dive_directors table
        // This allows assigning different DPs per dive/session within a sortie
        manager
            .create_table(
                Table::create()
                    .table(DiveDirectors::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(DiveDirectors::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(DiveDirectors::SessionId).uuid().not_null())
                    .col(ColumnDef::new(DiveDirectors::QuestionnaireId).uuid().not_null())
                    .col(
                        ColumnDef::new(DiveDirectors::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(DiveDirectors::Table, DiveDirectors::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(DiveDirectors::Table, DiveDirectors::QuestionnaireId)
                            .to(Questionnaires::Table, Questionnaires::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create unique index to prevent duplicate DP assignments
        manager
            .create_index(
                Index::create()
                    .name("idx_dive_directors_unique")
                    .table(DiveDirectors::Table)
                    .col(DiveDirectors::SessionId)
                    .col(DiveDirectors::QuestionnaireId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(DiveDirectors::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum DiveDirectors {
    Table,
    Id,
    SessionId,
    QuestionnaireId,
    CreatedAt,
}

#[derive(Iden)]
enum Sessions {
    Table,
    Id,
}

#[derive(Iden)]
enum Questionnaires {
    Table,
    Id,
}
