use crate::entities::prelude::*;
use crate::entities::{email_jobs, people, questionnaires};
use crate::errors::{AppError, AppResult};
use crate::models::{CreateQuestionnaireRequest, QuestionnaireDetailResponse, QuestionnaireResponse, QuestionnaireTokenData, SubmitQuestionnaireRequest, UpdateQuestionnaireRequest};
use chrono::Utc;
use sea_orm::*;
use uuid::Uuid;

pub struct QuestionnaireService;

impl QuestionnaireService {
    /// Apply business rules to questionnaire data before saving
    /// Rule 1: If is_encadrant == true, then wants_2nd_reg defaults to true, nitrox can be offered
    /// Rule 1b: If is_encadrant == false, then wants_nitrox and wants_2nd_reg must be false
    /// Rule 2: stab_size stored only if wants_stab == true
    /// Rule 3: If comes_from_issoire == false, then has_car and car_seats are false/null
    /// Rule 4: If has_car == true, then car_seats required >= 1, else null
    pub fn apply_business_rules(request: &mut SubmitQuestionnaireRequest) {
        // Rule 1: Encadrant gets 2nd regulator by default
        if request.is_encadrant {
            if !request.wants_2nd_reg {
                request.wants_2nd_reg = true;
            }
        } else {
            // Rule 1b: Only encadrants can request nitrox and 2nd regulator
            request.wants_nitrox = false;
            request.wants_2nd_reg = false;
        }

        // Rule 2: Only store stab_size if wants_stab is true
        if !request.wants_stab {
            request.stab_size = None;
        }

        // Rule 3: Only ask for car if comes_from_issoire
        if !request.comes_from_issoire {
            request.has_car = false;
            request.car_seats = None;
        }

        // Rule 4: Car seats validation (only if comes from Issoire)
        if request.comes_from_issoire && request.has_car {
            if let Some(seats) = request.car_seats {
                if seats < 1 {
                    request.car_seats = Some(1); // Correct to minimum
                }
            } else {
                request.car_seats = Some(1); // Default to 1 if not provided
            }
        } else if !request.comes_from_issoire {
            request.car_seats = None;
        }
    }

