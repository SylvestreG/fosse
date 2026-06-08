use lopdf::{Document, Object, Dictionary, Stream};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};
use uuid::Uuid;
use std::fmt::Write;
use std::collections::HashSet;

use crate::entities::{sessions, rotations, palanquees, palanquee_members, questionnaires, people, dive_directors};
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
    /// Bandeau PDF, ex. « Plongée 1 — Rota 1 » ou « Rotation 3 »
    pub heading: String,
    pub palanquees: Vec<PalanqueeData>,
}

#[derive(Debug)]
pub struct PalanqueeData {
    pub numero: i32,
    pub planned_time: Option<i32>,
    pub planned_depth: Option<i32>,
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

    let rotations_list = crate::rotation_order::sort_rotations(
        rotations::Entity::find()
            .filter(rotations::Column::SessionId.eq(session_id))
            .all(db)
            .await?,
    );

    let mut rotations_data = vec![];
    let mut unique_questionnaire_ids: HashSet<Uuid> = HashSet::new();

    let mut last_plongee: Option<Option<i32>> = None;
    let mut rota_in_plongee: i32 = 0;

    for rotation in rotations_list {
        if let Some(only) = options.plongee_number {
            match rotation.plongee_number {
                Some(p) if p == only => {}
                _ => continue,
            }
        }

        let group_changed = last_plongee.map(|p| p != rotation.plongee_number).unwrap_or(true);
        if group_changed {
            rota_in_plongee = 0;
            last_plongee = Some(rotation.plongee_number);
        }
        rota_in_plongee += 1;

        let heading = match rotation.plongee_number {
            Some(p) if (1..=2).contains(&p) => format!("Plongée {p} - Rota {rota_in_plongee}"),
            _ => format!("Rotation {}", rotation.number),
        };
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
                planned_time: palanquee.planned_time,
                planned_depth: palanquee.planned_depth,
                actual_time: palanquee.actual_time,
                actual_depth: palanquee.actual_depth,
                members: members_data,
            });
        }

        rotations_data.push(RotationData {
            heading,
            palanquees: palanquees_data,
        });
    }

    let dp_name = resolve_directeurs_plongee(db, session_id).await?;

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
    /// Si `Some(1)` ou `Some(2)`, n’inclut que les rotations de cette plongée (sites partenaires).
    pub plongee_number: Option<i32>,
}

async fn person_display_name(
    db: &DatabaseConnection,
    person_id: Uuid,
) -> Result<String, AppError> {
    let person = people::Entity::find_by_id(person_id)
        .one(db)
        .await?;
    Ok(person
        .map(|p| format!("{} {}", p.first_name, p.last_name))
        .unwrap_or_default())
}

/// Fosse : `is_directeur_plongee` sur questionnaire session. Sortie : `dive_directors` de la plongée.
async fn resolve_directeurs_plongee(
    db: &DatabaseConnection,
    session_id: Uuid,
) -> Result<String, AppError> {
    let dp_questionnaire = questionnaires::Entity::find()
        .filter(questionnaires::Column::SessionId.eq(session_id))
        .filter(questionnaires::Column::IsDirecteurPlongee.eq(true))
        .one(db)
        .await?;

    if let Some(q) = dp_questionnaire {
        return person_display_name(db, q.person_id).await;
    }

    let directors = dive_directors::Entity::find()
        .filter(dive_directors::Column::SessionId.eq(session_id))
        .all(db)
        .await?;

    let mut names = Vec::new();
    for d in directors {
        let questionnaire = questionnaires::Entity::find_by_id(d.questionnaire_id)
            .one(db)
            .await?;
        if let Some(q) = questionnaire {
            let name = person_display_name(db, q.person_id).await?;
            if !name.is_empty() {
                names.push(name);
            }
        }
    }

    Ok(names.join(", "))
}

// Constantes de mise en page
const PAGE_WIDTH: f32 = 842.0;
const PAGE_HEIGHT: f32 = 595.0;
const MARGIN: f32 = 25.0;
const ROW_HEIGHT: f32 = 16.0;
const HEADER_HEIGHT: f32 = 18.0;
const ROTATION_HEADER_HEIGHT: f32 = 22.0;
/// Marge basse : pied de page + marge pour ne pas chevaucher la légende éventuelle.
const MIN_Y: f32 = 52.0;
const LEGEND_SPACE: f32 = 22.0;

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

fn palanquee_block_height(p: &PalanqueeData) -> f32 {
    (p.members.len().max(1) as f32) * ROW_HEIGHT
}

