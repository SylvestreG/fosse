use lopdf::{Document, Object, Stream, Dictionary};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;
use std::io::Write;

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
        
        // Grouper les textes par page
        let mut texts_by_page: std::collections::HashMap<u32, Vec<(f32, f32, String, f32)>> = 
            std::collections::HashMap::new();
        
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
                
                texts_by_page
                    .entry(position.page as u32)
                    .or_default()
                    .push((position.x, position.y, text, position.font_size));
            }
        }
        
        // Ajouter les textes à chaque page
        for (page_num, texts) in texts_by_page {
            add_text_overlay(&mut doc, page_num, &texts)?;
        }
        
        // Sauvegarder le PDF modifié
        let mut output = Vec::new();
        doc.save_to(&mut output)
            .map_err(|e| AppError::Internal(format!("Failed to save PDF: {}", e)))?;
        
        Ok(output)
    }
}

/// Ajoute un overlay de texte à une page PDF
fn add_text_overlay(
    doc: &mut Document,
    page_num: u32,
    texts: &[(f32, f32, String, f32)],
) -> Result<(), AppError> {
    // Récupérer les pages
    let pages = doc.get_pages();
    let page_id = *pages.get(&page_num)
        .ok_or_else(|| AppError::Validation(format!("Page {} not found", page_num)))?;
    
    // Créer une police Helvetica (police standard PDF, toujours disponible)
    let font_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Font".to_vec())),
        ("Subtype", Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(b"Helvetica".to_vec())),
        ("Encoding", Object::Name(b"WinAnsiEncoding".to_vec())),
    ]);
    let font_id = doc.add_object(font_dict);
    
    // Créer le dictionnaire des polices
    let mut fonts_dict = Dictionary::new();
    fonts_dict.set("F1", Object::Reference(font_id));
    let fonts_id = doc.add_object(fonts_dict);
    
    // Créer le dictionnaire des ressources
    let mut resources_dict = Dictionary::new();
    resources_dict.set("Font", Object::Reference(fonts_id));
    let resources_id = doc.add_object(resources_dict);
    
    // Créer le contenu du stream avec tous les textes
    let mut content = Vec::new();
    writeln!(content, "q").unwrap(); // Save graphics state
    
    for (x, y, text, font_size) in texts {
        let escaped_text = escape_pdf_string(text);
        writeln!(content, "BT").unwrap();
        writeln!(content, "/F1 {} Tf", font_size).unwrap();
        writeln!(content, "{} {} Td", x, y).unwrap();
        writeln!(content, "({}) Tj", escaped_text).unwrap();
        writeln!(content, "ET").unwrap();
    }
    
    writeln!(content, "Q").unwrap(); // Restore graphics state
    
    // Créer le stream de contenu (non utilisé directement, on utilise le Form XObject)
    let content_stream = Stream::new(Dictionary::new(), content);
    let _content_id = doc.add_object(Object::Stream(content_stream));
    
    // Créer un nouveau XObject Form pour notre overlay
    let mut form_dict = Dictionary::new();
    form_dict.set("Type", Object::Name(b"XObject".to_vec()));
    form_dict.set("Subtype", Object::Name(b"Form".to_vec()));
    form_dict.set("BBox", Object::Array(vec![
        Object::Integer(0),
        Object::Integer(0),
        Object::Integer(1000),
        Object::Integer(1000),
    ]));
    form_dict.set("Resources", Object::Reference(resources_id));
    
    // Créer le contenu du form
    let mut form_content = Vec::new();
    for (x, y, text, font_size) in texts {
        let escaped_text = escape_pdf_string(text);
        writeln!(form_content, "BT").unwrap();
        writeln!(form_content, "/F1 {} Tf", font_size).unwrap();
        writeln!(form_content, "{} {} Td", x, y).unwrap();
        writeln!(form_content, "({}) Tj", escaped_text).unwrap();
        writeln!(form_content, "ET").unwrap();
    }
    
    let form_stream = Stream::new(form_dict, form_content);
    let form_id = doc.add_object(Object::Stream(form_stream));
    
    // Créer un stream qui appelle le form
    let mut invoke_content = Vec::new();
    writeln!(invoke_content, "q /Overlay Do Q").unwrap();
    let invoke_stream = Stream::new(Dictionary::new(), invoke_content);
    let invoke_id = doc.add_object(Object::Stream(invoke_stream));
    
    // Maintenant mettre à jour la page
    // D'abord, lire les infos de la page
    let (existing_contents, existing_resources) = {
        let page = doc.get_object(page_id)
            .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?
            .as_dict()
            .map_err(|e| AppError::Internal(format!("Page is not a dict: {}", e)))?;
        
        let contents = page.get(b"Contents").ok().cloned();
        let resources = page.get(b"Resources").ok().and_then(|r| r.as_reference().ok());
        (contents, resources)
    };
    
    // Créer XObjects dict avec notre overlay
    let mut xobjects_dict = Dictionary::new();
    xobjects_dict.set("Overlay", Object::Reference(form_id));
    let xobjects_id = doc.add_object(xobjects_dict);
    
    // Mettre à jour ou créer les resources de la page
    if let Some(res_ref) = existing_resources {
        // Ajouter XObject aux resources existantes
        let res = doc.get_object(res_ref)
            .map_err(|e| AppError::Internal(format!("Failed to get resources: {}", e)))?
            .as_dict()
            .map_err(|_| AppError::Internal("Resources is not a dict".to_string()))?
            .clone();
        
        let mut new_res = res;
        new_res.set("XObject", Object::Reference(xobjects_id));
        doc.objects.insert(res_ref, Object::Dictionary(new_res));
    }
    
    // Mettre à jour Contents pour inclure notre stream
    let new_contents = if let Some(contents) = existing_contents {
        match contents {
            Object::Array(mut arr) => {
                arr.push(Object::Reference(invoke_id));
                Object::Array(arr)
            }
            Object::Reference(ref_id) => {
                Object::Array(vec![
                    Object::Reference(ref_id),
                    Object::Reference(invoke_id),
                ])
            }
            _ => Object::Reference(invoke_id),
        }
    } else {
        Object::Reference(invoke_id)
    };
    
    // Si pas de resources existantes, créer les nôtres maintenant
    let new_res_id = if existing_resources.is_none() {
        let mut new_res = Dictionary::new();
        new_res.set("XObject", Object::Reference(xobjects_id));
        new_res.set("Font", Object::Reference(fonts_id));
        Some(doc.add_object(new_res))
    } else {
        None
    };
    
    // Appliquer les modifications à la page
    let page_obj = doc.get_object_mut(page_id)
        .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?;
    
    if let Object::Dictionary(ref mut page_dict) = page_obj {
        page_dict.set("Contents", new_contents);
        
        if let Some(res_id) = new_res_id {
            page_dict.set("Resources", Object::Reference(res_id));
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
        let width = media_box[2].as_float().unwrap_or(612.0);
        let height = media_box[3].as_float().unwrap_or(792.0);
        Ok((width as f32, height as f32))
    } else {
        Ok((612.0, 792.0))
    }
}
