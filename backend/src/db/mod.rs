use sea_orm::{Database, DatabaseConnection, DbErr};
use migration::{Migrator, MigratorTrait};

pub async fn init_db(database_url: &str) -> Result<DatabaseConnection, DbErr> {
    let db = Database::connect(database_url).await?;
    Migrator::up(&db, None).await?;
    Ok(db)
}

