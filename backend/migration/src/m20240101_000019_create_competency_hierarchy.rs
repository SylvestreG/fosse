use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 1. Create validation_stages table (étapes de validation configurables)
        manager
            .create_table(
                Table::create()
                    .table(ValidationStages::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ValidationStages::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::Code)
                            .string_len(50)
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::Name)
                            .string_len(100)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::Description)
                            .text()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::Color)
                            .string_len(20)
                            .not_null()
                            .default("#6B7280"),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::Icon)
                            .string_len(10)
                            .not_null()
                            .default("⏳"),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::SortOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::IsFinal)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ValidationStages::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // 2. Create competency_domains table (COMMUNES, PE40, PA20, etc.)
        manager
            .create_table(
                Table::create()
                    .table(CompetencyDomains::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CompetencyDomains::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(CompetencyDomains::DivingLevel)
                            .string_len(10)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencyDomains::Name)
                            .string_len(255)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencyDomains::SortOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(CompetencyDomains::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencyDomains::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Index on diving_level for faster queries
        manager
            .create_index(
                Index::create()
                    .name("idx_competency_domains_diving_level")
                    .table(CompetencyDomains::Table)
                    .col(CompetencyDomains::DivingLevel)
                    .to_owned(),
            )
            .await?;

        // 3. Create competency_modules table (les grands groupes dans un domaine)
        manager
            .create_table(
                Table::create()
                    .table(CompetencyModules::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CompetencyModules::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(CompetencyModules::DomainId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencyModules::Name)
                            .string_len(255)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencyModules::SortOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(CompetencyModules::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencyModules::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_modules_domain")
                            .from(CompetencyModules::Table, CompetencyModules::DomainId)
                            .to(CompetencyDomains::Table, CompetencyDomains::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_competency_modules_domain")
                    .table(CompetencyModules::Table)
                    .col(CompetencyModules::DomainId)
                    .to_owned(),
            )
            .await?;

        // 4. Create competency_skills table (les acquis individuels à valider)
        manager
            .create_table(
                Table::create()
                    .table(CompetencySkills::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CompetencySkills::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(CompetencySkills::ModuleId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencySkills::Name)
                            .string_len(255)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencySkills::SortOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    // Niveau minimum du validateur requis (ex: "E2", "E3", "N4")
                    .col(
                        ColumnDef::new(CompetencySkills::MinValidatorLevel)
                            .string_len(10)
                            .not_null()
                            .default("E2"),
                    )
                    .col(
                        ColumnDef::new(CompetencySkills::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CompetencySkills::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_skills_module")
                            .from(CompetencySkills::Table, CompetencySkills::ModuleId)
                            .to(CompetencyModules::Table, CompetencyModules::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_competency_skills_module")
                    .table(CompetencySkills::Table)
                    .col(CompetencySkills::ModuleId)
                    .to_owned(),
            )
            .await?;

        // 5. Create skill_validations table (progression d'un user sur une skill)
        manager
            .create_table(
                Table::create()
                    .table(SkillValidations::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(SkillValidations::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::PersonId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::SkillId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::StageId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::ValidatedAt)
                            .date()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::ValidatedById)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::Notes)
                            .text()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SkillValidations::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_validations_person")
                            .from(SkillValidations::Table, SkillValidations::PersonId)
                            .to(People::Table, People::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_validations_skill")
                            .from(SkillValidations::Table, SkillValidations::SkillId)
                            .to(CompetencySkills::Table, CompetencySkills::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_validations_stage")
                            .from(SkillValidations::Table, SkillValidations::StageId)
                            .to(ValidationStages::Table, ValidationStages::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_validations_validated_by")
                            .from(SkillValidations::Table, SkillValidations::ValidatedById)
                            .to(People::Table, People::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Unique constraint: one validation per person per skill
        manager
            .create_index(
                Index::create()
                    .name("idx_skill_validations_unique")
                    .table(SkillValidations::Table)
                    .col(SkillValidations::PersonId)
                    .col(SkillValidations::SkillId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_skill_validations_person")
                    .table(SkillValidations::Table)
                    .col(SkillValidations::PersonId)
                    .to_owned(),
            )
            .await?;

        // 6. Insert default validation stages
        let insert_stages = r#"
            INSERT INTO validation_stages (id, code, name, description, color, icon, sort_order, is_final, created_at, updated_at) VALUES
            ('a1000000-0000-0000-0000-000000000001', 'VU_PISCINE', 'Vu - en piscine', 'Compétence observée en piscine/fosse', '#3B82F6', '👀', 1, false, NOW(), NOW()),
            ('a1000000-0000-0000-0000-000000000002', 'A_PERFECTIONNER', 'À perfectionner', 'Nécessite encore du travail', '#F59E0B', '🔄', 2, false, NOW(), NOW()),
            ('a1000000-0000-0000-0000-000000000003', 'ACQUIS_PISCINE', 'Acquis - en piscine', 'Compétence acquise en piscine/fosse', '#10B981', '✅', 3, false, NOW(), NOW()),
            ('a1000000-0000-0000-0000-000000000004', 'A_RETRAVAILLER_MER', 'À retravailler en mer', 'À revoir en conditions réelles', '#EF4444', '🌊', 4, false, NOW(), NOW()),
            ('a1000000-0000-0000-0000-000000000005', 'VALIDE_MER', 'Validé en mer', 'Compétence validée en conditions réelles', '#059669', '🏆', 5, true, NOW(), NOW())
        "#;
        
        manager.get_connection().execute_unprepared(insert_stages).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(SkillValidations::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(CompetencySkills::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(CompetencyModules::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(CompetencyDomains::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(ValidationStages::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum ValidationStages {
    Table,
    Id,
    Code,
    Name,
    Description,
    Color,
    Icon,
    SortOrder,
    IsFinal,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum CompetencyDomains {
    Table,
    Id,
    DivingLevel,
    Name,
    SortOrder,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum CompetencyModules {
    Table,
    Id,
    DomainId,
    Name,
    SortOrder,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum CompetencySkills {
    Table,
    Id,
    ModuleId,
    Name,
    SortOrder,
    MinValidatorLevel,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SkillValidations {
    Table,
    Id,
    PersonId,
    SkillId,
    StageId,
    ValidatedAt,
    ValidatedById,
    Notes,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum People {
    Table,
    Id,
}

