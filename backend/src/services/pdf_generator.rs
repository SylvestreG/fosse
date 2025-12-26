use lopdf::{Document, Object, Stream, Dictionary, ObjectId};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;
use std::io::Write;

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
    line2: Option<String>,  // None si tout tient sur une ligne
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
                    // Extraire le niveau le plus élevé si plusieurs niveaux
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
                // On considère qu'il faut au moins 2.5x la taille de police pour 2 lignes
                let can_use_two_lines = position.height >= position.font_size * 2.5;
                
                let (line1, line2) = if can_use_two_lines {
                    // 2 lignes : date sur la première, nom + niveau sur la seconde
                    let second_line = if validator_level.is_empty() {
                        validator_name
                    } else {
                        format!("{} ({})", validator_name, validator_level)
                    };
                    (date_str, Some(second_line))
                } else {
                    // 1 seule ligne : tout condensé
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

/// Ajoute un overlay de texte à une page PDF sans modifier le contenu existant
fn add_text_overlay(
    doc: &mut Document,
    page_num: u32,
    texts: &[TextPosition],
) -> Result<(), AppError> {
    // Récupérer les pages
    let pages = doc.get_pages();
    let page_id = *pages.get(&page_num)
        .ok_or_else(|| AppError::Validation(format!("Page {} not found", page_num)))?;
    
    // Créer une police Helvetica avec un nom unique pour éviter les conflits
    let font_name = b"OverlayFont".to_vec();
    let font_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Font".to_vec())),
        ("Subtype", Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(b"Helvetica".to_vec())),
    ]);
    let font_id = doc.add_object(font_dict);
    
    // Créer le dictionnaire des polices pour l'overlay
    let mut overlay_fonts = Dictionary::new();
    overlay_fonts.set(font_name.clone(), Object::Reference(font_id));
    let overlay_fonts_id = doc.add_object(overlay_fonts);
    
    // Créer le dictionnaire des ressources pour l'overlay
    let mut overlay_resources = Dictionary::new();
    overlay_resources.set("Font", Object::Reference(overlay_fonts_id));
    let overlay_resources_id = doc.add_object(overlay_resources);
    
    // Créer le contenu du Form XObject
    let mut form_content = Vec::new();
    
    for pos in texts {
        if let Some(ref line2) = pos.line2 {
            // Mode 2 lignes : centrer les deux lignes dans la zone
            let line_spacing = pos.font_size * 1.2;
            let total_height = pos.font_size * 2.0 + (line_spacing - pos.font_size);
            let start_y = pos.y + (pos.height / 2.0) + (total_height / 2.0) - pos.font_size;
            
            // Ligne 1 (date) - en haut
            let escaped_line1 = escape_pdf_string(&pos.line1);
            write!(form_content, "BT ").unwrap();
            write!(form_content, "/OverlayFont {} Tf ", pos.font_size).unwrap();
            write!(form_content, "{:.2} {:.2} Td ", pos.x, start_y).unwrap();
            write!(form_content, "({}) Tj ", escaped_line1).unwrap();
            writeln!(form_content, "ET").unwrap();
            
            // Ligne 2 (nom + niveau) - en bas
            let escaped_line2 = escape_pdf_string(line2);
            let y2 = start_y - line_spacing;
            write!(form_content, "BT ").unwrap();
            write!(form_content, "/OverlayFont {} Tf ", pos.font_size).unwrap();
            write!(form_content, "{:.2} {:.2} Td ", pos.x, y2).unwrap();
            write!(form_content, "({}) Tj ", escaped_line2).unwrap();
            writeln!(form_content, "ET").unwrap();
        } else {
            // Mode 1 ligne : centrer verticalement
            let escaped_text = escape_pdf_string(&pos.line1);
            let centered_y = pos.y + (pos.height / 2.0) - (pos.font_size / 3.0);
            
            write!(form_content, "BT ").unwrap();
            write!(form_content, "/OverlayFont {} Tf ", pos.font_size).unwrap();
            write!(form_content, "{:.2} {:.2} Td ", pos.x, centered_y).unwrap();
            write!(form_content, "({}) Tj ", escaped_text).unwrap();
            writeln!(form_content, "ET").unwrap();
        }
    }
    
    // Obtenir les dimensions de la page pour le BBox du Form
    let (page_width, page_height) = get_page_dimensions_from_doc(doc, page_id)?;
    
    // Créer le Form XObject
    let mut form_dict = Dictionary::new();
    form_dict.set("Type", Object::Name(b"XObject".to_vec()));
    form_dict.set("Subtype", Object::Name(b"Form".to_vec()));
    form_dict.set("FormType", Object::Integer(1));
    form_dict.set("BBox", Object::Array(vec![
        Object::Real(0.0),
        Object::Real(0.0),
        Object::Real(page_width),
        Object::Real(page_height),
    ]));
    form_dict.set("Resources", Object::Reference(overlay_resources_id));
    
    let form_stream = Stream::new(form_dict, form_content);
    let form_id = doc.add_object(Object::Stream(form_stream));
    
    // Créer le stream d'invocation (ce qu'on ajoute à la page)
    let xobject_name = b"ValidationOverlay".to_vec();
    let mut invoke_content = Vec::new();
    writeln!(invoke_content, "q").unwrap();
    writeln!(invoke_content, "/ValidationOverlay Do").unwrap();
    writeln!(invoke_content, "Q").unwrap();
    
    let invoke_stream = Stream::new(Dictionary::new(), invoke_content);
    let invoke_id = doc.add_object(Object::Stream(invoke_stream));
    
    // Lire les infos de la page (resources existantes)
    let existing_resources_id = {
        let page = doc.get_object(page_id)
            .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?
            .as_dict()
            .map_err(|e| AppError::Internal(format!("Page is not a dict: {}", e)))?;
        
        page.get(b"Resources").ok().and_then(|r| r.as_reference().ok())
    };
    
    // Créer un XObjects dict avec notre overlay
    let mut new_xobjects = Dictionary::new();
    new_xobjects.set(xobject_name.clone(), Object::Reference(form_id));
    let new_xobjects_id = doc.add_object(new_xobjects);
    
    // Mettre à jour les resources de la page
    if let Some(res_id) = existing_resources_id {
        // Récupérer les resources existantes
        let existing_res = doc.get_object(res_id)
            .map_err(|e| AppError::Internal(format!("Failed to get resources: {}", e)))?
            .as_dict()
            .map_err(|_| AppError::Internal("Resources is not a dict".to_string()))?
            .clone();
        
        let mut updated_res = existing_res;
        
        // Fusionner les XObjects existants avec le nôtre
        if let Ok(existing_xobj) = updated_res.get(b"XObject") {
            if let Ok(existing_xobj_id) = existing_xobj.as_reference() {
                // Ajouter notre overlay aux XObjects existants
                let existing_xobj_dict = doc.get_object(existing_xobj_id)
                    .map_err(|e| AppError::Internal(format!("Failed to get XObjects: {}", e)))?
                    .as_dict()
                    .map_err(|_| AppError::Internal("XObjects is not a dict".to_string()))?
                    .clone();
                
                let mut merged_xobj = existing_xobj_dict;
                merged_xobj.set(xobject_name, Object::Reference(form_id));
                doc.objects.insert(existing_xobj_id, Object::Dictionary(merged_xobj));
            }
        } else {
            // Pas de XObjects existants, ajouter le nôtre
            updated_res.set("XObject", Object::Reference(new_xobjects_id));
            doc.objects.insert(res_id, Object::Dictionary(updated_res));
        }
    } else {
        // Pas de resources, on en crée
        let mut new_res = Dictionary::new();
        new_res.set("XObject", Object::Reference(new_xobjects_id));
        let new_res_id = doc.add_object(new_res);
        
        // Mettre à jour la page avec les nouvelles resources
        let page_obj = doc.get_object_mut(page_id)
            .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?;
        if let Object::Dictionary(ref mut page_dict) = page_obj {
            page_dict.set("Resources", Object::Reference(new_res_id));
        }
    }
    
    // Ajouter notre stream d'invocation à Contents
    let page_obj = doc.get_object_mut(page_id)
        .map_err(|e| AppError::Internal(format!("Failed to get page: {}", e)))?;
    
    if let Object::Dictionary(ref mut page_dict) = page_obj {
        let new_contents = if let Ok(contents) = page_dict.get(b"Contents") {
            match contents.clone() {
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
        
        page_dict.set("Contents", new_contents);
    }
    
    Ok(())
}

/// Obtient les dimensions d'une page à partir du document
fn get_page_dimensions_from_doc(doc: &Document, page_id: ObjectId) -> Result<(f32, f32), AppError> {
    let page = doc.get_object(page_id)
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

/// Échappe les caractères spéciaux pour une chaîne PDF
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
