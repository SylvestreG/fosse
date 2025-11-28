use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Just ensure the columns we removed don't exist
        // This is safe even if they're already gone
        let _ = manager
            .get_connection()
            .execute_unprepared("ALTER TABLE people DROP COLUMN IF EXISTS default_comes_from_issoire CASCADE")
            .await;
        
        let _ = manager
            .get_connection()
            .execute_unprepared("ALTER TABLE people DROP COLUMN IF EXISTS default_has_car CASCADE")
            .await;
        
        let _ = manager
            .get_connection()
            .execute_unprepared("ALTER TABLE people DROP COLUMN IF EXISTS default_car_seats CASCADE")
            .await;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}

