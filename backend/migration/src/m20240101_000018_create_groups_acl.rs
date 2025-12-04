use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create groups table
        manager
            .create_table(
                Table::create()
                    .table(Groups::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Groups::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Groups::Name)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(Groups::GroupType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Groups::Description)
                            .text()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(Groups::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Groups::UpdatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Create group_permissions table (many-to-many: group has many permissions)
        manager
            .create_table(
                Table::create()
                    .table(GroupPermissions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(GroupPermissions::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(GroupPermissions::GroupId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(GroupPermissions::Permission)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(GroupPermissions::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_group_permissions_group")
                            .from(GroupPermissions::Table, GroupPermissions::GroupId)
                            .to(Groups::Table, Groups::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create unique index on (group_id, permission)
        manager
            .create_index(
                Index::create()
                    .name("idx_group_permissions_unique")
                    .table(GroupPermissions::Table)
                    .col(GroupPermissions::GroupId)
                    .col(GroupPermissions::Permission)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // Add group_id to people table
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .add_column(
                        ColumnDef::new(People::GroupId)
                            .uuid()
                            .null(),
                    )
                    .add_foreign_key(
                        TableForeignKey::new()
                            .name("fk_people_group")
                            .from_tbl(People::Table)
                            .from_col(People::GroupId)
                            .to_tbl(Groups::Table)
                            .to_col(Groups::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // Insert default groups and permissions using raw SQL
        let db = manager.get_connection();
        
        // Insert groups
        db.execute_unprepared(r#"
            INSERT INTO groups (id, name, group_type, description, created_at, updated_at)
            VALUES 
                (gen_random_uuid(), 'Administrateur', 'admin', 'Accès complet à toutes les fonctionnalités', NOW(), NOW()),
                (gen_random_uuid(), 'Encadrant', 'encadrant', 'Peut gérer les sessions et les élèves', NOW(), NOW()),
                (gen_random_uuid(), 'Élève', 'eleve', 'Accès en lecture aux sessions et compétences', NOW(), NOW())
        "#).await?;

        // Insert admin permissions
        db.execute_unprepared(r#"
            INSERT INTO group_permissions (id, group_id, permission, created_at)
            SELECT gen_random_uuid(), g.id, p.perm, NOW()
            FROM groups g
            CROSS JOIN (
                VALUES 
                    ('sessions_view'), ('sessions_create'), ('sessions_edit'), ('sessions_delete'),
                    ('questionnaires_view'), ('questionnaires_edit'), ('questionnaires_delete'),
                    ('users_view'), ('users_create'), ('users_edit'), ('users_delete'),
                    ('competencies_view'), ('competencies_create'), ('competencies_edit'), ('competencies_delete'),
                    ('emails_view'), ('emails_send'), ('import_csv'),
                    ('groups_view'), ('groups_edit'), ('summaries_view')
            ) AS p(perm)
            WHERE g.group_type = 'admin'
        "#).await?;

        // Insert encadrant permissions
        db.execute_unprepared(r#"
            INSERT INTO group_permissions (id, group_id, permission, created_at)
            SELECT gen_random_uuid(), g.id, p.perm, NOW()
            FROM groups g
            CROSS JOIN (
                VALUES 
                    ('sessions_view'), ('sessions_create'), ('sessions_edit'),
                    ('questionnaires_view'), ('questionnaires_edit'),
                    ('users_view'),
                    ('competencies_view'), ('competencies_create'), ('competencies_edit'),
                    ('emails_view'), ('emails_send'), ('import_csv'), ('summaries_view')
            ) AS p(perm)
            WHERE g.group_type = 'encadrant'
        "#).await?;

        // Insert eleve permissions
        db.execute_unprepared(r#"
            INSERT INTO group_permissions (id, group_id, permission, created_at)
            SELECT gen_random_uuid(), g.id, p.perm, NOW()
            FROM groups g
            CROSS JOIN (
                VALUES 
                    ('sessions_view'), ('questionnaires_view'), ('competencies_view'), ('summaries_view')
            ) AS p(perm)
            WHERE g.group_type = 'eleve'
        "#).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Remove foreign key and column from people
        manager
            .alter_table(
                Table::alter()
                    .table(People::Table)
                    .drop_foreign_key(Alias::new("fk_people_group"))
                    .drop_column(People::GroupId)
                    .to_owned(),
            )
            .await?;

        // Drop group_permissions table
        manager
            .drop_table(Table::drop().table(GroupPermissions::Table).to_owned())
            .await?;

        // Drop groups table
        manager
            .drop_table(Table::drop().table(Groups::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Groups {
    Table,
    Id,
    Name,
    GroupType,
    Description,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum GroupPermissions {
    Table,
    Id,
    GroupId,
    Permission,
    CreatedAt,
}

#[derive(DeriveIden)]
enum People {
    Table,
    GroupId,
}