fn rotation_table_overhead() -> f32 {
    ROTATION_HEADER_HEIGHT + HEADER_HEIGHT
}

/// Colonnes du tableau (largeurs, somme ≈ largeur utile).
const TABLE_COLS: [f32; 7] = [160.0, 55.0, 75.0, 70.0, 55.0, 185.0, 182.0];

/// Génère toutes les pages du PDF (sauts avant la 1re rotation si besoin, et coupure intra-rotation).
fn generate_all_pages(data: &FicheSecuriteData) -> Vec<String> {
    let mut pages = vec![];
    let mut current_page = String::new();
    let mut y = PAGE_HEIGHT - MARGIN;
    let mut page_num = 1;

    y = draw_header(&mut current_page, data, y);

    let n_rot = data.rotations.len();
    for (rot_i, rotation) in data.rotations.iter().enumerate() {
        if rotation.palanquees.is_empty() {
            y = start_new_page_if_needed(
                &mut pages,
                &mut current_page,
                &mut page_num,
                data,
                y,
                rotation_table_overhead() + ROW_HEIGHT,
                rot_i == n_rot - 1,
            );
            let y_top = y;
            y = draw_rotation_banner(&mut current_page, &rotation.heading, y);
            y = draw_table_column_headers(&mut current_page, y);
            y = draw_palanquee_block(&mut current_page, 0, &PalanqueeData {
                numero: 0,
                planned_time: None,
                planned_depth: None,
                actual_time: None,
                actual_depth: None,
                members: vec![],
            }, y);
            draw_chunk_outer_border(&mut current_page, y_top, y, PAGE_WIDTH - 2.0 * MARGIN);
            y -= 12.0;
            continue;
        }

        let mut pal_idx = 0usize;
        let mut global_pal_visual = 0usize;

        while pal_idx < rotation.palanquees.len() {
            let first_chunk = pal_idx == 0;
            let overhead = rotation_table_overhead();

            y = start_new_page_if_needed(
                &mut pages,
                &mut current_page,
                &mut page_num,
                data,
                y,
                overhead + palanquee_block_height(&rotation.palanquees[pal_idx]),
                rot_i == n_rot - 1 && pal_idx == rotation.palanquees.len() - 1,
            );

            let heading = if first_chunk {
                rotation.heading.clone()
            } else {
                format!("{} (suite)", rotation.heading)
            };

            let y_top = y;
            y = draw_rotation_banner(&mut current_page, &heading, y);
            y = draw_table_column_headers(&mut current_page, y);

            let chunk_start_idx = pal_idx;
            while pal_idx < rotation.palanquees.len() {
                let pal = &rotation.palanquees[pal_idx];
                let ph = palanquee_block_height(pal);
                let last_pal_of_doc = rot_i == n_rot - 1 && pal_idx == rotation.palanquees.len() - 1;
                let reserve = if last_pal_of_doc {
                    MIN_Y + LEGEND_SPACE
                } else {
                    MIN_Y
                };
                // Laisser au moins une palanquée sur ce chunk si aucune n’a encore été posée.
                if pal_idx > chunk_start_idx && y - ph < reserve {
                    break;
                }
                y = draw_palanquee_block(&mut current_page, global_pal_visual, pal, y);
                global_pal_visual += 1;
                pal_idx += 1;
            }

            draw_chunk_outer_border(&mut current_page, y_top, y, PAGE_WIDTH - 2.0 * MARGIN);
            y -= 12.0;
        }
    }

    let legend_y = (y - 10.0).max(MIN_Y + LEGEND_SPACE);
    draw_legend(&mut current_page, legend_y);
    draw_page_footer(&mut current_page, page_num);
    pages.push(current_page);

    pages
}

