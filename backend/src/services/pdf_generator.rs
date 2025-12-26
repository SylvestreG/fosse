use lopdf::{Document, Object, Dictionary, ObjectId, Stream};
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
    
    // Créer une police Helvetica-Bold pour l'overlay
    let font_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Font".to_vec())),
        ("Subtype", Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(b"Helvetica-Oblique".to_vec())),
    ]);
    let font_id = doc.add_object(font_dict);
    
    // Créer les annotations
    let mut annotation_refs: Vec<Object> = Vec::new();
    
    for pos in texts {
        let font_size = pos.font_size;
        
        if let Some(ref line2) = pos.line2 {
            // Mode 2 lignes : une seule annotation avec appearance stream personnalisé
            let annot_id = create_styled_annotation(
                doc,
                pos.x, pos.y, pos.width, pos.height,
                &pos.line1, Some(line2),
                font_size, font_id,
            )?;
            annotation_refs.push(Object::Reference(annot_id));
        } else {
            // Mode 1 ligne
            let annot_id = create_styled_annotation(
                doc,
                pos.x, pos.y, pos.width, pos.height,
                &pos.line1, None,
                font_size, font_id,
            )?;
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

/// Crée une annotation FreeText stylée avec coins arrondis
fn create_styled_annotation(
    doc: &mut Document,
    x: f32, y: f32, width: f32, height: f32,
    line1: &str, line2: Option<&str>,
    font_size: f32, font_id: ObjectId,
) -> Result<ObjectId, AppError> {
    let radius = 3.0_f32;
    let border_width = 0.6_f32;
    let padding = 3.0_f32;
    
    // Couleurs RGB (0-1)
    let border_gray = 0.55;
    let bg_gray = 0.97;
    let text_gray = 0.12;
    
    let mut content = Vec::new();
    let w = width;
    let h = height;
    let r = radius.min(w / 4.0).min(h / 4.0);
    
    // Dessiner le fond avec coins arrondis
    writeln!(content, "q").unwrap();
    writeln!(content, "{} g", bg_gray).unwrap();
    writeln!(content, "{} G", border_gray).unwrap();
    writeln!(content, "{} w", border_width).unwrap();
    
    // Rectangle arrondi via courbes de Bézier
    let k = 0.5523; // Constante pour approximer un cercle avec des courbes de Bézier
    writeln!(content, "{:.2} {:.2} m", r, 0.0).unwrap();
    writeln!(content, "{:.2} {:.2} l", w - r, 0.0).unwrap();
    writeln!(content, "{:.2} {:.2} {:.2} {:.2} {:.2} {:.2} c", w - r + r * k, 0.0, w, r - r * k, w, r).unwrap();
    writeln!(content, "{:.2} {:.2} l", w, h - r).unwrap();
    writeln!(content, "{:.2} {:.2} {:.2} {:.2} {:.2} {:.2} c", w, h - r + r * k, w - r + r * k, h, w - r, h).unwrap();
    writeln!(content, "{:.2} {:.2} l", r, h).unwrap();
    writeln!(content, "{:.2} {:.2} {:.2} {:.2} {:.2} {:.2} c", r - r * k, h, 0.0, h - r + r * k, 0.0, h - r).unwrap();
    writeln!(content, "{:.2} {:.2} l", 0.0, r).unwrap();
    writeln!(content, "{:.2} {:.2} {:.2} {:.2} {:.2} {:.2} c", 0.0, r - r * k, r - r * k, 0.0, r, 0.0).unwrap();
    writeln!(content, "B").unwrap(); // Fill and stroke
    writeln!(content, "Q").unwrap();
    
    // Texte
    writeln!(content, "BT").unwrap();
    writeln!(content, "{} g", text_gray).unwrap();
    writeln!(content, "/F1 {} Tf", font_size).unwrap();
    
    if let Some(l2) = line2 {
        // 2 lignes centrées verticalement comme un bloc
        let line_spacing = font_size * 1.25; // Espacement entre les baselines
        let center_y = h / 2.0;
        
        // Centrer le bloc de texte verticalement
        let text_y1 = center_y + line_spacing / 2.0 - font_size * 0.1;
        let text_y2 = text_y1 - line_spacing;
        
        writeln!(content, "{:.2} {:.2} Td", padding, text_y1).unwrap();
        writeln!(content, "({}) Tj", escape_pdf_string(line1)).unwrap();
        writeln!(content, "{:.2} {:.2} Td", 0.0, text_y2 - text_y1).unwrap();
        writeln!(content, "({}) Tj", escape_pdf_string(l2)).unwrap();
    } else {
        // 1 ligne centrée verticalement
        let text_y = (h - font_size) / 2.0 + font_size * 0.25;
        writeln!(content, "{:.2} {:.2} Td", padding, text_y).unwrap();
        writeln!(content, "({}) Tj", escape_pdf_string(line1)).unwrap();
    }
    
    writeln!(content, "ET").unwrap();
    
    // Resources pour l'appearance stream
    let mut font_resources = Dictionary::new();
    font_resources.set("F1", Object::Reference(font_id));
    
    let mut resources = Dictionary::new();
    resources.set("Font", Object::Dictionary(font_resources));
    
    let resources_id = doc.add_object(resources);
    
    // Appearance stream
    let mut ap_stream_dict = Dictionary::new();
    ap_stream_dict.set("Type", Object::Name(b"XObject".to_vec()));
    ap_stream_dict.set("Subtype", Object::Name(b"Form".to_vec()));
    ap_stream_dict.set("BBox", Object::Array(vec![
        Object::Real(0.0),
        Object::Real(0.0),
        Object::Real(width),
        Object::Real(height),
    ]));
    ap_stream_dict.set("Resources", Object::Reference(resources_id));
    
    let ap_stream = Stream::new(ap_stream_dict, content);
    let ap_stream_id = doc.add_object(ap_stream);
    
    // Dictionnaire AP
    let mut ap_dict = Dictionary::new();
    ap_dict.set("N", Object::Reference(ap_stream_id));
    
    // Annotation - type Stamp pour éviter le double rendu FreeText
    let mut annot_dict = Dictionary::new();
    annot_dict.set("Type", Object::Name(b"Annot".to_vec()));
    annot_dict.set("Subtype", Object::Name(b"Stamp".to_vec())); // Stamp au lieu de FreeText
    annot_dict.set("Rect", Object::Array(vec![
        Object::Real(x),
        Object::Real(y),
        Object::Real(x + width),
        Object::Real(y + height),
    ]));
    annot_dict.set("AP", Object::Dictionary(ap_dict));
    annot_dict.set("F", Object::Integer(4)); // Print flag
    annot_dict.set("Border", Object::Array(vec![Object::Integer(0), Object::Integer(0), Object::Integer(0)]));
    annot_dict.set("Name", Object::Name(b"Draft".to_vec())); // Requis pour Stamp
    
    Ok(doc.add_object(annot_dict))
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
