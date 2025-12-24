use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Table pour stocker les templates PDF par niveau
        manager
            .create_table(
                Table::create()
                    .table(LevelDocuments::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(LevelDocuments::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(LevelDocuments::Level)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(LevelDocuments::FileName)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(LevelDocuments::FileData)
                            .binary()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(LevelDocuments::PageCount)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .col(
                        ColumnDef::new(LevelDocuments::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(LevelDocuments::UpdatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Table pour les positions des acquis sur le document
        manager
            .create_table(
                Table::create()
                    .table(SkillDocumentPositions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(SkillDocumentPositions::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::SkillId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::Level)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::Page)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::X)
                            .float()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::Y)
                            .float()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::Width)
                            .float()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::Height)
                            .float()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::FontSize)
                            .float()
                            .not_null()
                            .default(8.0),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillDocumentPositions::UpdatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Index unique sur skill_id + level
        manager
            .create_index(
                Index::create()
                    .name("idx_skill_document_positions_skill_level")
                    .table(SkillDocumentPositions::Table)
                    .col(SkillDocumentPositions::SkillId)
                    .col(SkillDocumentPositions::Level)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // Foreign key vers competency_skills
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_skill_document_positions_skill")
                    .from(SkillDocumentPositions::Table, SkillDocumentPositions::SkillId)
                    .to(CompetencySkills::Table, CompetencySkills::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(SkillDocumentPositions::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(LevelDocuments::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum LevelDocuments {
    Table,
    Id,
    Level,
    FileName,
    FileData,
    PageCount,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SkillDocumentPositions {
    Table,
    Id,
    SkillId,
    Level,
    Page,
    X,
    Y,
    Width,
    Height,
    FontSize,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum CompetencySkills {
    Table,
    Id,
}

