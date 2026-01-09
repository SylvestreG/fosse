use lopdf::{Document, Object, Dictionary, Stream};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};
use uuid::Uuid;
use std::fmt::Write;
use std::collections::HashSet;

use crate::entities::{sessions, rotations, palanquees, palanquee_members, questionnaires, people};
use crate::errors::AppError;
use crate::models::DiverLevel;

/// Données pour générer une fiche de sécurité
#[derive(Debug)]
pub struct FicheSecuriteData {
    pub date: String,
    pub club: String,
    pub directeur_plongee: String,
    pub site: String,
    pub position: String,
    pub securite_surface: String,
    pub observations: String,
    pub rotations: Vec<RotationData>,
    pub effectif_unique: usize,
}

#[derive(Debug)]
pub struct RotationData {
    pub numero: i32,
    pub palanquees: Vec<PalanqueeData>,
}

#[derive(Debug)]
pub struct PalanqueeData {
    pub numero: i32,
    pub planned_departure_time: Option<String>,
    pub planned_time: Option<i32>,
    pub planned_depth: Option<i32>,
    pub actual_departure_time: Option<String>,
    pub actual_return_time: Option<String>,
    pub actual_time: Option<i32>,
    pub actual_depth: Option<i32>,
    pub members: Vec<MemberData>,
}

#[derive(Debug)]
pub struct MemberData {
    pub name: String,
    pub gas: String,
    pub aptitude: String,
    pub preparing: Option<String>,
    pub role: String,
}

