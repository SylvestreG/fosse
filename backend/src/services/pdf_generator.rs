use lopdf::{Document, Object};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::{
    level_documents, skill_document_positions, skill_validations,
    people,
};
use crate::errors::AppError;

pub struct PdfGenerator;

impl PdfGenerator {
    /// Génère un PDF rempli avec les validations d'une personne
    pub async fn generate_filled_document(
        db: &DatabaseConnection,
        person_id: Uuid,
        level: &str,
    ) -> Result<Vec<u8>, AppError> {
        // Récupérer la personne
        let _person = people::Entity::find_by_id(person_id)
            .one(db)
            .await?
            .ok_or_else(|| AppError::NotFound("Person not found".to_string()))?;
        
        // Récupérer le document template
        let doc_entity = level_documents::Entity::find()
            .filter(level_documents::Column::Level.eq(level))
            .one(db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("No document template for level {}", level)))?;
        
        // Charger le PDF
        let mut doc = Document::load_mem(&doc_entity.file_data)
            .map_err(|e| AppError::Internal(format!("Failed to load PDF: {}", e)))?;
        
        // Récupérer les positions des skills
        let positions = skill_document_positions::Entity::find()
            .filter(skill_document_positions::Column::Level.eq(level))
            .all(db)
            .await?;
        
        // Récupérer les validations de la personne
        let validations = skill_validations::Entity::find()
            .filter(skill_validations::Column::PersonId.eq(person_id))
            .all(db)
            .await?;
        
        // Créer un map des validations par skill_id
        let validation_map: std::collections::HashMap<Uuid, _> = validations
            .into_iter()
            .map(|v| (v.skill_id, v))
            .collect();
        
        // Pour chaque position, ajouter le texte si la compétence est validée
        for position in positions {
            if let Some(validation) = validation_map.get(&position.skill_id) {
                // Récupérer le nom du validateur
                let validator_name = if let Some(validator) = people::Entity::find_by_id(validation.validated_by_id)
                    .one(db)
                    .await?
                {
                    format!("{} {}", validator.first_name, validator.last_name)
                } else {
                    "?".to_string()
                };
                
                // Formater la date
                let date_str = validation.validated_at.format("%d/%m/%Y").to_string();
                
                // Texte à afficher
                let text = format!("{} - {}", date_str, validator_name);
                
                // Ajouter le texte au PDF
                add_text_to_pdf(
                    &mut doc,
                    position.page as usize,
                    position.x,
                    position.y,
                    &text,
                    position.font_size,
                )?;
            }
        }
        
        // Ajouter le nom de la personne en haut (optionnel - à configurer)
        // On pourrait ajouter une position spéciale pour le nom
        
        // Sauvegarder le PDF modifié
        let mut output = Vec::new();
        doc.save_to(&mut output)
            .map_err(|e| AppError::Internal(format!("Failed to save PDF: {}", e)))?;
        
        Ok(output)
    }
}

/// Ajoute du texte à une page PDF
fn add_text_to_pdf(
    doc: &mut Document,
    page_num: usize,
    x: f32,
    y: f32,
    text: &str,
    font_size: f32,
) -> Result<(), AppError> {
    // Récupérer les pages
    let pages = doc.get_pages();
    let page_id = pages.get(&(page_num as u32))
        .ok_or_else(|| AppError::Validation(format!("Page {} not found", page_num)))?;
    
    // Obtenir le dictionnaire de la page
    let page = doc.get_object(*page_id)
        .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?
        .as_dict()
        .map_err(|e| AppError::Internal(format!("Page is not a dict: {}", e)))?
        .clone();
    
    // Récupérer ou créer le flux de contenu
    if let Ok(contents_ref) = page.get(b"Contents") {
        if let Ok(contents_id) = contents_ref.as_reference() {
            // Ajouter notre texte au contenu existant
            let content_stream = format!(
                "\nBT /F1 {} Tf {} {} Td ({}) Tj ET\n",
                font_size,
                x,
                y,
                escape_pdf_string(text)
            );
            
            // Obtenir le contenu existant
            if let Ok(Object::Stream(mut stream)) = doc.get_object(contents_id).cloned() {
                let existing_content = stream.content.clone();
                let mut new_content = existing_content;
                new_content.extend_from_slice(content_stream.as_bytes());
                stream.content = new_content;
                stream.set_plain_content(stream.content.clone());
                
                doc.objects.insert(contents_id, Object::Stream(stream));
            }
        }
    }
    
    Ok(())
}

/// Échappe les caractères spéciaux pour une chaîne PDF
fn escape_pdf_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

#[allow(dead_code)]
/// Obtient les dimensions d'une page PDF
pub fn get_page_dimensions(data: &[u8], page_num: usize) -> Result<(f32, f32), AppError> {
    let doc = Document::load_mem(data)
        .map_err(|e| AppError::Validation(format!("Invalid PDF: {}", e)))?;
    
    let pages = doc.get_pages();
    let page_id = pages.get(&(page_num as u32))
        .ok_or_else(|| AppError::Validation(format!("Page {} not found", page_num)))?;
    
    let page = doc.get_object(*page_id)
        .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?
        .as_dict()
        .map_err(|e| AppError::Internal(format!("Page is not a dict: {}", e)))?;
    
    // Essayer MediaBox ou CropBox
    let media_box = page.get(b"MediaBox")
        .or_else(|_| page.get(b"CropBox"))
        .map_err(|_| AppError::Internal("No MediaBox or CropBox found".to_string()))?
        .as_array()
        .map_err(|_| AppError::Internal("MediaBox is not an array".to_string()))?;
    
    if media_box.len() >= 4 {
        let width = media_box[2].as_float().unwrap_or(612.0); // Default letter width
        let height = media_box[3].as_float().unwrap_or(792.0); // Default letter height
        Ok((width as f32, height as f32))
    } else {
        Ok((612.0, 792.0)) // Default
    }
}

