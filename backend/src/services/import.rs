use crate::entities::{import_jobs, people, prelude::*, questionnaires};
use crate::errors::{AppError, AppResult};
use crate::models::{CsvImportRow, ImportError};
use crate::services::EmailService;
use chrono::Utc;
use csv::ReaderBuilder;
use sea_orm::*;
use uuid::Uuid;

pub struct ImportService;

impl ImportService {
    pub async fn import_csv(
        db: &DatabaseConnection,
        email_service: &EmailService,
        session_id: Uuid,
        filename: String,
        csv_content: &str,
        expiration_hours: i64,
    ) -> AppResult<Uuid> {
        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .from_reader(csv_content.as_bytes());

        let mut rows: Vec<Result<CsvImportRow, csv::Error>> = Vec::new();
        for result in reader.deserialize() {
            rows.push(result);
        }

        let total_rows = rows.len();
        let mut success_count = 0;
        let mut error_count = 0;
        let mut errors: Vec<ImportError> = Vec::new();

        // Create import job
        let import_job_id = Uuid::new_v4();
        let now = Utc::now().naive_utc();

        let import_job = import_jobs::ActiveModel {
            id: Set(import_job_id),
            session_id: Set(session_id),
            filename: Set(filename),
            status: Set("processing".to_string()),
            total_rows: Set(total_rows as i32),
            success_count: Set(0),
            error_count: Set(0),
            errors: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        };

        import_job
            .insert(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to create import job".to_string())))?;

        // Process each row
        for (idx, row_result) in rows.into_iter().enumerate() {
            let row_num = idx + 2; // +2 because row 1 is header, and we're 0-indexed

            match row_result {
                Ok(row) => {
                    match Self::process_csv_row(
                        db,
                        email_service,
                        session_id,
                        row,
                        expiration_hours,
                    )
                    .await
                    {
                        Ok(_) => success_count += 1,
                        Err(e) => {
                            error_count += 1;
                            errors.push(ImportError {
                                row: row_num,
                                message: e.to_string(),
                            });
                        }
                    }
                }
                Err(e) => {
                    error_count += 1;
                    errors.push(ImportError {
                        row: row_num,
                        message: format!("CSV parsing error: {}", e),
                    });
                }
            }
        }

        // Update import job
        let import_job = ImportJobs::find_by_id(import_job_id)
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query import job".to_string())))?
            .ok_or(AppError::NotFound("Import job not found".to_string()))?;

        let errors_json = if errors.is_empty() {
            None
        } else {
            Some(serde_json::to_value(&errors).unwrap())
        };

        let mut active: import_jobs::ActiveModel = import_job.into();
        active.status = Set("completed".to_string());
        active.success_count = Set(success_count);
        active.error_count = Set(error_count);
        active.errors = Set(errors_json);
        active.updated_at = Set(Utc::now().naive_utc());

        active
            .update(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to update import job".to_string())))?;

        Ok(import_job_id)
    }

    async fn process_csv_row(
        db: &DatabaseConnection,
        email_service: &EmailService,
        session_id: Uuid,
        row: CsvImportRow,
        expiration_hours: i64,
    ) -> AppResult<()> {
        // Validate email
        if row.email.is_empty() || !row.email.contains('@') {
            return Err(AppError::Validation(format!(
                "Invalid email: {}",
                row.email
            )));
        }

        // Check if person already exists
        let existing_person = People::find()
            .filter(people::Column::Email.eq(&row.email))
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query person".to_string())))?;

        let person = if let Some(existing) = existing_person {
            existing
        } else {
            // Create new person with default preferences
            let now = Utc::now().naive_utc();
            let person_model = people::ActiveModel {
                id: Set(Uuid::new_v4()),
                first_name: Set(row.first_name.clone()),
                last_name: Set(row.last_name.clone()),
                email: Set(row.email.clone()),
                phone: Set(row.phone.clone()),
                default_is_encadrant: Set(false),
                default_wants_regulator: Set(false),
                default_wants_nitrox: Set(false),
                default_wants_2nd_reg: Set(false),
                default_wants_stab: Set(false),
                default_stab_size: Set(None),
                diving_level: Set(None),
                group_id: Set(None),
                password_hash: Set(None),
                temp_password: Set(None),
                temp_password_expires_at: Set(None),
                must_change_password: Set(false),
                created_at: Set(now),
                updated_at: Set(now),
            };

            person_model
                .insert(db)
                .await
                .map_err(|e| {
                    // Check for unique constraint violation on email
                    if let DbErr::Exec(RuntimeErr::SqlxError(sqlx_error)) = &e {
                        if let Some(db_error) = sqlx_error.as_database_error() {
                            if db_error.is_unique_violation() {
                                return AppError::Validation(
                                    format!("Un utilisateur avec l'email {} existe déjà", row.email)
                                );
                            }
                        }
                    }
                    AppError::Database(sea_orm::DbErr::Custom("Failed to create person".to_string()))
                })?
        };

        // Create questionnaire record pre-filled with user's default preferences
        let now = Utc::now().naive_utc();
        // Compute is_instructor from diving_level
        let is_instructor = person.diving_level.as_ref()
            .and_then(|level_str| crate::models::DiverLevel::from_string(level_str))
            .map(|diver_level| diver_level.is_instructor())
            .unwrap_or(false);
        let questionnaire = questionnaires::ActiveModel {
            id: Set(Uuid::new_v4()),
            session_id: Set(session_id),
            person_id: Set(person.id),
            is_encadrant: Set(is_instructor),
            wants_regulator: Set(person.default_wants_regulator),
            wants_nitrox: Set(person.default_wants_nitrox),
            wants_2nd_reg: Set(person.default_wants_2nd_reg),
            wants_stab: Set(person.default_wants_stab),
            stab_size: Set(person.default_stab_size.clone()),
            comes_from_issoire: Set(false), // Session-specific, no default
            has_car: Set(false), // Session-specific, no default
            car_seats: Set(None), // Session-specific, no default
            comments: Set(None),
            submitted_at: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        };

        questionnaire
            .insert(db)
            .await
            .map_err(|e| {
                // Check for unique constraint violation (person already enrolled)
                if let DbErr::Exec(RuntimeErr::SqlxError(sqlx_error)) = &e {
                    if let Some(db_error) = sqlx_error.as_database_error() {
                        if db_error.is_unique_violation() {
                            tracing::warn!("Person {} {} is already enrolled in this session", person.first_name, person.last_name);
                            return AppError::Validation(
                                format!("{} {} est déjà inscrit à cette session", person.first_name, person.last_name)
                            );
                        }
                    }
                }
                tracing::error!("Failed to create questionnaire for person {:?}: {:?}", person.id, e);
                AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create questionnaire: {}", e)))
            })?;

        // Generate magic link email
        let person_name = format!("{} {}", person.first_name, person.last_name);
        email_service
            .create_and_generate_magic_link(
                db,
                session_id,
                person.id,
                &person.email,
                &person_name,
                expiration_hours,
            )
            .await?;

        Ok(())
    }

    pub async fn get_import_job(
        db: &DatabaseConnection,
        import_job_id: Uuid,
    ) -> AppResult<crate::models::ImportJobResponse> {
        let import_job = ImportJobs::find_by_id(import_job_id)
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query import job".to_string())))?
            .ok_or(AppError::NotFound("Import job not found".to_string()))?;

        let errors = if let Some(errors_json) = import_job.errors {
            serde_json::from_value(errors_json.clone()).ok()
        } else {
            None
        };

        Ok(crate::models::ImportJobResponse {
            id: import_job.id,
            session_id: import_job.session_id,
            filename: import_job.filename,
            status: import_job.status,
            total_rows: import_job.total_rows,
            success_count: import_job.success_count,
            error_count: import_job.error_count,
            errors,
            created_at: import_job.created_at.to_string(),
            updated_at: import_job.updated_at.to_string(),
        })
    }
}

