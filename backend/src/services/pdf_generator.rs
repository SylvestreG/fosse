use lopdf::{Document, Object, Dictionary, ObjectId};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::{
    level_documents, skill_document_positions, skill_validations,
    people,
};
use crate::errors::AppError;
use crate::models::diving_level::DivingLevel;

pub struct PdfGenerator;

#[derive(Clone)]
#[allow(dead_code)]
struct TextPosition {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    line1: String,
    line2: Option<String>,
    font_size: f32,
}

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
        
        // Grouper les textes par page
        let mut texts_by_page: std::collections::HashMap<u32, Vec<TextPosition>> = 
            std::collections::HashMap::new();
        
        for position in positions {
            if let Some(validation) = validation_map.get(&position.skill_id) {
                // Récupérer le validateur avec son niveau le plus élevé
                let (validator_name, validator_level) = if let Some(validator) = people::Entity::find_by_id(validation.validated_by_id)
                    .one(db)
                    .await?
                {
                    let name = format!("{} {}", validator.first_name, validator.last_name);
                    let level = validator.diving_level
                        .as_ref()
                        .map(|levels| get_highest_level(levels))
                        .unwrap_or_default();
                    (name, level)
                } else {
                    ("?".to_string(), String::new())
                };
                
                // Formater la date
                let date_str = validation.validated_at.format("%d/%m/%Y").to_string();
                
                // Déterminer si on peut afficher sur 2 lignes
                let can_use_two_lines = position.height >= position.font_size * 2.5;
                
                let (line1, line2) = if can_use_two_lines {
                    let second_line = if validator_level.is_empty() {
                        validator_name
                    } else {
                        format!("{} ({})", validator_name, validator_level)
                    };
                    (date_str, Some(second_line))
                } else {
                    (format!("{} - {}", date_str, validator_name), None)
                };
                
                texts_by_page
                    .entry(position.page as u32)
                    .or_default()
                    .push(TextPosition {
                        x: position.x,
                        y: position.y,
                        width: position.width,
                        height: position.height,
                        line1,
                        line2,
                        font_size: position.font_size,
                    });
            }
        }
        
        // Ajouter les annotations à chaque page
        for (page_num, texts) in texts_by_page {
            add_freetext_annotations(&mut doc, page_num, &texts)?;
        }
        
        // Sauvegarder le PDF modifié
        let mut output = Vec::new();
        doc.save_to(&mut output)
            .map_err(|e| AppError::Internal(format!("Failed to save PDF: {}", e)))?;
        
        Ok(output)
    }
}

