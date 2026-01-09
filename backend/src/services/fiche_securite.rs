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
    let session = sessions::Entity::find_by_id(session_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

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

    // Récupérer le DP automatiquement depuis les questionnaires
    let dp_questionnaire = questionnaires::Entity::find()
        .filter(questionnaires::Column::SessionId.eq(session_id))
        .filter(questionnaires::Column::IsDirecteurPlongee.eq(true))
        .one(db)
        .await?;
    
    let dp_name = if let Some(q) = dp_questionnaire {
        // Récupérer le nom de la personne associée
        let person = people::Entity::find_by_id(q.person_id)
            .one(db)
            .await?;
        person.map(|p| format!("{} {}", p.first_name, p.last_name))
            .unwrap_or_default()
    } else {
        String::new()
    };

    let data = FicheSecuriteData {
        date: options.date.unwrap_or_else(|| session.start_date.format("%d/%m/%Y").to_string()),
        club: options.club.unwrap_or_default(),
        directeur_plongee: dp_name,
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
    pub site: Option<String>,
    pub position: Option<String>,
    pub securite_surface: Option<String>,
    pub observations: Option<String>,
}

// Constantes de mise en page
const PAGE_WIDTH: f32 = 842.0;
const PAGE_HEIGHT: f32 = 595.0;
const MARGIN: f32 = 25.0;
const ROW_HEIGHT: f32 = 16.0;
const HEADER_HEIGHT: f32 = 18.0;
const ROTATION_HEADER_HEIGHT: f32 = 22.0;
const MIN_Y: f32 = 40.0; // Marge basse minimum

/// Génère le PDF de la fiche de sécurité avec support multi-pages
fn generate_pdf(data: &FicheSecuriteData) -> Result<Vec<u8>, AppError> {
    let mut doc = Document::with_version("1.5");
    
    let font_helvetica = create_font(&mut doc, "Helvetica");
    let font_helvetica_bold = create_font(&mut doc, "Helvetica-Bold");
    
    let mut font_dict = Dictionary::new();
    font_dict.set("F1", Object::Reference(font_helvetica));
    font_dict.set("F2", Object::Reference(font_helvetica_bold));
    
    let mut resources = Dictionary::new();
    resources.set("Font", Object::Dictionary(font_dict));
    let resources_id = doc.add_object(resources);
    
    // Générer toutes les pages
    let page_contents = generate_all_pages(data);
    
    let mut page_ids = vec![];
    for content in page_contents {
        let content_stream = Stream::new(Dictionary::new(), content.into_bytes());
        let content_id = doc.add_object(content_stream);
        
        let mut page_dict = Dictionary::new();
        page_dict.set("Type", Object::Name(b"Page".to_vec()));
        page_dict.set("MediaBox", Object::Array(vec![
            Object::Integer(0),
            Object::Integer(0),
            Object::Real(PAGE_WIDTH),
            Object::Real(PAGE_HEIGHT),
        ]));
        page_dict.set("Resources", Object::Reference(resources_id));
        page_dict.set("Contents", Object::Reference(content_id));
        
        let page_id = doc.add_object(page_dict);
        page_ids.push(page_id);
    }
    
    // Pages node
    let kids: Vec<Object> = page_ids.iter().map(|&id| Object::Reference(id)).collect();
    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Kids", Object::Array(kids));
    pages_dict.set("Count", Object::Integer(page_ids.len() as i64));
    let pages_id = doc.add_object(pages_dict);
    
    // Mettre à jour le parent de chaque page
    for page_id in &page_ids {
        if let Ok(Object::Dictionary(ref mut page)) = doc.get_object_mut(*page_id) {
            page.set("Parent", Object::Reference(pages_id));
        }
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

/// Calcule la hauteur nécessaire pour une rotation
fn calculate_rotation_height(rotation: &RotationData) -> f32 {
    let mut height = ROTATION_HEADER_HEIGHT + HEADER_HEIGHT; // Header rotation + header tableau
    for palanquee in &rotation.palanquees {
        height += (palanquee.members.len().max(1) as f32) * ROW_HEIGHT;
    }
    height + 15.0 // Espacement après
}

/// Génère toutes les pages du PDF
fn generate_all_pages(data: &FicheSecuriteData) -> Vec<String> {
    let mut pages = vec![];
    let mut current_page = String::new();
    let mut y = PAGE_HEIGHT - MARGIN;
    let mut is_first_page = true;
    let mut page_num = 1;
    
    // En-tête sur la première page
    y = draw_header(&mut current_page, data, y);
    
    for rotation in &data.rotations {
        let rotation_height = calculate_rotation_height(rotation);
        
        // Vérifier si la rotation rentre sur la page actuelle
        if y - rotation_height < MIN_Y && !is_first_page {
            // Nouvelle page nécessaire
            draw_page_footer(&mut current_page, page_num);
            pages.push(current_page);
            current_page = String::new();
            y = PAGE_HEIGHT - MARGIN;
            page_num += 1;
            
            // En-tête simplifié sur les pages suivantes
            y = draw_continuation_header(&mut current_page, data, y, page_num);
        }
        
        // Dessiner la rotation
        y = draw_rotation(&mut current_page, rotation, y);
        is_first_page = false;
    }
    
    // Légende et footer sur la dernière page
    draw_legend(&mut current_page, y - 10.0);
    draw_page_footer(&mut current_page, page_num);
    pages.push(current_page);
    
    pages
}

/// Dessine l'en-tête complet (première page)
fn draw_header(content: &mut String, data: &FicheSecuriteData, mut y: f32) -> f32 {
    let width = PAGE_WIDTH - 2.0 * MARGIN;
    
    // Titre avec fond bleu
    let title_height = 28.0;
    writeln!(content, "0.2 0.4 0.7 rg {} {} {} {} re f", MARGIN, y - title_height, width, title_height).unwrap();
    writeln!(content, "1 1 1 rg").unwrap(); // Texte blanc
    writeln!(content, "BT /F2 16 Tf {} {} Td (FICHE DE SECURITE) Tj ET", PAGE_WIDTH / 2.0 - 75.0, y - 19.0).unwrap();
    writeln!(content, "0 g").unwrap();
    y -= title_height + 8.0;
    
    // Cadre infos - fond très clair
    let info_height = 55.0;
    writeln!(content, "0.95 0.95 0.97 rg {} {} {} {} re f", MARGIN, y - info_height, width, info_height).unwrap();
    writeln!(content, "0.7 0.7 0.7 RG 0.5 w {} {} {} {} re S", MARGIN, y - info_height, width, info_height).unwrap();
    
    // Remettre le texte en noir pour les labels
    writeln!(content, "0 0 0 rg").unwrap();
    
    // Infos - texte noir sur fond clair
    let col1 = MARGIN + 10.0;
    let col2 = MARGIN + 220.0;
    let col3 = MARGIN + 480.0;
    let col4 = MARGIN + 680.0;
    
    // Ligne 1
    writeln!(content, "0 0 0 rg").unwrap(); // Noir
    writeln!(content, "BT /F2 10 Tf {} {} Td (Date:) Tj ET", col1, y - 14.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col1 + 35.0, y - 14.0, escape_pdf(&data.date)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (Club:) Tj ET", col2, y - 14.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col2 + 35.0, y - 14.0, escape_pdf(&data.club)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (Effectif:) Tj ET", col4, y - 14.0).unwrap();
    writeln!(content, "0.2 0.5 0.2 rg").unwrap(); // Vert
    writeln!(content, "BT /F2 14 Tf {} {} Td ({}) Tj ET", col4 + 55.0, y - 14.0, data.effectif_unique).unwrap();
    writeln!(content, "0 0 0 rg").unwrap(); // Remettre en noir
    
    // Ligne 2
    writeln!(content, "BT /F2 10 Tf {} {} Td (Site:) Tj ET", col1, y - 30.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col1 + 35.0, y - 30.0, escape_pdf(&data.site)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (DP:) Tj ET", col2, y - 30.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col2 + 25.0, y - 30.0, escape_pdf(&data.directeur_plongee)).unwrap();
    
    writeln!(content, "BT /F2 10 Tf {} {} Td (Position:) Tj ET", col3, y - 30.0).unwrap();
    writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col3 + 55.0, y - 30.0, escape_pdf(&data.position)).unwrap();
    
    // Ligne 3
    writeln!(content, "BT /F2 10 Tf {} {} Td (S\\351curit\\351 surface:) Tj ET", col1, y - 46.0).unwrap();
    writeln!(content, "BT /F1 10 Tf {} {} Td ({}) Tj ET", col1 + 100.0, y - 46.0, escape_pdf(&data.securite_surface)).unwrap();
    
    if !data.observations.is_empty() {
        writeln!(content, "BT /F2 9 Tf {} {} Td (Obs:) Tj ET", col3, y - 46.0).unwrap();
        writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col3 + 30.0, y - 46.0, escape_pdf(&data.observations)).unwrap();
    }
    
    y - info_height - 12.0
}

/// En-tête simplifié pour les pages de continuation
fn draw_continuation_header(content: &mut String, data: &FicheSecuriteData, y: f32, page: i32) -> f32 {
    let width = PAGE_WIDTH - 2.0 * MARGIN;
    
    // Bandeau simple
    let header_height = 22.0;
    writeln!(content, "0.2 0.4 0.7 rg {} {} {} {} re f", MARGIN, y - header_height, width, header_height).unwrap();
    writeln!(content, "1 1 1 rg").unwrap();
    writeln!(content, "BT /F2 12 Tf {} {} Td (FICHE DE SECURITE - {} - Page {}) Tj ET", 
        MARGIN + 10.0, y - 15.0, escape_pdf(&data.date), page).unwrap();
    writeln!(content, "0 g").unwrap();
    
    y - header_height - 10.0
}

/// Dessine une rotation complète
fn draw_rotation(content: &mut String, rotation: &RotationData, mut y: f32) -> f32 {
    let width = PAGE_WIDTH - 2.0 * MARGIN;
    
    // Bandeau de rotation - fond vert foncé avec texte blanc
    writeln!(content, "0.15 0.45 0.25 rg {} {} {} {} re f", MARGIN, y - ROTATION_HEADER_HEIGHT, width, ROTATION_HEADER_HEIGHT).unwrap();
    writeln!(content, "1 1 1 rg").unwrap(); // Texte blanc
    writeln!(content, "BT /F2 12 Tf {} {} Td (ROTATION {}) Tj ET", MARGIN + 15.0, y - 15.0, rotation.numero).unwrap();
    writeln!(content, "0 g").unwrap();
    y -= ROTATION_HEADER_HEIGHT;
    
    // En-tête du tableau - fond bleu très clair
    let cols = [160.0, 55.0, 75.0, 70.0, 55.0, 185.0, 182.0];
    let col_headers = ["NOM Prenom", "Gaz", "Aptitude", "Prepa", "Fonction", "Params Prevus", "Params Realises"];
    
    writeln!(content, "0.85 0.9 0.95 rg {} {} {} {} re f", MARGIN, y - HEADER_HEIGHT, width, HEADER_HEIGHT).unwrap();
    
    // Dessiner chaque en-tête de colonne séparément
    let mut col_x = MARGIN;
    writeln!(content, "0.1 0.1 0.3 rg").unwrap(); // Texte bleu foncé
    for (i, &col_w) in cols.iter().enumerate() {
        writeln!(content, "BT /F2 8 Tf {} {} Td ({}) Tj ET", col_x + 3.0, y - 12.0, col_headers[i]).unwrap();
        col_x += col_w;
    }
    writeln!(content, "0 g").unwrap();
    
    // Lignes verticales de l'en-tête
    writeln!(content, "0.6 0.6 0.7 RG 0.3 w").unwrap();
    col_x = MARGIN;
    for &col_w in &cols {
        writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, y - HEADER_HEIGHT).unwrap();
        col_x += col_w;
    }
    writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, y - HEADER_HEIGHT).unwrap();
    writeln!(content, "{} {} m {} {} l S", MARGIN, y - HEADER_HEIGHT, MARGIN + width, y - HEADER_HEIGHT).unwrap();
    
    y -= HEADER_HEIGHT;
    
    // Palanquées
    for (pal_idx, palanquee) in rotation.palanquees.iter().enumerate() {
        let num_rows = palanquee.members.len().max(1);
        let pal_height = (num_rows as f32) * ROW_HEIGHT;
        
        // Fond alterné très subtil
        if pal_idx % 2 == 1 {
            writeln!(content, "0.97 0.97 0.98 rg {} {} {} {} re f", MARGIN, y - pal_height, width, pal_height).unwrap();
        }
        
        // Badge palanquée sur le côté - fond violet
        writeln!(content, "0.4 0.3 0.6 rg {} {} {} {} re f", MARGIN - 22.0, y - pal_height, 20.0, pal_height).unwrap();
        writeln!(content, "1 1 1 rg").unwrap(); // Texte blanc
        writeln!(content, "BT /F2 9 Tf {} {} Td (P{}) Tj ET", MARGIN - 19.0, y - pal_height / 2.0 - 3.0, palanquee.numero).unwrap();
        writeln!(content, "0 g").unwrap();
        
        // Membres
        let mut member_y = y - ROW_HEIGHT + 4.0;
        for member in &palanquee.members {
            col_x = MARGIN;
            
            // Nom
            writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(&member.name)).unwrap();
            col_x += cols[0];
            
            // Gaz avec couleur
            if member.gas == "Nitrox" {
                writeln!(content, "0.7 0.5 0 rg").unwrap(); // Orange
            } else {
                writeln!(content, "0.2 0.4 0.6 rg").unwrap(); // Bleu
            }
            writeln!(content, "BT /F2 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(&member.gas)).unwrap();
            writeln!(content, "0 g").unwrap();
            col_x += cols[1];
            
            // Aptitude
            writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(&member.aptitude)).unwrap();
            col_x += cols[2];
            
            // Prépa
            if let Some(ref prep) = member.preparing {
                writeln!(content, "0.6 0.3 0 rg").unwrap(); // Orange foncé
                writeln!(content, "BT /F2 9 Tf {} {} Td ({}) Tj ET", col_x + 5.0, member_y, escape_pdf(prep)).unwrap();
                writeln!(content, "0 g").unwrap();
            }
            col_x += cols[3];
            
            // Fonction avec style
            match member.role.as_str() {
                "E" | "GP" => {
                    writeln!(content, "0.5 0.2 0.5 rg").unwrap(); // Violet
                    writeln!(content, "BT /F2 10 Tf {} {} Td ({}) Tj ET", col_x + 15.0, member_y, escape_pdf(&member.role)).unwrap();
                }
                _ => {
                    writeln!(content, "0.3 0.3 0.3 rg").unwrap(); // Gris
                    writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 18.0, member_y, escape_pdf(&member.role)).unwrap();
                }
            }
            writeln!(content, "0 g").unwrap();
            
            member_y -= ROW_HEIGHT;
        }
        
        // Paramètres (centrés verticalement)
        let params_y = y - pal_height / 2.0 - 3.0;
        col_x = MARGIN + cols[0..5].iter().sum::<f32>();
        
        // Prévus
        let planned = format!(
            "{} - {}' - {}m",
            palanquee.planned_departure_time.as_deref().unwrap_or("__:__"),
            palanquee.planned_time.map_or("__".to_string(), |t| t.to_string()),
            palanquee.planned_depth.map_or("__".to_string(), |d| d.to_string())
        );
        writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 10.0, params_y, escape_pdf(&planned)).unwrap();
        col_x += cols[5];
        
        // Réalisés
        let actual = format!(
            "{} - {} / {}' / {}m",
            palanquee.actual_departure_time.as_deref().unwrap_or("__:__"),
            palanquee.actual_return_time.as_deref().unwrap_or("__:__"),
            palanquee.actual_time.map_or("__".to_string(), |t| t.to_string()),
            palanquee.actual_depth.map_or("__".to_string(), |d| d.to_string())
        );
        writeln!(content, "BT /F1 9 Tf {} {} Td ({}) Tj ET", col_x + 10.0, params_y, escape_pdf(&actual)).unwrap();
        
        // Lignes verticales
        writeln!(content, "0.8 0.8 0.85 RG 0.3 w").unwrap();
        col_x = MARGIN;
        for &col_w in &cols {
            col_x += col_w;
            writeln!(content, "{} {} m {} {} l S", col_x, y, col_x, y - pal_height).unwrap();
        }
        
        // Ligne de séparation
        y -= pal_height;
        writeln!(content, "0.7 0.7 0.75 RG {} {} m {} {} l S", MARGIN, y, MARGIN + width, y).unwrap();
    }
    
    // Cadre extérieur de la rotation
    let total_height = ROTATION_HEADER_HEIGHT + HEADER_HEIGHT + 
        rotation.palanquees.iter().map(|p| (p.members.len().max(1) as f32) * ROW_HEIGHT).sum::<f32>();
    writeln!(content, "0.3 0.3 0.4 RG 1 w {} {} {} {} re S", 
        MARGIN, y, width, total_height).unwrap();
    
    y - 12.0 // Espacement après la rotation
}

/// Dessine la légende
fn draw_legend(content: &mut String, y: f32) {
    writeln!(content, "0.4 0.4 0.4 rg").unwrap();
    writeln!(content, "BT /F1 8 Tf {} {} Td (L\\351gende: E = Encadrant    GP = Guide de Palanqu\\351e    P = Plongeur) Tj ET", MARGIN, y).unwrap();
    writeln!(content, "0 g").unwrap();
}

/// Dessine le pied de page
fn draw_page_footer(content: &mut String, page: i32) {
    writeln!(content, "0.5 0.5 0.5 rg").unwrap();
    writeln!(content, "BT /F1 8 Tf {} {} Td (Page {}) Tj ET", PAGE_WIDTH - 60.0, 20.0, page).unwrap();
    writeln!(content, "0 g").unwrap();
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
            '\'' => result.push_str("'"),
            _ if c.is_ascii() => result.push(c),
            _ => result.push('?'),
        }
    }
    result
}