    pub async fn get_by_token(
        db: &DatabaseConnection,
        token: Uuid,
    ) -> AppResult<QuestionnaireTokenData> {
        // Find email job by token
        let email_job = EmailJobs::find()
            .filter(email_jobs::Column::QuestionnaireToken.eq(token))
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email job".to_string())))?
            .ok_or(AppError::InvalidToken)?;

        // Check if token is expired
        if email_job.expires_at < Utc::now().naive_utc() {
            return Err(AppError::InvalidToken);
        }

        // Check if token is consumed
        if email_job.consumed {
            return Err(AppError::TokenConsumed);
        }

        // Get person
        let person = People::find_by_id(email_job.person_id)
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query person".to_string())))?
            .ok_or(AppError::NotFound("Person not found".to_string()))?;

        // Check if questionnaire already exists
        let questionnaire = Questionnaires::find()
            .filter(questionnaires::Column::PersonId.eq(person.id))
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string())))?;

        // Get session_id from email_job
        let session_id = email_job.session_id;

        let diving_level_display = person.diving_level.as_ref().and_then(|level_str| {
            crate::models::DiverLevel::from_string(level_str).map(|diver_level| diver_level.display())
        });
        let is_instructor = person.diving_level.as_ref()
            .and_then(|level_str| crate::models::DiverLevel::from_string(level_str))
            .map(|diver_level| diver_level.is_instructor())
            .unwrap_or(false);
        let preparing_level = person.diving_level.as_ref()
            .and_then(|level_str| crate::models::DiverLevel::extract_preparing_level(level_str));

        Ok(QuestionnaireTokenData {
            token,
            person: crate::models::PersonResponse {
                id: person.id,
                first_name: person.first_name,
                last_name: person.last_name,
                email: person.email,
                phone: person.phone,
                default_is_encadrant: is_instructor, // Now derived from diving_level
                default_wants_regulator: person.default_wants_regulator,
                default_wants_nitrox: person.default_wants_nitrox,
                default_wants_2nd_reg: person.default_wants_2nd_reg,
                default_wants_stab: person.default_wants_stab,
                default_stab_size: person.default_stab_size.clone(),
                diving_level: person.diving_level,
                diving_level_display,
                is_instructor,
                preparing_level,
                group_id: person.group_id,
                group_name: None, // Not fetched in public context
                created_at: person.created_at.to_string(),
                updated_at: person.updated_at.to_string(),
            },
            session_id,
            questionnaire: questionnaire.map(|q| QuestionnaireResponse {
                id: q.id,
                session_id: q.session_id,
                person_id: q.person_id,
                is_encadrant: q.is_encadrant,
                wants_regulator: q.wants_regulator,
                wants_nitrox: q.wants_nitrox,
                wants_2nd_reg: q.wants_2nd_reg,
                wants_stab: q.wants_stab,
                stab_size: q.stab_size,
                nitrox_training: q.nitrox_training,
                comes_from_issoire: q.comes_from_issoire,
                has_car: q.has_car,
                car_seats: q.car_seats,
                comments: q.comments,
                submitted_at: q.submitted_at.map(|dt| dt.to_string()),
                created_at: q.created_at.to_string(),
                updated_at: q.updated_at.to_string(),
            }),
        })
    }

    pub async fn submit(
        db: &DatabaseConnection,
        mut request: SubmitQuestionnaireRequest,
    ) -> AppResult<QuestionnaireResponse> {
        // Verify token
        let email_job = EmailJobs::find()
            .filter(email_jobs::Column::QuestionnaireToken.eq(request.token))
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query email job".to_string())))?
            .ok_or(AppError::InvalidToken)?;

        if email_job.expires_at < Utc::now().naive_utc() {
            return Err(AppError::InvalidToken);
        }

        if email_job.consumed {
            return Err(AppError::TokenConsumed);
        }

        // Apply business rules
        Self::apply_business_rules(&mut request);

        // Find existing questionnaire or create new
        let existing = Questionnaires::find()
            .filter(questionnaires::Column::PersonId.eq(email_job.person_id))
            .one(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to query questionnaire".to_string())))?;

        let now = Utc::now().naive_utc();

        let questionnaire = if let Some(existing_q) = existing {
            // Update existing questionnaire
            let mut active: questionnaires::ActiveModel = existing_q.into();
            active.is_encadrant = Set(request.is_encadrant);
            active.wants_regulator = Set(request.wants_regulator);
            active.wants_nitrox = Set(request.wants_nitrox);
            active.wants_2nd_reg = Set(request.wants_2nd_reg);
            active.wants_stab = Set(request.wants_stab);
            active.stab_size = Set(request.stab_size.clone());
            active.nitrox_training = Set(request.nitrox_training);
            active.has_car = Set(request.has_car);
            active.car_seats = Set(request.car_seats);
            active.comments = Set(request.comments.clone());
            active.submitted_at = Set(Some(now));
            active.updated_at = Set(now);

            active
                .update(db)
                .await
                .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to update questionnaire".to_string())))?
        } else {
            // Get session_id - in real scenario this would come from the import job or be passed with token
            // For now we'll derive from a related query or require it to exist
            // This is a simplified version
            return Err(AppError::NotFound("Cannot submit questionnaire without session context".to_string()));
        };

        // Mark token as consumed
        let mut email_active: email_jobs::ActiveModel = email_job.into();
        email_active.consumed = Set(true);
        email_active.updated_at = Set(now);
        email_active
            .update(db)
            .await
            .map_err(|_| AppError::Database(sea_orm::DbErr::Custom("Failed to update email job".to_string())))?;

        Ok(QuestionnaireResponse {
            id: questionnaire.id,
            session_id: questionnaire.session_id,
            person_id: questionnaire.person_id,
            is_encadrant: questionnaire.is_encadrant,
            wants_regulator: questionnaire.wants_regulator,
            wants_nitrox: questionnaire.wants_nitrox,
            wants_2nd_reg: questionnaire.wants_2nd_reg,
            wants_stab: questionnaire.wants_stab,
            stab_size: questionnaire.stab_size,
            nitrox_training: questionnaire.nitrox_training,
            comes_from_issoire: questionnaire.comes_from_issoire,
            has_car: questionnaire.has_car,
            car_seats: questionnaire.car_seats,
            comments: questionnaire.comments,
            submitted_at: questionnaire.submitted_at.map(|dt| dt.to_string()),
            created_at: questionnaire.created_at.to_string(),
            updated_at: questionnaire.updated_at.to_string(),
        })
    }

    pub async fn list_by_session(
        db: &DatabaseConnection,
        session_id: Uuid,
    ) -> AppResult<Vec<QuestionnaireResponse>> {
        let questionnaires = Questionnaires::find()
            .filter(questionnaires::Column::SessionId.eq(session_id))
            .all(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to query questionnaires: {:?}", e);
                AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query questionnaires: {}", e)))
            })?;

        Ok(questionnaires
            .into_iter()
            .map(|q| QuestionnaireResponse {
                id: q.id,
                session_id: q.session_id,
                person_id: q.person_id,
                is_encadrant: q.is_encadrant,
                wants_regulator: q.wants_regulator,
                wants_nitrox: q.wants_nitrox,
                wants_2nd_reg: q.wants_2nd_reg,
                wants_stab: q.wants_stab,
                stab_size: q.stab_size,
                nitrox_training: q.nitrox_training,
                comes_from_issoire: q.comes_from_issoire,
                has_car: q.has_car,
                car_seats: q.car_seats,
                comments: q.comments,
                submitted_at: q.submitted_at.map(|dt| dt.to_string()),
                created_at: q.created_at.to_string(),
                updated_at: q.updated_at.to_string(),
            })
            .collect())
    }

    pub async fn list_with_details(
        db: &DatabaseConnection,
        session_id: Uuid,
        magic_link_base_url: &str,
    ) -> AppResult<Vec<QuestionnaireDetailResponse>> {
        let questionnaires = Questionnaires::find()
            .filter(questionnaires::Column::SessionId.eq(session_id))
            .find_also_related(People)
            .all(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to query questionnaires: {:?}", e);
                AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query questionnaires: {}", e)))
            })?;

        let mut responses = Vec::new();

        for (questionnaire, person_opt) in questionnaires {
            let person = person_opt.ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;

            // Find email job for this person and session to get magic link
            let email_job = EmailJobs::find()
                .filter(email_jobs::Column::PersonId.eq(person.id))
                .filter(email_jobs::Column::SessionId.eq(session_id))
                .one(db)
                .await
                .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query email job: {}", e))))?;

            let (magic_link, email_status) = if let Some(job) = email_job {
                let link = format!("{}/q/{}", magic_link_base_url, job.questionnaire_token);
                (Some(link), Some(job.status))
            } else {
                (None, None)
            };

            responses.push(QuestionnaireDetailResponse {
                id: questionnaire.id,
                session_id: questionnaire.session_id,
                person_id: person.id,
                first_name: person.first_name,
                last_name: person.last_name,
                email: person.email,
                is_encadrant: questionnaire.is_encadrant,
                wants_regulator: questionnaire.wants_regulator,
                wants_nitrox: questionnaire.wants_nitrox,
                wants_2nd_reg: questionnaire.wants_2nd_reg,
                wants_stab: questionnaire.wants_stab,
                stab_size: questionnaire.stab_size,
                nitrox_training: questionnaire.nitrox_training,
                comes_from_issoire: questionnaire.comes_from_issoire,
                has_car: questionnaire.has_car,
                car_seats: questionnaire.car_seats,
                comments: questionnaire.comments,
                submitted_at: questionnaire.submitted_at.map(|dt| dt.to_string()),
                magic_link,
                email_status,
            });
        }

        Ok(responses)
    }

    pub async fn update(
        db: &DatabaseConnection,
        questionnaire_id: Uuid,
        mut payload: UpdateQuestionnaireRequest,
    ) -> AppResult<QuestionnaireResponse> {
        let questionnaire = Questionnaires::find_by_id(questionnaire_id)
            .one(db)
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query questionnaire: {}", e))))?
            .ok_or_else(|| AppError::NotFound("Questionnaire not found".to_string()))?;

        // Apply same business rules as submit, using stored is_encadrant from questionnaire
        Self::apply_business_rules_update(&mut payload, questionnaire.is_encadrant);

        let now = Utc::now().naive_utc();
        let mut active: questionnaires::ActiveModel = questionnaire.into();
        // Note: is_encadrant is derived from person's diving level, not editable
        active.wants_regulator = Set(payload.wants_regulator);
        active.wants_nitrox = Set(payload.wants_nitrox);
        active.wants_2nd_reg = Set(payload.wants_2nd_reg);
        active.wants_stab = Set(payload.wants_stab);
        active.stab_size = Set(payload.stab_size);
        active.nitrox_training = Set(payload.nitrox_training);
        active.comes_from_issoire = Set(payload.comes_from_issoire);
        active.has_car = Set(payload.has_car);
        active.car_seats = Set(payload.car_seats);
        active.comments = Set(payload.comments);
        
        // Handle submitted_at based on mark_as_submitted
        if let Some(mark_submitted) = payload.mark_as_submitted {
            active.submitted_at = Set(if mark_submitted { Some(now) } else { None });
        }
        
        active.updated_at = Set(now);

        let updated = active
            .update(db)
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to update questionnaire: {}", e))))?;

        Ok(QuestionnaireResponse {
            id: updated.id,
            session_id: updated.session_id,
            person_id: updated.person_id,
            is_encadrant: updated.is_encadrant,
            wants_regulator: updated.wants_regulator,
            wants_nitrox: updated.wants_nitrox,
            wants_2nd_reg: updated.wants_2nd_reg,
            wants_stab: updated.wants_stab,
            stab_size: updated.stab_size,
            nitrox_training: updated.nitrox_training,
            comes_from_issoire: updated.comes_from_issoire,
            has_car: updated.has_car,
            car_seats: updated.car_seats,
            comments: updated.comments,
            submitted_at: updated.submitted_at.map(|dt| dt.to_string()),
            created_at: updated.created_at.to_string(),
            updated_at: updated.updated_at.to_string(),
        })
    }

    fn apply_business_rules_update(request: &mut UpdateQuestionnaireRequest, is_encadrant: bool) {
        // Rule 1: Encadrant gets 2nd regulator by default
        if is_encadrant {
            if !request.wants_2nd_reg {
                request.wants_2nd_reg = true;
            }
        } else {
            // Rule 1b: Only encadrants can request nitrox and 2nd regulator
            request.wants_nitrox = false;
            request.wants_2nd_reg = false;
        }

        // Rule 2: Only store stab_size if wants_stab is true
        if !request.wants_stab {
            request.stab_size = None;
        }

        // Rule 3: Car seats validation
        if request.has_car {
            if let Some(seats) = request.car_seats {
                if seats < 1 {
                    request.car_seats = Some(1);
                }
            } else {
                request.car_seats = Some(1);
            }
        } else {
            request.car_seats = None;
        }
    }

    fn apply_business_rules_create(request: &mut CreateQuestionnaireRequest) {
        // Rule 1: Encadrant gets 2nd regulator by default
        if request.is_encadrant {
            if !request.wants_2nd_reg {
                request.wants_2nd_reg = true;
            }
        } else {
            // Rule 1b: Only encadrants can request nitrox and 2nd regulator
            request.wants_nitrox = false;
            request.wants_2nd_reg = false;
        }

        // Rule 2: Only store stab_size if wants_stab is true
        if !request.wants_stab {
            request.stab_size = None;
        }

        // Rule 3: Car seats validation
        if request.has_car {
            if let Some(seats) = request.car_seats {
                if seats < 1 {
                    request.car_seats = Some(1);
                }
            } else {
                request.car_seats = Some(1);
            }
        } else {
            request.car_seats = None;
        }
    }

    /// Créer un questionnaire directement (auto-inscription)
    pub async fn create_direct(
        db: &DatabaseConnection,
        mut request: CreateQuestionnaireRequest,
    ) -> AppResult<QuestionnaireResponse> {
        // Vérifier que la session existe
        let session = Sessions::find_by_id(request.session_id)
            .one(db)
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query session: {}", e))))?
            .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

        // Trouver ou créer la personne
        let person = People::find()
            .filter(people::Column::Email.eq(&request.email))
            .one(db)
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query person: {}", e))))?;

        let now = Utc::now().naive_utc();

        let person_id = if let Some(p) = person {
            p.id
        } else {
            // Créer la personne
            let new_person = people::ActiveModel {
                id: Set(Uuid::new_v4()),
                first_name: Set(request.first_name.clone()),
                last_name: Set(request.last_name.clone()),
                email: Set(request.email.clone()),
                phone: Set(None),
                default_is_encadrant: Set(false),
                default_wants_regulator: Set(request.wants_regulator),
                default_wants_nitrox: Set(request.wants_nitrox),
                default_wants_2nd_reg: Set(request.wants_2nd_reg),
                default_wants_stab: Set(request.wants_stab),
                default_stab_size: Set(request.stab_size.clone()),
                diving_level: Set(None),
                group_id: Set(None),
                password_hash: Set(None),
                temp_password: Set(None),
                temp_password_expires_at: Set(None),
                must_change_password: Set(false),
                created_at: Set(now),
                updated_at: Set(now),
            };

            let created_person = new_person
                .insert(db)
                .await
                .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create person: {}", e))))?;

            created_person.id
        };

        // Vérifier si un questionnaire existe déjà pour cette personne et session
        let existing = Questionnaires::find()
            .filter(questionnaires::Column::PersonId.eq(person_id))
            .filter(questionnaires::Column::SessionId.eq(session.id))
            .one(db)
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to query questionnaire: {}", e))))?;

        if existing.is_some() {
            return Err(AppError::Validation("Vous êtes déjà inscrit à cette session".to_string()));
        }

        // Appliquer les règles métier
        Self::apply_business_rules_create(&mut request);

        // Créer le questionnaire
        let new_questionnaire = questionnaires::ActiveModel {
            id: Set(Uuid::new_v4()),
            session_id: Set(session.id),
            person_id: Set(person_id),
            is_encadrant: Set(request.is_encadrant),
            wants_regulator: Set(request.wants_regulator),
            wants_nitrox: Set(request.wants_nitrox),
            wants_2nd_reg: Set(request.wants_2nd_reg),
            wants_stab: Set(request.wants_stab),
            stab_size: Set(request.stab_size),
            nitrox_training: Set(request.nitrox_training),
            comes_from_issoire: Set(request.comes_from_issoire),
            has_car: Set(request.has_car),
            car_seats: Set(request.car_seats),
            comments: Set(request.comments),
            submitted_at: Set(Some(now)), // Marqué comme soumis immédiatement
            created_at: Set(now),
            updated_at: Set(now),
        };

        let created = new_questionnaire
            .insert(db)
            .await
            .map_err(|e| AppError::Database(sea_orm::DbErr::Custom(format!("Failed to create questionnaire: {}", e))))?;

        Ok(QuestionnaireResponse {
            id: created.id,
            session_id: created.session_id,
            person_id: created.person_id,
            is_encadrant: created.is_encadrant,
            wants_regulator: created.wants_regulator,
            wants_nitrox: created.wants_nitrox,
            wants_2nd_reg: created.wants_2nd_reg,
            wants_stab: created.wants_stab,
            stab_size: created.stab_size,
            nitrox_training: created.nitrox_training,
            comes_from_issoire: created.comes_from_issoire,
            has_car: created.has_car,
            car_seats: created.car_seats,
            comments: created.comments,
            submitted_at: created.submitted_at.map(|dt| dt.to_string()),
            created_at: created.created_at.to_string(),
            updated_at: created.updated_at.to_string(),
        })
    }
}

