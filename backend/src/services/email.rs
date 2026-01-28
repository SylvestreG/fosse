use crate::config::SmtpConfig;
use crate::entities::{email_jobs, prelude::*, questionnaires};
use crate::errors::{AppError, AppResult};
use chrono::{Duration, Utc};
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use sea_orm::*;
use std::fs;
use uuid::Uuid;

pub struct EmailService {
    magic_link_base_url: String,
    template_path: String,
    smtp_config: SmtpConfig,
}

impl EmailService {
    pub fn new(magic_link_base_url: String, smtp_config: SmtpConfig) -> Self {
        Self {
            magic_link_base_url,
            template_path: "email_template.html".to_string(),
            smtp_config,
        }
    }

    /// Create SMTP transport for OVH
    fn create_smtp_transport(&self) -> AppResult<AsyncSmtpTransport<Tokio1Executor>> {
        let creds = Credentials::new(
            self.smtp_config.username.clone(),
            self.smtp_config.password.clone(),
        );

        // OVH uses port 465 with implicit TLS
        let transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&self.smtp_config.host)
            .map_err(|e| AppError::Internal(format!("Failed to create SMTP transport: {}", e)))?
            .port(self.smtp_config.port)
            .credentials(creds)
            .build();

        Ok(transport)
    }

    /// Send a single email via SMTP
    pub async fn send_email(
        &self,
        to_email: &str,
        to_name: &str,
        subject: &str,
        html_body: &str,
    ) -> AppResult<()> {
        let from_address = format!("{} <{}>", self.smtp_config.from_name, self.smtp_config.from_email);
        let to_address = format!("{} <{}>", to_name, to_email);

        // Generate a unique Message-ID for better deliverability
        let domain = self.smtp_config.from_email.split('@').nth(1).unwrap_or("localhost");
        let message_id = format!("<{}.{}@{}>", uuid::Uuid::new_v4(), chrono::Utc::now().timestamp(), domain);

        let email = Message::builder()
            .from(from_address.parse().map_err(|e| AppError::Internal(format!("Invalid from address: {}", e)))?)
            .reply_to(self.smtp_config.from_email.parse().map_err(|e| AppError::Internal(format!("Invalid reply-to address: {}", e)))?)
            .to(to_address.parse().map_err(|e| AppError::Internal(format!("Invalid to address: {}", e)))?)
            .subject(subject)
            .message_id(Some(message_id))
            .header(ContentType::TEXT_HTML)
            .body(html_body.to_string())
            .map_err(|e| AppError::Internal(format!("Failed to build email: {}", e)))?;

        let transport = self.create_smtp_transport()?;

        transport
            .send(email)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to send email: {}", e)))?;

        tracing::info!("Email sent successfully to {}", to_email);
        Ok(())
    }

    /// Send a specific email job and mark it as sent
    #[allow(dead_code)]
    pub async fn send_email_job(
        &self,
        db: &DatabaseConnection,
        email_job_id: Uuid,
    ) -> AppResult<()> {
        // Get the email job with person info
        let email_job = EmailJobs::find_by_id(email_job_id)
            .one(db)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or(AppError::NotFound("Email job not found".to_string()))?;

        let person = People::find_by_id(email_job.person_id)
            .one(db)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or(AppError::NotFound("Person not found".to_string()))?;

        let subject = email_job.email_subject.as_deref().unwrap_or("Questionnaire");
        let body = email_job.email_body.as_deref().unwrap_or("");
        let to_name = format!("{} {}", person.first_name, person.last_name);

        // Send the email
        self.send_email(&person.email, &to_name, subject, body).await?;

        // Mark as sent
        Self::mark_as_sent(db, email_job_id).await?;

        Ok(())
    }

    /// Send all pending emails for a session
    #[allow(dead_code)]
    pub async fn send_pending_emails_for_session(
        &self,
        db: &DatabaseConnection,
        session_id: Uuid,
    ) -> AppResult<(usize, Vec<String>)> {
        let email_jobs = EmailJobs::find()
            .filter(email_jobs::Column::SessionId.eq(session_id))
            .filter(email_jobs::Column::Status.eq("generated"))
            .find_also_related(People)
            .all(db)
            .await
            .map_err(|e| AppError::Database(e))?;

        let mut sent_count = 0;
        let mut errors = Vec::new();

        for (job, person_opt) in email_jobs {
            let person = match person_opt {
                Some(p) => p,
                None => {
                    errors.push(format!("Person not found for job {}", job.id));
                    continue;
                }
            };

            let subject = job.email_subject.as_deref().unwrap_or("Questionnaire");
            let body = job.email_body.as_deref().unwrap_or("");
            let to_name = format!("{} {}", person.first_name, person.last_name);

            match self.send_email(&person.email, &to_name, subject, body).await {
                Ok(_) => {
                    if let Err(e) = Self::mark_as_sent(db, job.id).await {
                        errors.push(format!("Failed to mark email {} as sent: {}", job.id, e));
                    } else {
                        sent_count += 1;
                    }
                }
                Err(e) => {
                    // Mark as failed with error message
                    let _ = Self::mark_as_failed(db, job.id, &e.to_string()).await;
                    errors.push(format!("Failed to send to {}: {}", person.email, e));
                }
            }
        }

        Ok((sent_count, errors))
    }

    /// Mark an email job as failed
    #[allow(dead_code)]
    pub async fn mark_as_failed(
        db: &DatabaseConnection,
        email_job_id: Uuid,
        error_message: &str,
    ) -> AppResult<()> {
        let email_job = EmailJobs::find_by_id(email_job_id)
            .one(db)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or(AppError::NotFound("Email job not found".to_string()))?;

        let mut active: email_jobs::ActiveModel = email_job.into();
        active.status = Set("failed".to_string());
        active.error_message = Set(Some(error_message.to_string()));
        active.retry_count = Set(active.retry_count.unwrap() + 1);
        active.updated_at = Set(Utc::now().naive_utc());

        active
            .update(db)
            .await
            .map_err(|e| AppError::Database(e))?;

        Ok(())
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
            session_id: Set(Some(session_id)),
            sortie_id: Set(None),
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
                session_id: Set(Some(session_id)),
                sortie_id: Set(None),
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