/// Génère une fiche de sécurité PDF pour une session
pub async fn generate_fiche_securite(
    db: &DatabaseConnection,
    session_id: Uuid,
    options: FicheSecuriteOptions,
) -> Result<Vec<u8>, AppError> {
    // Récupérer la session
    let session = sessions::Entity::find_by_id(session_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    // Récupérer toutes les rotations et palanquées
    let rotations_list = rotations::Entity::find()
        .filter(rotations::Column::SessionId.eq(session_id))
        .order_by_asc(rotations::Column::Number)
        .all(db)
        .await?;

    let mut rotations_data = vec![];
    let mut unique_questionnaire_ids: HashSet<Uuid> = HashSet::new();

    for rotation in rotations_list {
        let palanquees_list = palanquees::Entity::find()
            .filter(palanquees::Column::RotationId.eq(rotation.id))
            .order_by_asc(palanquees::Column::Number)
            .all(db)
            .await?;

        let mut palanquees_data = vec![];

        for palanquee in palanquees_list {
            let members_list = palanquee_members::Entity::find()
                .filter(palanquee_members::Column::PalanqueeId.eq(palanquee.id))
                .all(db)
                .await?;

            let mut members_data = vec![];
            for member in members_list {
                // Compter les participants uniques
                unique_questionnaire_ids.insert(member.questionnaire_id);

                let questionnaire = questionnaires::Entity::find_by_id(member.questionnaire_id)
                    .one(db)
                    .await?;

                if let Some(q) = questionnaire {
                    let person = people::Entity::find_by_id(q.person_id)
                        .one(db)
                        .await?;

                    if let Some(p) = person {
                        let aptitude = p.diving_level.as_ref()
                            .and_then(|s| DiverLevel::from_string(s))
                            .map(|dl| dl.display())
                            .unwrap_or_default();
                        
                        let preparing = p.diving_level.as_ref()
                            .and_then(|s| DiverLevel::extract_preparing_level(s));

                        members_data.push(MemberData {
                            name: format!("{} {}", p.last_name.to_uppercase(), p.first_name),
                            gas: member.gas_type.clone(),
                            aptitude,
                            preparing,
                            role: member.role.clone(),
                        });
                    }
                }
            }

            // Trier : encadrants d'abord
            members_data.sort_by(|a, b| {
                let role_order = |r: &str| match r {
                    "E" => 0,
                    "GP" => 1,
                    _ => 2,
                };
                role_order(&a.role).cmp(&role_order(&b.role))
            });

            palanquees_data.push(PalanqueeData {
                numero: palanquee.number,
                planned_departure_time: palanquee.planned_departure_time.map(|t| t.format("%H:%M").to_string()),
                planned_time: palanquee.planned_time,
                planned_depth: palanquee.planned_depth,
                actual_departure_time: palanquee.actual_departure_time.map(|t| t.format("%H:%M").to_string()),
                actual_return_time: palanquee.actual_return_time.map(|t| t.format("%H:%M").to_string()),
                actual_time: palanquee.actual_time,
                actual_depth: palanquee.actual_depth,
                members: members_data,
            });
        }

        rotations_data.push(RotationData {
            numero: rotation.number,
            palanquees: palanquees_data,
        });
    }

    let data = FicheSecuriteData {
        date: options.date.unwrap_or_else(|| session.start_date.format("%d/%m/%Y").to_string()),
        club: options.club.unwrap_or_default(),
        directeur_plongee: options.directeur_plongee.unwrap_or_default(),
        site: options.site.unwrap_or_else(|| session.location.unwrap_or_default()),
        position: options.position.unwrap_or_default(),
        securite_surface: options.securite_surface.unwrap_or_default(),
        observations: options.observations.unwrap_or_default(),
        rotations: rotations_data,
        effectif_unique: unique_questionnaire_ids.len(),
    };

    generate_pdf(&data)
}

#[derive(Debug, Default)]
pub struct FicheSecuriteOptions {
    pub date: Option<String>,
    pub club: Option<String>,
    pub directeur_plongee: Option<String>,
    pub site: Option<String>,
    pub position: Option<String>,
    pub securite_surface: Option<String>,
    pub observations: Option<String>,
}

/// Génère le PDF de la fiche de sécurité
fn generate_pdf(data: &FicheSecuriteData) -> Result<Vec<u8>, AppError> {
    let mut doc = Document::with_version("1.5");
    
    // A4 paysage
    let page_width = 842.0_f32;
    let page_height = 595.0_f32;
    
    let font_helvetica = create_font(&mut doc, "Helvetica");
    let font_helvetica_bold = create_font(&mut doc, "Helvetica-Bold");
    
    let mut font_dict = Dictionary::new();
    font_dict.set("F1", Object::Reference(font_helvetica));
    font_dict.set("F2", Object::Reference(font_helvetica_bold));
    
    let mut resources = Dictionary::new();
    resources.set("Font", Object::Dictionary(font_dict));
    let resources_id = doc.add_object(resources);
    
    // Générer le contenu
    let content = generate_page_content(data, page_width, page_height);
    
    let content_stream = Stream::new(Dictionary::new(), content.into_bytes());
    let content_id = doc.add_object(content_stream);
    
    let mut page_dict = Dictionary::new();
    page_dict.set("Type", Object::Name(b"Page".to_vec()));
    page_dict.set("MediaBox", Object::Array(vec![
        Object::Integer(0),
        Object::Integer(0),
        Object::Real(page_width),
        Object::Real(page_height),
    ]));
    page_dict.set("Resources", Object::Reference(resources_id));
    page_dict.set("Contents", Object::Reference(content_id));
    
    let page_id = doc.add_object(page_dict);
    
    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Kids", Object::Array(vec![Object::Reference(page_id)]));
    pages_dict.set("Count", Object::Integer(1));
    let pages_id = doc.add_object(pages_dict);
    
    if let Ok(Object::Dictionary(ref mut page)) = doc.get_object_mut(page_id) {
        page.set("Parent", Object::Reference(pages_id));
    }
    
    let mut catalog_dict = Dictionary::new();
    catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog_dict.set("Pages", Object::Reference(pages_id));
    let catalog_id = doc.add_object(catalog_dict);
    
    doc.trailer.set("Root", Object::Reference(catalog_id));
    
    let mut output = Vec::new();
    doc.save_to(&mut output)
        .map_err(|e| AppError::Internal(format!("Failed to generate PDF: {}", e)))?;
    
    Ok(output)
}

fn create_font(doc: &mut Document, name: &str) -> lopdf::ObjectId {
    let font_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Font".to_vec())),
        ("Subtype", Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(name.as_bytes().to_vec())),
        ("Encoding", Object::Name(b"WinAnsiEncoding".to_vec())),
    ]);
    doc.add_object(font_dict)
}

