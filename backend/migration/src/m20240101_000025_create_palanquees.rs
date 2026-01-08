use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Table rotations
        manager
            .create_table(
                Table::create()
                    .table(Rotations::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Rotations::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Rotations::SessionId).uuid().not_null())
                    .col(ColumnDef::new(Rotations::Number).integer().not_null())
                    .col(ColumnDef::new(Rotations::CreatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Rotations::UpdatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Rotations::Table, Rotations::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                    )
                    .to_owned(),
            )
            .await?;

        // Table palanquees
        manager
            .create_table(
                Table::create()
                    .table(Palanquees::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Palanquees::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Palanquees::RotationId).uuid().not_null())
                    .col(ColumnDef::new(Palanquees::Number).integer().not_null())
                    .col(ColumnDef::new(Palanquees::CallSign).string().null()) // Nom de la palanquée (ex: "Alpha", "1")
                    // Paramètres prévus
                    .col(ColumnDef::new(Palanquees::PlannedDepartureTime).time().null())
                    .col(ColumnDef::new(Palanquees::PlannedTime).integer().null()) // Durée prévue en minutes
                    .col(ColumnDef::new(Palanquees::PlannedDepth).integer().null()) // Profondeur prévue en mètres
                    // Paramètres réalisés
                    .col(ColumnDef::new(Palanquees::ActualDepartureTime).time().null())
                    .col(ColumnDef::new(Palanquees::ActualReturnTime).time().null())
                    .col(ColumnDef::new(Palanquees::ActualTime).integer().null()) // Durée réalisée en minutes
                    .col(ColumnDef::new(Palanquees::ActualDepth).integer().null()) // Profondeur réalisée en mètres
                    .col(ColumnDef::new(Palanquees::CreatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Palanquees::UpdatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Palanquees::Table, Palanquees::RotationId)
                            .to(Rotations::Table, Rotations::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                    )
                    .to_owned(),
            )
            .await?;

        // Table palanquee_members
        manager
            .create_table(
                Table::create()
                    .table(PalanqueeMembers::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(PalanqueeMembers::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(PalanqueeMembers::PalanqueeId).uuid().not_null())
                    .col(ColumnDef::new(PalanqueeMembers::QuestionnaireId).uuid().not_null())
                    .col(ColumnDef::new(PalanqueeMembers::Role).string().not_null()) // E=Encadrant, P=Plongeur, GP=Guide Palanquée
                    .col(ColumnDef::new(PalanqueeMembers::GasType).string().not_null().default("Air")) // Air, Nitrox, Trimix, etc
                    .col(ColumnDef::new(PalanqueeMembers::CreatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(PalanqueeMembers::Table, PalanqueeMembers::PalanqueeId)
                            .to(Palanquees::Table, Palanquees::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(PalanqueeMembers::Table, PalanqueeMembers::QuestionnaireId)
                            .to(Questionnaires::Table, Questionnaires::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                    )
                    .to_owned(),
            )
            .await?;

        // Index unique pour éviter les doublons de membre dans une palanquée
        manager
            .create_index(
                Index::create()
                    .name("idx_palanquee_member_unique")
                    .table(PalanqueeMembers::Table)
                    .col(PalanqueeMembers::PalanqueeId)
                    .col(PalanqueeMembers::QuestionnaireId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(PalanqueeMembers::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Palanquees::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Rotations::Table).to_owned())
            .await?;
        Ok(())
    }
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

#[derive(Iden)]
enum Rotations {
    Table,
    Id,
    SessionId,
    Number,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
enum Palanquees {
    Table,
    Id,
    RotationId,
    Number,
    CallSign,
    PlannedDepartureTime,
    PlannedTime,
    PlannedDepth,
    ActualDepartureTime,
    ActualReturnTime,
    ActualTime,
    ActualDepth,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
enum PalanqueeMembers {
    Table,
    Id,
    PalanqueeId,
    QuestionnaireId,
    Role,
    GasType,
    CreatedAt,
}

