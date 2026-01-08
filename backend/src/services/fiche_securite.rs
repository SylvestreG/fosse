use lopdf::{Document, Object, Dictionary, Stream};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};
use uuid::Uuid;
use std::fmt::Write;

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
    pub palanquees: Vec<PalanqueeData>,
}

#[derive(Debug)]
pub struct PalanqueeData {
    pub rotation: i32,
    pub numero: i32,
    pub call_sign: Option<String>,
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
    pub aptitude: String,  // PE-PA-PN-Brevet
    pub preparing: Option<String>,
    pub role: String,      // E, P, GP
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

    let mut palanquees_data = vec![];

    for rotation in rotations_list {
        let palanquees_list = palanquees::Entity::find()
            .filter(palanquees::Column::RotationId.eq(rotation.id))
            .order_by_asc(palanquees::Column::Number)
            .all(db)
            .await?;

        for palanquee in palanquees_list {
            let members_list = palanquee_members::Entity::find()
                .filter(palanquee_members::Column::PalanqueeId.eq(palanquee.id))
                .all(db)
                .await?;

            let mut members_data = vec![];
            for member in members_list {
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
                rotation: rotation.number,
                numero: palanquee.number,
                call_sign: palanquee.call_sign.clone(),
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
    }

    let data = FicheSecuriteData {
        date: options.date.unwrap_or_else(|| session.start_date.format("%d/%m/%Y").to_string()),
        club: options.club.unwrap_or_default(),
        directeur_plongee: options.directeur_plongee.unwrap_or_default(),
        site: options.site.unwrap_or_else(|| session.location.unwrap_or_default()),
        position: options.position.unwrap_or_default(),
        securite_surface: options.securite_surface.unwrap_or_default(),
        observations: options.observations.unwrap_or_default(),
        palanquees: palanquees_data,
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
    // Créer un nouveau document PDF A4 paysage
    let mut doc = Document::with_version("1.5");
    
    // Page A4 paysage : 842 x 595 points (297 x 210 mm)
    let page_width = 842.0_f32;
    let page_height = 595.0_f32;
    
    // Créer une police Helvetica
    let font_helvetica = create_font(&mut doc, "Helvetica");
    let font_helvetica_bold = create_font(&mut doc, "Helvetica-Bold");
    
    // Resources dict
    let mut font_dict = Dictionary::new();
    font_dict.set("F1", Object::Reference(font_helvetica));
    font_dict.set("F2", Object::Reference(font_helvetica_bold));
    
    let mut resources = Dictionary::new();
    resources.set("Font", Object::Dictionary(font_dict));
    let resources_id = doc.add_object(resources);
    
    // Générer le contenu de la page
    let content = generate_page_content(data, page_width, page_height);
    
    // Créer le stream de contenu
    let content_stream = Stream::new(Dictionary::new(), content.into_bytes());
    let content_id = doc.add_object(content_stream);
    
    // Créer la page
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
    
    // Créer le noeud Pages
    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Kids", Object::Array(vec![Object::Reference(page_id)]));
    pages_dict.set("Count", Object::Integer(1));
    let pages_id = doc.add_object(pages_dict);
    
    // Mettre à jour la page avec son parent
    if let Ok(Object::Dictionary(ref mut page)) = doc.get_object_mut(page_id) {
        page.set("Parent", Object::Reference(pages_id));
    }
    
    // Créer le catalogue
    let mut catalog_dict = Dictionary::new();
    catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog_dict.set("Pages", Object::Reference(pages_id));
    let catalog_id = doc.add_object(catalog_dict);
    
    // Définir le trailer
    doc.trailer.set("Root", Object::Reference(catalog_id));
    
    // Sauvegarder
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
    let margin = 30.0;
    let mut y = height - margin;
    
    // === EN-TÊTE ===
    // Titre
    writeln!(content, "BT /F2 16 Tf {} {} Td (Fiche de S\\351curit\\351) Tj ET", margin, y).unwrap();
    y -= 25.0;
    
    // Ligne d'infos
    let info_y = y;
    writeln!(content, "BT /F1 10 Tf {} {} Td (Date: {}) Tj ET", margin, info_y, escape_pdf(&data.date)).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td (Club: {}) Tj ET", margin + 120.0, info_y, escape_pdf(&data.club)).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td (Directeur de Plong\\351e: {}) Tj ET", margin + 280.0, info_y, escape_pdf(&data.directeur_plongee)).unwrap();
    y -= 15.0;
    
    writeln!(content, "BT /F1 10 Tf {} {} Td (Site: {}) Tj ET", margin, y, escape_pdf(&data.site)).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td (Position: {}) Tj ET", margin + 200.0, y, escape_pdf(&data.position)).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td (Effectif: {}) Tj ET", margin + 450.0, y, data.palanquees.iter().map(|p| p.members.len()).sum::<usize>()).unwrap();
    y -= 15.0;
    
    writeln!(content, "BT /F1 10 Tf {} {} Td (S\\351curit\\351 surface: {}) Tj ET", margin, y, escape_pdf(&data.securite_surface)).unwrap();
    y -= 15.0;
    
    if !data.observations.is_empty() {
        writeln!(content, "BT /F1 9 Tf {} {} Td (Observations: {}) Tj ET", margin, y, escape_pdf(&data.observations)).unwrap();
    }
    y -= 20.0;
    
    // === TABLEAU DES PALANQUÉES ===
    // Dessiner le cadre
    let table_x = margin;
    let table_width = width - 2.0 * margin;
    let row_height = 18.0;
    let header_height = 22.0;
    
    // Calculer le nombre de lignes nécessaires
    let total_rows: usize = data.palanquees.iter()
        .map(|p| p.members.len().max(1) + 2) // membres + header + params
        .sum();
    
    let table_height = header_height + (total_rows as f32) * row_height;
    let table_y = y - table_height;
    
    // Fond gris clair pour l'en-tête
    writeln!(content, "0.9 g {} {} {} {} re f", table_x, y - header_height, table_width, header_height).unwrap();
    
    // Colonnes: Rot | Pal | Appel | Nom | Gaz | Aptitude | Formation | Fonction | Params
    let cols = [40.0, 40.0, 50.0, 180.0, 50.0, 80.0, 80.0, 60.0, 202.0]; // Total = 782
    let mut col_x = table_x;
    
    // En-tête du tableau
    let header_texts = ["Rot.", "Pal.", "Appel", "NOM Pr\\351nom", "Gaz", "PE-PA-PN", "Formation", "Fonction", "Param\\350tres"];
    writeln!(content, "BT /F2 9 Tf").unwrap();
    for (i, &col_width) in cols.iter().enumerate() {
        let text_x = col_x + 3.0;
        let text_y = y - header_height + 7.0;
        writeln!(content, "{} {} Td ({}) Tj", text_x, text_y, header_texts[i]).unwrap();
        col_x += col_width;
    }
    writeln!(content, "ET").unwrap();
    
    // Lignes de séparation des colonnes (verticales)
    writeln!(content, "0 G 0.5 w").unwrap();
    col_x = table_x;
    for &col_width in &cols {
        writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, table_y).unwrap();
        col_x += col_width;
    }
    writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, table_y).unwrap();
    
    // Ligne horizontale sous l'en-tête
    let header_y = y - header_height;
    writeln!(content, "{} {} m {} {} l S", table_x, header_y, table_x + table_width, header_y).unwrap();
    
    // Contenu des palanquées
    let mut current_y = header_y;
    
    for palanquee in &data.palanquees {
        let pal_rows = palanquee.members.len().max(1);
        let pal_height = (pal_rows as f32 + 1.0) * row_height; // +1 pour params
        
        // Fond alterné léger pour les palanquées
        if palanquee.numero % 2 == 0 {
            writeln!(content, "0.97 g {} {} {} {} re f", table_x, current_y - pal_height, table_width, pal_height).unwrap();
        }
        
        // Numéro de rotation et palanquée (fusionnés sur la hauteur)
        col_x = table_x;
        let center_y = current_y - pal_height / 2.0 - 4.0;
        
        writeln!(content, "BT /F2 10 Tf {} {} Td ({}) Tj ET", col_x + 15.0, center_y, palanquee.rotation).unwrap();
        col_x += cols[0];
        
        writeln!(content, "BT /F2 10 Tf {} {} Td ({}) Tj ET", col_x + 15.0, center_y, palanquee.numero).unwrap();
        col_x += cols[1];
        
        // Appel (call sign)
        if let Some(ref cs) = palanquee.call_sign {
            writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 3.0, center_y, escape_pdf(cs)).unwrap();
        }
        col_x += cols[2];
        
        // Membres
        let mut member_y = current_y - row_height + 5.0;
        for member in &palanquee.members {
            let name_x = col_x;
            writeln!(content, "BT /F1 8 Tf {} {} Td ({}) Tj ET", name_x + 3.0, member_y, escape_pdf(&member.name)).unwrap();
            
            let gas_x = name_x + cols[3];
            writeln!(content, "BT /F1 8 Tf {} {} Td ({}) Tj ET", gas_x + 3.0, member_y, escape_pdf(&member.gas)).unwrap();
            
            let apt_x = gas_x + cols[4];
            writeln!(content, "BT /F1 8 Tf {} {} Td ({}) Tj ET", apt_x + 3.0, member_y, escape_pdf(&member.aptitude)).unwrap();
            
            let form_x = apt_x + cols[5];
            if let Some(ref prep) = member.preparing {
                writeln!(content, "BT /F1 8 Tf {} {} Td ({}) Tj ET", form_x + 3.0, member_y, escape_pdf(prep)).unwrap();
            }
            
            let func_x = form_x + cols[6];
            writeln!(content, "BT /F2 9 Tf {} {} Td ({}) Tj ET", func_x + 20.0, member_y, &member.role).unwrap();
            
            member_y -= row_height;
        }
        
        // Paramètres (dernière colonne, dernière ligne de la palanquée)
        let params_x = table_x + cols[0..8].iter().sum::<f32>();
        let params_y = current_y - pal_height + 5.0;
        
        // Ligne des paramètres prévus
        let planned = format!(
            "Pr\\351vu: {} / {}min / {}m",
            palanquee.planned_departure_time.as_deref().unwrap_or("-"),
            palanquee.planned_time.map_or("-".to_string(), |t| t.to_string()),
            palanquee.planned_depth.map_or("-".to_string(), |d| d.to_string())
        );
        writeln!(content, "BT /F1 7 Tf {} {} Td ({}) Tj ET", params_x + 3.0, params_y + row_height, escape_pdf(&planned)).unwrap();
        
        // Ligne des paramètres réalisés
        let actual = format!(
            "R\\351alis\\351: {}-{} / {}min / {}m",
            palanquee.actual_departure_time.as_deref().unwrap_or("-"),
            palanquee.actual_return_time.as_deref().unwrap_or("-"),
            palanquee.actual_time.map_or("-".to_string(), |t| t.to_string()),
            palanquee.actual_depth.map_or("-".to_string(), |d| d.to_string())
        );
        writeln!(content, "BT /F1 7 Tf {} {} Td ({}) Tj ET", params_x + 3.0, params_y, escape_pdf(&actual)).unwrap();
        
        // Ligne horizontale de séparation
        current_y -= pal_height;
        writeln!(content, "{} {} m {} {} l S", table_x, current_y, table_x + table_width, current_y).unwrap();
    }
    
    // Cadre extérieur
    writeln!(content, "1 w {} {} {} {} re S", table_x, table_y, table_width, y - table_y).unwrap();
    
    // Légende en bas
    let legend_y = table_y - 15.0;
    writeln!(content, "BT /F1 8 Tf {} {} Td (E = Encadrant, P = Plongeur, GP = Guide de Palanqu\\351e) Tj ET", margin, legend_y).unwrap();
    
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