fn generate_page_content(data: &FicheSecuriteData, width: f32, height: f32) -> String {
    let mut content = String::new();
    let margin = 25.0;
    let mut y = height - margin;
    
    // ===== EN-TÊTE =====
    // Cadre titre
    let header_height = 30.0;
    writeln!(content, "0.2 0.4 0.8 RG 2 w").unwrap(); // Bleu
    writeln!(content, "{} {} {} {} re S", margin, y - header_height, width - 2.0 * margin, header_height).unwrap();
    
    // Titre centré
    writeln!(content, "BT /F2 18 Tf {} {} Td (FICHE DE SECURITE) Tj ET", 
        width / 2.0 - 80.0, y - 20.0).unwrap();
    y -= header_height + 10.0;
    
    // ===== INFOS GÉNÉRALES =====
    let info_box_height = 60.0;
    writeln!(content, "0.9 0.9 0.95 rg {} {} {} {} re f", margin, y - info_box_height, width - 2.0 * margin, info_box_height).unwrap();
    writeln!(content, "0 G 0.5 w {} {} {} {} re S", margin, y - info_box_height, width - 2.0 * margin, info_box_height).unwrap();
    
    let col1 = margin + 10.0;
    let col2 = margin + 200.0;
    let col3 = margin + 450.0;
    let col4 = margin + 650.0;
    
    // Ligne 1
    writeln!(content, "BT /F2 10 Tf {} {} Td (Date:) Tj ET", col1, y - 15.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col1 + 35.0, y - 15.0, escape_pdf(&data.date)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (Club:) Tj ET", col2, y - 15.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col2 + 35.0, y - 15.0, escape_pdf(&data.club)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (Effectif:) Tj ET", col4, y - 15.0).unwrap();
    writeln!(content, "BT /F1 12 Tf {} {} Td ({}) Tj ET", col4 + 50.0, y - 15.0, data.effectif_unique).unwrap();
    
    // Ligne 2
    writeln!(content, "BT /F2 10 Tf {} {} Td (Site:) Tj ET", col1, y - 32.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col1 + 35.0, y - 32.0, escape_pdf(&data.site)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (DP:) Tj ET", col2, y - 32.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col2 + 25.0, y - 32.0, escape_pdf(&data.directeur_plongee)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (Position:) Tj ET", col3, y - 32.0).unwrap();
    writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col3 + 50.0, y - 32.0, escape_pdf(&data.position)).unwrap();
    
    // Ligne 3
    writeln!(content, "BT /F2 10 Tf {} {} Td (S\\351curit\\351 surface:) Tj ET", col1, y - 49.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col1 + 95.0, y - 49.0, escape_pdf(&data.securite_surface)).unwrap();
    
    if !data.observations.is_empty() {
        writeln!(content, "BT /F2 10 Tf {} {} Td (Obs:) Tj ET", col3, y - 49.0).unwrap();
        writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col3 + 30.0, y - 49.0, escape_pdf(&data.observations)).unwrap();
    }
    
    y -= info_box_height + 15.0;
    
    // ===== ROTATIONS ET PALANQUÉES =====
    let row_height = 16.0;
    let pal_header_height = 18.0;
    
    for rotation in &data.rotations {
        // Titre de la rotation
        writeln!(content, "0.2 0.5 0.3 rg {} {} {} {} re f", margin, y - 20.0, width - 2.0 * margin, 20.0).unwrap();
        writeln!(content, "1 1 1 rg").unwrap();
        writeln!(content, "BT /F2 11 Tf {} {} Td (ROTATION {}) Tj ET", margin + 10.0, y - 14.0, rotation.numero).unwrap();
        writeln!(content, "0 g").unwrap(); // Reset to black
        y -= 25.0;
        
        // En-tête du tableau pour cette rotation
        let cols = [160.0, 50.0, 80.0, 80.0, 60.0, 180.0, 172.0];
        let col_headers = ["NOM Pr\\351nom", "Gaz", "Aptitude", "Pr\\351pa", "Fonction", "Param. Pr\\351vus", "Param. R\\351alis\\351s"];
        
        // Fond en-tête
        writeln!(content, "0.85 0.85 0.9 rg {} {} {} {} re f", margin, y - pal_header_height, width - 2.0 * margin, pal_header_height).unwrap();
        
        let mut col_x = margin;
        writeln!(content, "BT /F2 9 Tf").unwrap();
        for (i, &col_w) in cols.iter().enumerate() {
            writeln!(content, "{} {} Td ({}) Tj", col_x + 5.0, y - 12.0, col_headers[i]).unwrap();
            col_x += col_w;
        }
        writeln!(content, "ET").unwrap();
        
        // Lignes verticales de l'en-tête
        writeln!(content, "0 G 0.3 w").unwrap();
        col_x = margin;
        for &col_w in &cols {
            writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, y - pal_header_height).unwrap();
            col_x += col_w;
        }
        writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, y - pal_header_height).unwrap();
        
        // Ligne horizontale sous l'en-tête
        writeln!(content, "{} {} m {} {} l S", margin, y - pal_header_height, margin + width - 2.0 * margin, y - pal_header_height).unwrap();
        
        y -= pal_header_height;
        
        for (pal_idx, palanquee) in rotation.palanquees.iter().enumerate() {
            let num_rows = palanquee.members.len().max(1);
            let pal_height = (num_rows as f32) * row_height;
            
            // Fond alterné
            if pal_idx % 2 == 1 {
                writeln!(content, "0.95 0.95 0.97 rg {} {} {} {} re f", margin, y - pal_height, width - 2.0 * margin, pal_height).unwrap();
            }
            
            // Numéro de palanquée à gauche
            writeln!(content, "0.3 0.3 0.7 rg {} {} {} {} re f", margin - 20.0, y - pal_height, 18.0, pal_height).unwrap();
            writeln!(content, "1 1 1 rg").unwrap();
            writeln!(content, "BT /F2 10 Tf {} {} Td (P{}) Tj ET", margin - 17.0, y - pal_height / 2.0 - 4.0, palanquee.numero).unwrap();
            writeln!(content, "0 g").unwrap();
            
            // Membres
            let mut member_y = y - row_height + 4.0;
            for member in &palanquee.members {
                col_x = margin;
                
                // Nom
                writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(&member.name)).unwrap();
                col_x += cols[0];
                
                // Gaz
                let gas_color = if member.gas == "Nitrox" { "0.8 0.6 0 rg" } else { "0.3 0.5 0.7 rg" };
                writeln!(content, "{}", gas_color).unwrap();
                writeln!(content, "BT /F2 8 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(&member.gas)).unwrap();
                writeln!(content, "0 g").unwrap();
                col_x += cols[1];
                
                // Aptitude
                writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(&member.aptitude)).unwrap();
                col_x += cols[2];
                
                // Prépa
                if let Some(ref prep) = member.preparing {
                    writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(prep)).unwrap();
                }
                col_x += cols[3];
                
                // Fonction avec couleur
                let role_color = match member.role.as_str() {
                    "E" | "GP" => "0.5 0.2 0.5 rg",
                    _ => "0 g",
                };
                writeln!(content, "{}", role_color).unwrap();
                writeln!(content, "BT /F2 9 Tf {} {} Td ({}) Tj ET", col_x + 20.0, member_y, escape_pdf(&member.role)).unwrap();
                writeln!(content, "0 g").unwrap();
                
                member_y -= row_height;
            }
            
            // Paramètres prévus (centrés dans la colonne)
            let params_y = y - pal_height / 2.0 - 4.0;
            col_x = margin + cols[0..5].iter().sum::<f32>();
            
            let planned = format!(
                "{} - {}min - {}m",
                palanquee.planned_departure_time.as_deref().unwrap_or("__:__"),
                palanquee.planned_time.map_or("__".to_string(), |t| t.to_string()),
                palanquee.planned_depth.map_or("__".to_string(), |d| d.to_string())
            );
            writeln!(content, "BT /F1 8 Tf {} {} Td ({}) Tj ET", col_x + 5.0, params_y, escape_pdf(&planned)).unwrap();
            col_x += cols[5];
            
            // Paramètres réalisés
            let actual = format!(
                "{}-{} / {}min / {}m",
                palanquee.actual_departure_time.as_deref().unwrap_or("__:__"),
                palanquee.actual_return_time.as_deref().unwrap_or("__:__"),
                palanquee.actual_time.map_or("__".to_string(), |t| t.to_string()),
                palanquee.actual_depth.map_or("__".to_string(), |d| d.to_string())
            );
            writeln!(content, "BT /F1 8 Tf {} {} Td ({}) Tj ET", col_x + 5.0, params_y, escape_pdf(&actual)).unwrap();
            
            // Lignes verticales
            writeln!(content, "0.7 G 0.3 w").unwrap();
            col_x = margin;
            for &col_w in &cols {
                col_x += col_w;
                writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, y - pal_height).unwrap();
            }
            
            // Ligne horizontale de séparation
            y -= pal_height;
            writeln!(content, "0.5 G {} {} m {} {} l S", margin, y, margin + width - 2.0 * margin, y).unwrap();
        }
        
        // Cadre extérieur de la rotation
        writeln!(content, "0 G 1 w").unwrap();
        
        y -= 15.0; // Espacement entre rotations
    }
    
    // Légende en bas
    y -= 5.0;
    writeln!(content, "BT /F1 8 Tf {} {} Td (E = Encadrant    GP = Guide de Palanqu\\351e    P = Plongeur) Tj ET", margin, y).unwrap();
    
    content
}

/// Échappe une chaîne pour PDF (WinAnsi)
fn escape_pdf(s: &str) -> String {
    let mut result = String::new();
    for c in s.chars() {
        match c {
            '\\' => result.push_str("\\\\"),
            '(' => result.push_str("\\("),
            ')' => result.push_str("\\)"),
            'é' => result.push_str("\\351"),
            'è' => result.push_str("\\350"),
            'ê' => result.push_str("\\352"),
            'à' => result.push_str("\\340"),
            'â' => result.push_str("\\342"),
            'ù' => result.push_str("\\371"),
            'û' => result.push_str("\\373"),
            'î' => result.push_str("\\356"),
            'ï' => result.push_str("\\357"),
            'ô' => result.push_str("\\364"),
            'ç' => result.push_str("\\347"),
            'É' => result.push_str("\\311"),
            'È' => result.push_str("\\310"),
            'Ê' => result.push_str("\\312"),
            'À' => result.push_str("\\300"),
            '°' => result.push_str("\\260"),
            _ if c.is_ascii() => result.push(c),
            _ => result.push('?'),
        }
    }
    result
}