/// Nouvelle page si le bloc (overhead + première hauteur pal) ne tient pas.
fn start_new_page_if_needed(
    pages: &mut Vec<String>,
    current_page: &mut String,
    page_num: &mut i32,
    data: &FicheSecuriteData,
    y: f32,
    min_required_below_y: f32,
    last_block_of_document: bool,
) -> f32 {
    let reserve = if last_block_of_document {
        MIN_Y + LEGEND_SPACE
    } else {
        MIN_Y
    };
    if y - min_required_below_y >= reserve {
        return y;
    }
    draw_page_footer(current_page, *page_num);
    pages.push(std::mem::take(current_page));
    *page_num += 1;
    let fresh_y = PAGE_HEIGHT - MARGIN;
    draw_continuation_header(current_page, data, fresh_y, *page_num)
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

fn draw_rotation_banner(content: &mut String, heading: &str, y: f32) -> f32 {
    let width = PAGE_WIDTH - 2.0 * MARGIN;
    writeln!(
        content,
        "0.15 0.45 0.25 rg {} {} {} {} re f",
        MARGIN,
        y - ROTATION_HEADER_HEIGHT,
        width,
        ROTATION_HEADER_HEIGHT
    )
    .unwrap();
    writeln!(content, "1 1 1 rg").unwrap();
    writeln!(
        content,
        "BT /F2 12 Tf {} {} Td ({}) Tj ET",
        MARGIN + 15.0,
        y - 15.0,
        escape_pdf(heading)
    )
    .unwrap();
    writeln!(content, "0 g").unwrap();
    y - ROTATION_HEADER_HEIGHT
}

fn draw_table_column_headers(content: &mut String, y: f32) -> f32 {
    let width = PAGE_WIDTH - 2.0 * MARGIN;
    let col_headers = [
        "NOM Prenom",
        "Gaz",
        "Aptitude",
        "Prepa",
        "Fonction",
        "Params Prevus",
        "Params Realises",
    ];
    writeln!(
        content,
        "0.85 0.9 0.95 rg {} {} {} {} re f",
        MARGIN,
        y - HEADER_HEIGHT,
        width,
        HEADER_HEIGHT
    )
    .unwrap();
    let mut col_x = MARGIN;
    writeln!(content, "0.1 0.1 0.3 rg").unwrap();
    for (i, &col_w) in TABLE_COLS.iter().enumerate() {
        writeln!(
            content,
            "BT /F2 8 Tf {} {} Td ({}) Tj ET",
            col_x + 3.0,
            y - 12.0,
            col_headers[i]
        )
        .unwrap();
        col_x += col_w;
    }
    writeln!(content, "0 g").unwrap();
    writeln!(content, "0.6 0.6 0.7 RG 0.3 w").unwrap();
    col_x = MARGIN;
    for &col_w in &TABLE_COLS {
        writeln!(
            content,
            "{} {} m {} {} l S",
            col_x,
            y,
            col_x,
            y - HEADER_HEIGHT
        )
        .unwrap();
        col_x += col_w;
    }
    writeln!(
        content,
        "{} {} m {} {} l S",
        col_x,
        y,
        col_x,
        y - HEADER_HEIGHT
    )
    .unwrap();
    writeln!(
        content,
        "{} {} m {} {} l S",
        MARGIN,
        y - HEADER_HEIGHT,
        MARGIN + width,
        y - HEADER_HEIGHT
    )
    .unwrap();
    y - HEADER_HEIGHT
}

/// Dessine un bloc palanquée (lignes membres + colonnes params). `y` = haut du bloc.
fn draw_palanquee_block(
    content: &mut String,
    pal_visual_idx: usize,
    palanquee: &PalanqueeData,
    y: f32,
) -> f32 {
    let width = PAGE_WIDTH - 2.0 * MARGIN;
    let num_rows = palanquee.members.len().max(1);
    let pal_height = (num_rows as f32) * ROW_HEIGHT;

    if pal_visual_idx % 2 == 1 {
        writeln!(
            content,
            "0.97 0.97 0.98 rg {} {} {} {} re f",
            MARGIN,
            y - pal_height,
            width,
            pal_height
        )
        .unwrap();
    }

    writeln!(
        content,
        "0.4 0.3 0.6 rg {} {} {} {} re f",
        MARGIN - 22.0,
        y - pal_height,
        20.0,
        pal_height
    )
    .unwrap();
    writeln!(content, "1 1 1 rg").unwrap();
    let p_label = if palanquee.numero > 0 {
        format!("{}", palanquee.numero)
    } else {
        "-".to_string()
    };
    writeln!(
        content,
        "BT /F2 9 Tf {} {} Td (P{}) Tj ET",
        MARGIN - 19.0,
        y - pal_height / 2.0 - 3.0,
        escape_pdf(&p_label)
    )
    .unwrap();
    writeln!(content, "0 g").unwrap();

    let mut member_y = y - ROW_HEIGHT + 4.0;
    for member in &palanquee.members {
        let mut col_x = MARGIN;
        writeln!(
            content,
            "BT /F1 9 Tf {} {} Td ({}) Tj ET",
            col_x + 5.0,
            member_y,
            escape_pdf(&member.name)
        )
        .unwrap();
        col_x += TABLE_COLS[0];
        if member.gas == "Nitrox" {
            writeln!(content, "0.7 0.5 0 rg").unwrap();
        } else {
            writeln!(content, "0.2 0.4 0.6 rg").unwrap();
        }
        writeln!(
            content,
            "BT /F2 9 Tf {} {} Td ({}) Tj ET",
            col_x + 5.0,
            member_y,
            escape_pdf(&member.gas)
        )
        .unwrap();
        writeln!(content, "0 g").unwrap();
        col_x += TABLE_COLS[1];
        writeln!(
            content,
            "BT /F1 9 Tf {} {} Td ({}) Tj ET",
            col_x + 5.0,
            member_y,
            escape_pdf(&member.aptitude)
        )
        .unwrap();
        col_x += TABLE_COLS[2];
        if let Some(ref prep) = member.preparing {
            writeln!(content, "0.6 0.3 0 rg").unwrap();
            writeln!(
                content,
                "BT /F2 9 Tf {} {} Td ({}) Tj ET",
                col_x + 5.0,
                member_y,
                escape_pdf(prep)
            )
            .unwrap();
            writeln!(content, "0 g").unwrap();
        }
        col_x += TABLE_COLS[3];
        match member.role.as_str() {
            "E" | "GP" => {
                writeln!(content, "0.5 0.2 0.5 rg").unwrap();
                writeln!(
                    content,
                    "BT /F2 10 Tf {} {} Td ({}) Tj ET",
                    col_x + 15.0,
                    member_y,
                    escape_pdf(&member.role)
                )
                .unwrap();
            }
            _ => {
                writeln!(content, "0.3 0.3 0.3 rg").unwrap();
                writeln!(
                    content,
                    "BT /F1 9 Tf {} {} Td ({}) Tj ET",
                    col_x + 18.0,
                    member_y,
                    escape_pdf(&member.role)
                )
                .unwrap();
            }
        }
        writeln!(content, "0 g").unwrap();
        member_y -= ROW_HEIGHT;
    }

    let params_y = y - pal_height / 2.0 - 3.0;
    let mut col_x = MARGIN + TABLE_COLS[0..5].iter().sum::<f32>();
    let planned = format!(
        "{}' / {}m",
        palanquee
            .planned_time
            .map_or("__".to_string(), |t| t.to_string()),
        palanquee
            .planned_depth
            .map_or("__".to_string(), |d| d.to_string())
    );
    writeln!(
        content,
        "BT /F1 9 Tf {} {} Td ({}) Tj ET",
        col_x + 10.0,
        params_y,
        escape_pdf(&planned)
    )
    .unwrap();
    col_x += TABLE_COLS[5];
    let actual = format!(
        "{}' / {}m",
        palanquee
            .actual_time
            .map_or("______".to_string(), |t| t.to_string()),
        palanquee
            .actual_depth
            .map_or("______".to_string(), |d| d.to_string()),
    );
    writeln!(
        content,
        "BT /F1 9 Tf {} {} Td ({}) Tj ET",
        col_x + 10.0,
        params_y,
        escape_pdf(&actual)
    )
    .unwrap();

    writeln!(content, "0.8 0.8 0.85 RG 0.3 w").unwrap();
    col_x = MARGIN;
    for &col_w in &TABLE_COLS {
        writeln!(
            content,
            "{} {} m {} {} l S",
            col_x,
            y,
            col_x,
            y - pal_height
        )
        .unwrap();
        col_x += col_w;
    }
    writeln!(
        content,
        "{} {} m {} {} l S",
        col_x,
        y,
        col_x,
        y - pal_height
    )
    .unwrap();

    let y_after = y - pal_height;
    writeln!(
        content,
        "0.7 0.7 0.75 RG {} {} m {} {} l S",
        MARGIN,
        y_after,
        MARGIN + width,
        y_after
    )
    .unwrap();
    y_after
}

/// Cadre autour d’un morceau de rotation (`y_top` > `y_bottom`, coordonnées PDF).
fn draw_chunk_outer_border(content: &mut String, y_top: f32, y_bottom: f32, width: f32) {
    let h = y_top - y_bottom;
    writeln!(
        content,
        "0.3 0.3 0.4 RG 1 w {} {} {} {} re S",
        MARGIN,
        y_bottom,
        width,
        h
    )
    .unwrap();
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
