use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Questionnaires::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Questionnaires::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Questionnaires::SessionId).uuid().not_null())
                    .col(ColumnDef::new(Questionnaires::PersonId).uuid().not_null())
                    .col(ColumnDef::new(Questionnaires::IsEncadrant).boolean().not_null())
                    .col(ColumnDef::new(Questionnaires::WantsNitrox).boolean().not_null())
                    .col(ColumnDef::new(Questionnaires::Wants2ndReg).boolean().not_null())
                    .col(ColumnDef::new(Questionnaires::WantsStab).boolean().not_null())
                    .col(ColumnDef::new(Questionnaires::StabSize).string())
                    .col(ColumnDef::new(Questionnaires::HasCar).boolean().not_null())
                    .col(ColumnDef::new(Questionnaires::CarSeats).integer())
                    .col(ColumnDef::new(Questionnaires::Comments).text())
                    .col(ColumnDef::new(Questionnaires::SubmittedAt).timestamp())
                    .col(ColumnDef::new(Questionnaires::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(Questionnaires::UpdatedAt).timestamp().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_questionnaires_session")
                            .from(Questionnaires::Table, Questionnaires::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_questionnaires_person")
                            .from(Questionnaires::Table, Questionnaires::PersonId)
                            .to(People::Table, People::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_questionnaires_session")
                    .table(Questionnaires::Table)
                    .col(Questionnaires::SessionId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Questionnaires::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Questionnaires {
    Table,
    Id,
    SessionId,
    PersonId,
    IsEncadrant,
    WantsNitrox,
    Wants2ndReg,
    WantsStab,
    StabSize,
    HasCar,
    CarSeats,
    Comments,
    SubmittedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum People {
    Table,
    Id,
}

