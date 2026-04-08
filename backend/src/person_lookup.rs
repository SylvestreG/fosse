//! Recherche de personnes par email (insensible à la casse / espaces).

use crate::entities::{people, prelude::*};
use crate::errors::AppError;
use sea_orm::sea_query::{Expr, Func};
use sea_orm::*;

pub async fn find_person_by_email_ci(
    db: &DatabaseConnection,
    email: &str,
) -> Result<Option<people::Model>, AppError> {
    let t = email.trim();
    if t.is_empty() {
        return Ok(None);
    }
    People::find()
        .filter(
            Expr::expr(Func::lower(Expr::col(people::Column::Email)))
                .eq(Func::lower(Expr::value(t))),
        )
        .one(db)
        .await
        .map_err(|e| {
            AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e)))
        })
}
