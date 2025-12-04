use crate::entities::{email_jobs, prelude::*, questionnaires};
use crate::errors::{AppError, AppResult};
use chrono::{Duration, Utc};
use sea_orm::*;
use std::fs;
use uuid::Uuid;

pub struct EmailService {
    magic_link_base_url: String,
    template_path: String,
}

impl EmailService {
    pub fn new(magic_link_base_url: String) -> Self {
        Self {
            magic_link_base_url,
            template_path: "email_template.html".to_string(),
        }
    }
    
    fn load_template(&self) -> Result<String, std::io::Error> {
        fs::read_to_string(&self.template_path)
    }
    
    fn generate_email_content(
        &self,
        person_name: &str,
        session_name: &str,
        session_start: &str,
        session_location: &str,
        magic_link: &str,
        expiration_date: &str,
    ) -> AppResult<(String, String)> {
        let template = self.load_template()
            .map_err(|e| AppError::Internal(format!("Failed to load email template: {}", e)))?;
        
        let body = template
            .replace("{{PERSON_NAME}}", person_name)
            .replace("{{SESSION_NAME}}", session_name)
            .replace("{{SESSION_START_DATE}}", session_start)
            .replace("{{SESSION_LOCATION}}", session_location)
            .replace("{{MAGIC_LINK}}", magic_link)
            .replace("{{EXPIRATION_DATE}}", expiration_date);
        
        let subject = format!("Questionnaire - {} - {}", session_name, person_name);
        
        Ok((subject, body))
    }

