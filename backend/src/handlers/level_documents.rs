use axum::{
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::sync::Arc;
use uuid::Uuid;

use crate::entities::{
    level_documents::{self, LevelDocumentInfo},
    skill_document_positions::{self, SkillPositionInput, SkillPositionWithInfo},
    competency_skills, competency_modules, competency_domains, people,
};
use crate::errors::AppError;
use crate::services::PdfGenerator;

// Liste tous les documents par niveau
pub async fn list_level_documents(
    State(db): State<Arc<DatabaseConnection>>,
) -> Result<Json<Vec<LevelDocumentInfo>>, AppError> {
    let docs = level_documents::Entity::find()
        .all(db.as_ref())
        .await?;
    
    let infos: Vec<LevelDocumentInfo> = docs.into_iter().map(|d| d.into()).collect();
    Ok(Json(infos))
}

// Récupère les infos d'un document pour un niveau
pub async fn get_level_document(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
) -> Result<Json<LevelDocumentInfo>, AppError> {
    let doc = level_documents::Entity::find()
        .filter(level_documents::Column::Level.eq(&level))
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Document not found for level {}", level)))?;
    
    Ok(Json(doc.into()))
}

// Télécharge le fichier PDF d'un niveau
pub async fn download_level_document(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let doc = level_documents::Entity::find()
        .filter(level_documents::Column::Level.eq(&level))
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Document not found for level {}", level)))?;
    
    let headers = [
        (header::CONTENT_TYPE, "application/pdf".to_string()),
        (
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", doc.file_name),
        ),
    ];
    
    Ok((headers, doc.file_data))
}

// Upload un document pour un niveau
pub async fn upload_level_document(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<LevelDocumentInfo>, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_data: Option<Vec<u8>> = None;
    
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Validation(format!("Failed to read multipart: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();
        
        if name == "file" {
            file_name = field.file_name().map(|s| s.to_string());
            file_data = Some(field.bytes().await.map_err(|e| {
                AppError::Validation(format!("Failed to read file: {}", e))
            })?.to_vec());
        }
    }
    
    let file_name = file_name.ok_or_else(|| AppError::Validation("No file name".to_string()))?;
    let file_data = file_data.ok_or_else(|| AppError::Validation("No file data".to_string()))?;
    
    // Vérifier que c'est un PDF et compter les pages
    let page_count = count_pdf_pages(&file_data)?;
    
    let now = chrono::Utc::now().naive_utc();
    
    // Vérifier si un document existe déjà pour ce niveau
    let existing = level_documents::Entity::find()
        .filter(level_documents::Column::Level.eq(&level))
        .one(db.as_ref())
        .await?;
    
    let model = if let Some(existing) = existing {
        // Mise à jour
        let mut active: level_documents::ActiveModel = existing.into();
        active.file_name = Set(file_name);
        active.file_data = Set(file_data);
        active.page_count = Set(page_count);
        active.updated_at = Set(now);
        active.update(db.as_ref()).await?
    } else {
        // Création
        let active = level_documents::ActiveModel {
            id: Set(Uuid::new_v4()),
            level: Set(level),
            file_name: Set(file_name),
            file_data: Set(file_data),
            page_count: Set(page_count),
            created_at: Set(now),
            updated_at: Set(now),
        };
        active.insert(db.as_ref()).await?
    };
    
    Ok(Json(model.into()))
}

// Supprime un document pour un niveau
pub async fn delete_level_document(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
) -> Result<StatusCode, AppError> {
    let doc = level_documents::Entity::find()
        .filter(level_documents::Column::Level.eq(&level))
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Document not found for level {}", level)))?;
    
    level_documents::Entity::delete_by_id(doc.id).exec(db.as_ref()).await?;
    
    // Supprimer aussi les positions associées
    skill_document_positions::Entity::delete_many()
        .filter(skill_document_positions::Column::Level.eq(&level))
        .exec(db.as_ref())
        .await?;
    
    Ok(StatusCode::NO_CONTENT)
}

// Liste les positions des acquis pour un niveau
pub async fn list_skill_positions(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
) -> Result<Json<Vec<SkillPositionWithInfo>>, AppError> {
    let positions = skill_document_positions::Entity::find()
        .filter(skill_document_positions::Column::Level.eq(&level))
        .all(db.as_ref())
        .await?;
    
    let mut result = Vec::new();
    
    for pos in positions {
        // Récupérer les infos du skill
        if let Some(skill) = competency_skills::Entity::find_by_id(pos.skill_id)
            .one(db.as_ref())
            .await?
        {
            // Récupérer le module
            if let Some(module) = competency_modules::Entity::find_by_id(skill.module_id)
                .one(db.as_ref())
                .await?
            {
                // Récupérer le domaine
                if let Some(domain) = competency_domains::Entity::find_by_id(module.domain_id)
                    .one(db.as_ref())
                    .await?
                {
                    result.push(SkillPositionWithInfo {
                        id: pos.id,
                        skill_id: pos.skill_id,
                        skill_name: skill.name,
                        skill_number: skill.sort_order,
                        module_name: module.name,
                        domain_name: domain.name,
                        page: pos.page,
                        x: pos.x,
                        y: pos.y,
                        width: pos.width,
                        height: pos.height,
                        font_size: pos.font_size,
                    });
                }
            }
        }
    }
    
    Ok(Json(result))
}

// Définit ou met à jour la position d'un acquis
pub async fn set_skill_position(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
    Json(input): Json<SkillPositionInput>,
) -> Result<Json<skill_document_positions::Model>, AppError> {
    let now = chrono::Utc::now().naive_utc();
    
    // Vérifier que le skill existe
    competency_skills::Entity::find_by_id(input.skill_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Skill not found".to_string()))?;
    
    // Vérifier si une position existe déjà
    let existing = skill_document_positions::Entity::find()
        .filter(skill_document_positions::Column::SkillId.eq(input.skill_id))
        .filter(skill_document_positions::Column::Level.eq(&level))
        .one(db.as_ref())
        .await?;
    
    let model = if let Some(existing) = existing {
        let mut active: skill_document_positions::ActiveModel = existing.into();
        active.page = Set(input.page);
        active.x = Set(input.x);
        active.y = Set(input.y);
        active.width = Set(input.width);
        active.height = Set(input.height);
        active.font_size = Set(input.font_size);
        active.updated_at = Set(now);
        active.update(db.as_ref()).await?
    } else {
        let active = skill_document_positions::ActiveModel {
            id: Set(Uuid::new_v4()),
            skill_id: Set(input.skill_id),
            level: Set(level),
            page: Set(input.page),
            x: Set(input.x),
            y: Set(input.y),
            width: Set(input.width),
            height: Set(input.height),
            font_size: Set(input.font_size),
            created_at: Set(now),
            updated_at: Set(now),
        };
        active.insert(db.as_ref()).await?
    };
    
    Ok(Json(model))
}

// Supprime la position d'un acquis
pub async fn delete_skill_position(
    State(db): State<Arc<DatabaseConnection>>,
    Path((level, skill_id)): Path<(String, Uuid)>,
) -> Result<StatusCode, AppError> {
    skill_document_positions::Entity::delete_many()
        .filter(skill_document_positions::Column::SkillId.eq(skill_id))
        .filter(skill_document_positions::Column::Level.eq(&level))
        .exec(db.as_ref())
        .await?;
    
    Ok(StatusCode::NO_CONTENT)
}

// Met à jour plusieurs positions en batch
pub async fn batch_update_positions(
    State(db): State<Arc<DatabaseConnection>>,
    Path(level): Path<String>,
    Json(positions): Json<Vec<SkillPositionInput>>,
) -> Result<Json<Vec<skill_document_positions::Model>>, AppError> {
    let mut results = Vec::new();
    
    for input in positions {
        let now = chrono::Utc::now().naive_utc();
        
        let existing = skill_document_positions::Entity::find()
            .filter(skill_document_positions::Column::SkillId.eq(input.skill_id))
            .filter(skill_document_positions::Column::Level.eq(&level))
            .one(db.as_ref())
            .await?;
        
        let model = if let Some(existing) = existing {
            let mut active: skill_document_positions::ActiveModel = existing.into();
            active.page = Set(input.page);
            active.x = Set(input.x);
            active.y = Set(input.y);
            active.width = Set(input.width);
            active.height = Set(input.height);
            active.font_size = Set(input.font_size);
            active.updated_at = Set(now);
            active.update(db.as_ref()).await?
        } else {
            let active = skill_document_positions::ActiveModel {
                id: Set(Uuid::new_v4()),
                skill_id: Set(input.skill_id),
                level: Set(level.clone()),
                page: Set(input.page),
                x: Set(input.x),
                y: Set(input.y),
                width: Set(input.width),
                height: Set(input.height),
                font_size: Set(input.font_size),
                created_at: Set(now),
                updated_at: Set(now),
            };
            active.insert(db.as_ref()).await?
        };
        
        results.push(model);
    }
    
    Ok(Json(results))
}

// Génère un PDF rempli pour une personne
pub async fn generate_filled_document(
    State(db): State<Arc<DatabaseConnection>>,
    Path((level, person_id)): Path<(String, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    // Récupérer la personne pour le nom du fichier
    let person = people::Entity::find_by_id(person_id)
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;
    
    // Générer le PDF
    let pdf_data = PdfGenerator::generate_filled_document(db.as_ref(), person_id, &level).await?;
    
    let file_name = format!(
        "Competences_{}_{}_{}_{}.pdf",
        level,
        person.last_name,
        person.first_name,
        chrono::Utc::now().format("%Y%m%d")
    );
    
    let headers = [
        (header::CONTENT_TYPE, "application/pdf".to_string()),
        (
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_name),
        ),
    ];
    
    Ok((headers, pdf_data))
}

// Récupère les dimensions d'une page du document
pub async fn get_document_page_info(
    State(db): State<Arc<DatabaseConnection>>,
    Path((level, page)): Path<(String, i32)>,
) -> Result<Json<PageInfo>, AppError> {
    let doc = level_documents::Entity::find()
        .filter(level_documents::Column::Level.eq(&level))
        .one(db.as_ref())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Document not found for level {}", level)))?;
    
    let (width, height) = crate::services::pdf_generator::get_page_dimensions(&doc.file_data, page as usize)?;
    
    Ok(Json(PageInfo { page, width, height }))
}

#[derive(serde::Serialize)]
pub struct PageInfo {
    pub page: i32,
    pub width: f32,
    pub height: f32,
}

// Helper: Compte les pages d'un PDF
fn count_pdf_pages(data: &[u8]) -> Result<i32, AppError> {
    let doc = lopdf::Document::load_mem(data)
        .map_err(|e| AppError::Validation(format!("Invalid PDF: {}", e)))?;
    
    Ok(doc.get_pages().len() as i32)
}