/// Ajoute des annotations FreeText à une page PDF (ne modifie pas le contenu existant)
fn add_freetext_annotations(
    doc: &mut Document,
    page_num: u32,
    texts: &[TextPosition],
) -> Result<(), AppError> {
    let pages = doc.get_pages();
    let page_id = *pages.get(&page_num)
        .ok_or_else(|| AppError::Validation(format!("Page {} not found", page_num)))?;
    
    // Créer les annotations
    let mut annotation_refs: Vec<Object> = Vec::new();
    
    for pos in texts {
        let font_size = pos.font_size;
        let da_string = format!("/Helv {} Tf 0 g", font_size as i32);
        
        if let Some(ref line2) = pos.line2 {
            // Mode 2 lignes : créer 2 annotations distinctes
            let half_height = pos.height / 2.0;
            
            // Ligne 1 (date) - partie haute
            let rect1 = Object::Array(vec![
                Object::Real(pos.x),
                Object::Real(pos.y + half_height),
                Object::Real(pos.x + pos.width),
                Object::Real(pos.y + pos.height),
            ]);
            
            let mut annot1 = Dictionary::new();
            annot1.set("Type", Object::Name(b"Annot".to_vec()));
            annot1.set("Subtype", Object::Name(b"FreeText".to_vec()));
            annot1.set("Rect", rect1);
            annot1.set("Contents", Object::String(pos.line1.as_bytes().to_vec(), lopdf::StringFormat::Literal));
            annot1.set("DA", Object::String(da_string.as_bytes().to_vec(), lopdf::StringFormat::Literal));
            annot1.set("Q", Object::Integer(0));
            annot1.set("Border", Object::Array(vec![Object::Integer(0), Object::Integer(0), Object::Integer(0)]));
            annot1.set("F", Object::Integer(4));
            
            let annot1_id = doc.add_object(annot1);
            annotation_refs.push(Object::Reference(annot1_id));
            
            // Ligne 2 (nom + niveau) - partie basse
            let rect2 = Object::Array(vec![
                Object::Real(pos.x),
                Object::Real(pos.y),
                Object::Real(pos.x + pos.width),
                Object::Real(pos.y + half_height),
            ]);
            
            let mut annot2 = Dictionary::new();
            annot2.set("Type", Object::Name(b"Annot".to_vec()));
            annot2.set("Subtype", Object::Name(b"FreeText".to_vec()));
            annot2.set("Rect", rect2);
            annot2.set("Contents", Object::String(line2.as_bytes().to_vec(), lopdf::StringFormat::Literal));
            annot2.set("DA", Object::String(da_string.as_bytes().to_vec(), lopdf::StringFormat::Literal));
            annot2.set("Q", Object::Integer(0));
            annot2.set("Border", Object::Array(vec![Object::Integer(0), Object::Integer(0), Object::Integer(0)]));
            annot2.set("F", Object::Integer(4));
            
            let annot2_id = doc.add_object(annot2);
            annotation_refs.push(Object::Reference(annot2_id));
        } else {
            // Mode 1 ligne : une seule annotation
            let rect = Object::Array(vec![
                Object::Real(pos.x),
                Object::Real(pos.y),
                Object::Real(pos.x + pos.width),
                Object::Real(pos.y + pos.height),
            ]);
            
            let mut annot_dict = Dictionary::new();
            annot_dict.set("Type", Object::Name(b"Annot".to_vec()));
            annot_dict.set("Subtype", Object::Name(b"FreeText".to_vec()));
            annot_dict.set("Rect", rect);
            annot_dict.set("Contents", Object::String(pos.line1.as_bytes().to_vec(), lopdf::StringFormat::Literal));
            annot_dict.set("DA", Object::String(da_string.as_bytes().to_vec(), lopdf::StringFormat::Literal));
            annot_dict.set("Q", Object::Integer(0));
            annot_dict.set("Border", Object::Array(vec![Object::Integer(0), Object::Integer(0), Object::Integer(0)]));
            annot_dict.set("F", Object::Integer(4));
            
            let annot_id = doc.add_object(annot_dict);
            annotation_refs.push(Object::Reference(annot_id));
        }
    }
    
    // D'abord, lire les annotations existantes
    let existing_annots = {
        let page = doc.get_object(page_id)
            .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?
            .as_dict()
            .map_err(|e| AppError::Internal(format!("Page is not a dict: {}", e)))?;
        page.get(b"Annots").ok().cloned()
    };
    
    // Résoudre les références si nécessaire
    let existing_array = if let Some(Object::Reference(ref_id)) = existing_annots {
        doc.get_object(ref_id).ok().and_then(|o| {
            if let Object::Array(arr) = o {
                Some(arr.clone())
            } else {
                None
            }
        })
    } else if let Some(Object::Array(arr)) = existing_annots {
        Some(arr)
    } else {
        None
    };
    
    // Créer le nouveau tableau d'annotations
    let new_annots = if let Some(mut arr) = existing_array {
        arr.extend(annotation_refs);
        Object::Array(arr)
    } else {
        Object::Array(annotation_refs)
    };
    
    // Mettre à jour la page
    let page_obj = doc.get_object_mut(page_id)
        .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?;
    
    if let Object::Dictionary(ref mut page_dict) = page_obj {
        page_dict.set("Annots", new_annots);
    }
    
    Ok(())
}

/// Obtient les dimensions d'une page à partir du document
#[allow(dead_code)]
fn get_page_dimensions_from_doc(doc: &Document, page_id: ObjectId) -> Result<(f32, f32), AppError> {
    let page = doc.get_object(page_id)
        .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?
        .as_dict()
        .map_err(|e| AppError::Internal(format!("Page is not a dict: {}", e)))?;
    
    let media_box = page.get(b"MediaBox")
        .or_else(|_| page.get(b"CropBox"))
        .map_err(|_| AppError::Internal("No MediaBox or CropBox found".to_string()))?
        .as_array()
        .map_err(|_| AppError::Internal("MediaBox is not an array".to_string()))?;
    
    if media_box.len() >= 4 {
        let width = media_box[2].as_float().unwrap_or(612.0);
        let height = media_box[3].as_float().unwrap_or(792.0);
        Ok((width as f32, height as f32))
    } else {
        Ok((612.0, 792.0))
    }
}

/// Échappe les caractères spéciaux pour une chaîne PDF
#[allow(dead_code)]
fn escape_pdf_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

/// Extrait le niveau le plus élevé d'une chaîne de niveaux séparés par des virgules
fn get_highest_level(levels_str: &str) -> String {
    let mut highest: Option<DivingLevel> = None;
    let mut highest_hierarchy: u8 = 0;
    
    for level_str in levels_str.split(',') {
        let trimmed = level_str.trim();
        if let Some(level) = DivingLevel::parse(trimmed) {
            let h = level.hierarchy();
            if h > highest_hierarchy {
                highest_hierarchy = h;
                highest = Some(level);
            }
        }
    }
    
    highest.map(|l| l.to_string()).unwrap_or_default()
}

#[allow(dead_code)]
/// Obtient les dimensions d'une page PDF
pub fn get_page_dimensions(data: &[u8], page_num: usize) -> Result<(f32, f32), AppError> {
    let doc = Document::load_mem(data)
        .map_err(|e| AppError::Validation(format!("Invalid PDF: {}", e)))?;
    
    let pages = doc.get_pages();
    let page_id = pages.get(&(page_num as u32))
        .ok_or_else(|| AppError::Validation(format!("Page {} not found", page_num)))?;
    
    get_page_dimensions_from_doc(&doc, *page_id)
}