    pub async fn create_and_generate_magic_link(
        &self,
        db: &DatabaseConnection,
        session_id: Uuid,
        person_id: Uuid,
        _person_email: &str,
        person_name: &str,
        _expiration_hours: i64, // Not used anymore, expiration based on session date
    ) -> AppResult<Uuid> {
        let token = Uuid::new_v4();
        
        // Get session info
        let session = Sessions::find_by_id(session_id)
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
            .ok_or(AppError::NotFound("Session not found".to_string()))?;

        // Calculate expiration: 1 day after session end (or start if no end date)
        let session_reference_date = session.end_date.unwrap_or(session.start_date);
        let expires_at = session_reference_date.and_hms_opt(23, 59, 59).unwrap() + Duration::days(1);

        let magic_link = format!("{}/q/{}", self.magic_link_base_url, token);
        let expiration_date = expires_at.format("%d/%m/%Y à %H:%M").to_string();
        
        // Generate email content
        let session_location = session.location.as_deref()
            .unwrap_or("À définir");
        
        let (subject, body) = self.generate_email_content(
            person_name,
            &session.name,
            &session.start_date.format("%d/%m/%Y").to_string(),
            session_location,
            &magic_link,
            &expiration_date,
        )?;

        // Create email job with generated content
        let now = Utc::now().naive_utc();
        
        let email_job = email_jobs::ActiveModel {
            id: Set(Uuid::new_v4()),
            session_id: Set(session_id),
            person_id: Set(person_id),
            questionnaire_token: Set(token),
            status: Set("generated".to_string()),
            retry_count: Set(0),
            sent_at: Set(None),
            expires_at: Set(expires_at),
            consumed: Set(false),
            error_message: Set(None),
            email_subject: Set(Some(subject)),
            email_body: Set(Some(body)),
            created_at: Set(now),
            updated_at: Set(now),
        };

        email_job
            .insert(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to create email job".to_string())))?;

        Ok(token)
    }

    pub async fn get_pending_emails(
        db: &DatabaseConnection,
    ) -> AppResult<Vec<crate::models::EmailToSend>> {
        let email_jobs = EmailJobs::find()
            .filter(email_jobs::Column::Status.eq("generated"))
            .find_also_related(People)
            .all(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email jobs".to_string())))?;

        let mut emails = Vec::new();
        for (job, person) in email_jobs {
            if let Some(p) = person {
                emails.push(crate::models::EmailToSend {
                    id: job.id,
                    to_email: p.email,
                    to_name: format!("{} {}", p.first_name, p.last_name),
                    subject: job.email_subject.unwrap_or_default(),
                    body: job.email_body.unwrap_or_default(),
                    status: job.status.clone(),
                    sent_at: job.sent_at.map(|dt| dt.to_string()),
                    expires_at: job.expires_at.to_string(),
                });
            }
        }

        Ok(emails)
    }

    pub async fn get_emails_by_session(
        db: &DatabaseConnection,
        session_id: Uuid,
    ) -> AppResult<Vec<crate::models::EmailToSend>> {
        let email_jobs = EmailJobs::find()
            .filter(email_jobs::Column::SessionId.eq(session_id))
            .find_also_related(People)
            .all(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email jobs".to_string())))?;

        let mut emails = Vec::new();
        for (job, person) in email_jobs {
            if let Some(p) = person {
                emails.push(crate::models::EmailToSend {
                    id: job.id,
                    to_email: p.email,
                    to_name: format!("{} {}", p.first_name, p.last_name),
                    subject: job.email_subject.unwrap_or_default(),
                    body: job.email_body.unwrap_or_default(),
                    status: job.status.clone(),
                    sent_at: job.sent_at.map(|dt| dt.to_string()),
                    expires_at: job.expires_at.to_string(),
                });
            }
        }

        Ok(emails)
    }
    
    pub async fn mark_as_sent(
        db: &DatabaseConnection,
        email_job_id: Uuid,
    ) -> AppResult<()> {
        let email_job = EmailJobs::find_by_id(email_job_id)
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email job".to_string())))?
            .ok_or(AppError::NotFound("Email job not found".to_string()))?;

        let mut active: email_jobs::ActiveModel = email_job.into();
        active.status = Set("sent".to_string());
        active.sent_at = Set(Some(Utc::now().naive_utc()));
        active.updated_at = Set(Utc::now().naive_utc());

        active
            .update(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to update email job".to_string())))?;

        Ok(())
    }

    /// Generate magic links for all questionnaires in a session that don't have one yet
    pub async fn generate_magic_links_for_session(
        &self,
        db: &DatabaseConnection,
        session_id: Uuid,
    ) -> AppResult<usize> {
        // Get session info
        let session = Sessions::find_by_id(session_id)
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query session".to_string())))?
            .ok_or(AppError::NotFound("Session not found".to_string()))?;

        // Find all questionnaires for this session
        let questionnaires_with_people = Questionnaires::find()
            .filter(questionnaires::Column::SessionId.eq(session_id))
            .find_also_related(People)
            .all(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaires".to_string())))?;

        let mut count = 0;

        for (_questionnaire, person_opt) in questionnaires_with_people {
            let person = person_opt.ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;

            // Check if email job already exists for this person/session
            let existing_job = EmailJobs::find()
                .filter(email_jobs::Column::PersonId.eq(person.id))
                .filter(email_jobs::Column::SessionId.eq(session_id))
                .one(db)
                .await
                .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email jobs".to_string())))?;

            // Skip if email job already exists
            if existing_job.is_some() {
                continue;
            }

            // Generate magic link
            let token = Uuid::new_v4();
            let session_reference_date = session.end_date.unwrap_or(session.start_date);
            let expires_at = session_reference_date.and_hms_opt(23, 59, 59).unwrap() + Duration::days(1);
            let magic_link = format!("{}/q/{}", self.magic_link_base_url, token);
            let expiration_date = expires_at.format("%d/%m/%Y à %H:%M").to_string();

            let session_location = session.location.as_deref()
                .unwrap_or("À définir");

            let person_name = format!("{} {}", person.first_name, person.last_name);
            let (subject, body) = self.generate_email_content(
                &person_name,
                &session.name,
                &session.start_date.format("%d/%m/%Y").to_string(),
                session_location,
                &magic_link,
                &expiration_date,
            )?;

            // Create email job
            let now = Utc::now().naive_utc();
            let email_job = email_jobs::ActiveModel {
                id: Set(Uuid::new_v4()),
                session_id: Set(session_id),
                person_id: Set(person.id),
                questionnaire_token: Set(token),
                status: Set("generated".to_string()),
                retry_count: Set(0),
                sent_at: Set(None),
                expires_at: Set(expires_at),
                consumed: Set(false),
                error_message: Set(None),
                email_subject: Set(Some(subject)),
                email_body: Set(Some(body)),
                created_at: Set(now),
                updated_at: Set(now),
            };

            email_job
                .insert(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to create email job for person {:?}: {:?}", person.id, e);
                    AppError::Database(sea_orm::DbErr::Custom("Failed to create email job".to_string()))
                })?;

            count += 1;
        }

        Ok(count)
    }
}

