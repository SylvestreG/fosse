use serde::{Deserialize, Serialize};
use std::fmt;

/// Représente un niveau de plongée complet ou une compétence intermédiaire
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DivingLevel {
    // Niveaux principaux
    N1,
    N2,
    N3,
    N4,
    N5,
    
    // Encadrement
    E2,
    MF1,
    MF2,
    
    // Compétences intermédiaires N2
    PE40,
    PA20,
    
    // Compétences intermédiaires N3
    PA40,
    PE60,
    PA60,
}

impl DivingLevel {
    /// Retourne la hiérarchie du niveau (plus le nombre est élevé, plus le niveau est haut)
    pub fn hierarchy(&self) -> u8 {
        match self {
            DivingLevel::N1 => 10,
            DivingLevel::PE40 => 11,
            DivingLevel::PA20 => 11,
            DivingLevel::N2 => 20,
            DivingLevel::PA40 => 21,
            DivingLevel::PE60 => 21,
            DivingLevel::PA60 => 21,
            DivingLevel::N3 => 30,
            DivingLevel::N4 => 40,
            DivingLevel::N5 => 50,
            DivingLevel::E2 => 55,
            DivingLevel::MF1 => 60,
            DivingLevel::MF2 => 70,
        }
    }
    
    /// Vérifie si ce niveau ou supérieur est un niveau d'encadrant (>= E2)
    pub fn is_instructor_level(&self) -> bool {
        self.hierarchy() >= DivingLevel::E2.hierarchy()
    }
    
    /// Retourne le niveau parent pour les compétences intermédiaires
    #[allow(dead_code)]
    pub fn parent_level(&self) -> Option<DivingLevel> {
        match self {
            DivingLevel::PE40 | DivingLevel::PA20 => Some(DivingLevel::N2),
            DivingLevel::PA40 | DivingLevel::PE60 | DivingLevel::PA60 => Some(DivingLevel::N3),
            _ => None,
        }
    }
    
    /// Retourne toutes les compétences requises pour valider ce niveau
    pub fn required_competencies(&self) -> Vec<DivingLevel> {
        match self {
            DivingLevel::N2 => vec![DivingLevel::PE40, DivingLevel::PA20],
            DivingLevel::N3 => vec![DivingLevel::PA40, DivingLevel::PE60, DivingLevel::PA60],
            _ => vec![],
        }
    }
    
    /// Vérifie si c'est une compétence intermédiaire
    pub fn is_competency(&self) -> bool {
        matches!(
            self,
            DivingLevel::PE40 | DivingLevel::PA20 | DivingLevel::PA40 | DivingLevel::PE60 | DivingLevel::PA60
        )
    }
    
    /// Parse une chaîne en DivingLevel
    pub fn from_str(s: &str) -> Option<DivingLevel> {
        match s.to_uppercase().as_str() {
            "N1" => Some(DivingLevel::N1),
            "N2" => Some(DivingLevel::N2),
            "N3" => Some(DivingLevel::N3),
            "N4" => Some(DivingLevel::N4),
            "N5" => Some(DivingLevel::N5),
            "E2" => Some(DivingLevel::E2),
            "MF1" => Some(DivingLevel::MF1),
            "MF2" => Some(DivingLevel::MF2),
            "PE40" => Some(DivingLevel::PE40),
            "PA20" => Some(DivingLevel::PA20),
            "PA40" => Some(DivingLevel::PA40),
            "PE60" => Some(DivingLevel::PE60),
            "PA60" => Some(DivingLevel::PA60),
            _ => None,
        }
    }
}

impl fmt::Display for DivingLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            DivingLevel::N1 => "N1",
            DivingLevel::N2 => "N2",
            DivingLevel::N3 => "N3",
            DivingLevel::N4 => "N4",
            DivingLevel::N5 => "N5",
            DivingLevel::E2 => "E2",
            DivingLevel::MF1 => "MF1",
            DivingLevel::MF2 => "MF2",
            DivingLevel::PE40 => "PE40",
            DivingLevel::PA20 => "PA20",
            DivingLevel::PA40 => "PA40",
            DivingLevel::PE60 => "PE60",
            DivingLevel::PA60 => "PA60",
        };
        write!(f, "{}", s)
    }
}

/// Représente le niveau actuel d'un plongeur avec ses compétences en cours
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiverLevel {
    /// Niveaux et compétences validés (du plus récent au plus ancien)
    pub validated: Vec<DivingLevel>,
}

impl DiverLevel {
    /// Crée un nouveau DiverLevel vide
    pub fn new() -> Self {
        DiverLevel {
            validated: Vec::new(),
        }
    }
    
    /// Crée un DiverLevel depuis une chaîne formatée (ex: "N2", "PA40,PE60", "N3")
    pub fn from_string(s: &str) -> Option<Self> {
        if s.is_empty() {
            return Some(DiverLevel::new());
        }
        
        let levels: Vec<DivingLevel> = s
            .split(',')
            .filter_map(|part| DivingLevel::from_str(part.trim()))
            .collect();
        
        if levels.is_empty() {
            None
        } else {
            Some(DiverLevel { validated: levels })
        }
    }
    
    /// Ajoute un niveau ou une compétence validée
    #[allow(dead_code)]
    pub fn add_validated(&mut self, level: DivingLevel) {
        if !self.validated.contains(&level) {
            self.validated.push(level);
        }
    }
    
    /// Retourne le niveau le plus haut validé
    pub fn highest_complete_level(&self) -> Option<&DivingLevel> {
        self.validated
            .iter()
            .filter(|l| !l.is_competency())
            .max_by_key(|l| l.hierarchy())
    }
    
    /// Retourne les compétences en cours pour le niveau en préparation
    #[allow(dead_code)]
    pub fn current_competencies(&self) -> Vec<&DivingLevel> {
        let highest = self.highest_complete_level();
        let highest_hierarchy = highest.map(|l| l.hierarchy()).unwrap_or(0);
        
        self.validated
            .iter()
            .filter(|l| l.is_competency() && l.hierarchy() > highest_hierarchy)
            .collect()
    }
    
    /// Vérifie si le plongeur est encadrant (niveau >= E2)
    pub fn is_instructor(&self) -> bool {
        self.highest_complete_level()
            .map(|level| level.is_instructor_level())
            .unwrap_or(false)
    }
    
    /// Retourne le niveau que le plongeur prépare (s'il en prépare un)
    pub fn preparing_level(&self) -> Option<String> {
        // Vérifier si on a des compétences N3 en cours
        let n3_competencies: Vec<&DivingLevel> = self.validated
            .iter()
            .filter(|l| matches!(l, DivingLevel::PA40 | DivingLevel::PE60 | DivingLevel::PA60))
            .collect();
        
        if !n3_competencies.is_empty() && !self.is_level_complete(&DivingLevel::N3) {
            return Some("N3".to_string());
        }
        
        // Vérifier si on a des compétences N2 en cours
        let n2_competencies: Vec<&DivingLevel> = self.validated
            .iter()
            .filter(|l| matches!(l, DivingLevel::PE40 | DivingLevel::PA20))
            .collect();
        
        if !n2_competencies.is_empty() && !self.is_level_complete(&DivingLevel::N2) {
            return Some("N2".to_string());
        }
        
        None
    }
    
    /// Vérifie si un niveau est complètement validé (toutes les compétences)
    fn is_level_complete(&self, level: &DivingLevel) -> bool {
        let required = level.required_competencies();
        if required.is_empty() {
            return self.validated.contains(level);
        }
        
        required.iter().all(|comp| self.validated.contains(comp))
    }
    
    /// Calcule la représentation affichée du niveau actuel selon la logique métier
    /// 
    /// Règles:
    /// - Si toutes les compétences d'un niveau sont validées, on affiche le niveau complet
    /// - Sinon, on affiche les compétences en cours
    /// - On garde toujours le niveau le plus haut
    pub fn display(&self) -> String {
        // Vérifier si on a des niveaux N2 ou N3 en cours de validation
        let n3_competencies: Vec<&DivingLevel> = self.validated
            .iter()
            .filter(|l| matches!(l, DivingLevel::PA40 | DivingLevel::PE60 | DivingLevel::PA60))
            .collect();
        
        let n2_competencies: Vec<&DivingLevel> = self.validated
            .iter()
            .filter(|l| matches!(l, DivingLevel::PE40 | DivingLevel::PA20))
            .collect();
        
        // Vérifier si N3 est complet
        if self.is_level_complete(&DivingLevel::N3) {
            return "N3".to_string();
        }
        
        // Vérifier si N2 est complet
        if self.is_level_complete(&DivingLevel::N2) {
            // Si on a des compétences N3, on les affiche
            if !n3_competencies.is_empty() {
                let mut comps: Vec<String> = n3_competencies
                    .iter()
                    .map(|c| c.to_string())
                    .collect();
                comps.sort();
                return comps.join(", ");
            }
            return "N2".to_string();
        }
        
        // Si on a des compétences N3, les afficher
        if !n3_competencies.is_empty() {
            let mut comps: Vec<String> = n3_competencies
                .iter()
                .map(|c| c.to_string())
                .collect();
            comps.sort();
            return comps.join(", ");
        }
        
        // Si on a des compétences N2, les afficher
        if !n2_competencies.is_empty() {
            let mut comps: Vec<String> = n2_competencies
                .iter()
                .map(|c| c.to_string())
                .collect();
            comps.sort();
            return comps.join(", ");
        }
        
        // Sinon, afficher le niveau complet le plus haut
        if let Some(highest) = self.highest_complete_level() {
            return highest.to_string();
        }
        
        "Aucun niveau".to_string()
    }
    
    /// Convertit en string pour la base de données
    #[allow(dead_code)]
    pub fn to_string(&self) -> String {
        if self.validated.is_empty() {
            return String::new();
        }
        
        self.validated
            .iter()
            .map(|l| l.to_string())
            .collect::<Vec<_>>()
            .join(",")
    }
}

impl Default for DiverLevel {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_n2_with_all_competencies_becomes_n2() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        level.add_validated(DivingLevel::PE40);
        level.add_validated(DivingLevel::PA20);
        
        assert_eq!(level.display(), "N2");
    }
    
    #[test]
    fn test_n2_with_partial_competencies_shows_competencies() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        level.add_validated(DivingLevel::PE40);
        
        assert_eq!(level.display(), "PE40");
    }
    
    #[test]
    fn test_n2_preparing_n3_with_partial_shows_competencies() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        level.add_validated(DivingLevel::PE40);
        level.add_validated(DivingLevel::PA20);
        level.add_validated(DivingLevel::PA40);
        level.add_validated(DivingLevel::PE60);
        
        let display = level.display();
        assert!(display.contains("PA40"));
        assert!(display.contains("PE60"));
    }
    
    #[test]
    fn test_n2_preparing_n3_complete_becomes_n3() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        level.add_validated(DivingLevel::PE40);
        level.add_validated(DivingLevel::PA20);
        level.add_validated(DivingLevel::PA40);
        level.add_validated(DivingLevel::PE60);
        level.add_validated(DivingLevel::PA60);
        
        assert_eq!(level.display(), "N3");
    }
    
    #[test]
    fn test_hierarchy_ordering() {
        assert!(DivingLevel::N2.hierarchy() > DivingLevel::N1.hierarchy());
        assert!(DivingLevel::N3.hierarchy() > DivingLevel::N2.hierarchy());
        assert!(DivingLevel::MF2.hierarchy() > DivingLevel::MF1.hierarchy());
        assert!(DivingLevel::PE40.hierarchy() > DivingLevel::N1.hierarchy());
        assert!(DivingLevel::PE40.hierarchy() < DivingLevel::N2.hierarchy());
    }
    
    #[test]
    fn test_from_string() {
        assert_eq!(DivingLevel::from_str("N1"), Some(DivingLevel::N1));
        assert_eq!(DivingLevel::from_str("n2"), Some(DivingLevel::N2));
        assert_eq!(DivingLevel::from_str("PE40"), Some(DivingLevel::PE40));
        assert_eq!(DivingLevel::from_str("E2"), Some(DivingLevel::E2));
        assert_eq!(DivingLevel::from_str("MF1"), Some(DivingLevel::MF1));
        assert_eq!(DivingLevel::from_str("pa60"), Some(DivingLevel::PA60));
        assert_eq!(DivingLevel::from_str("invalid"), None);
    }
    
    #[test]
    fn test_is_instructor() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        assert!(!level.is_instructor());
        
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N4);
        assert!(!level.is_instructor());
        
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::E2);
        assert!(level.is_instructor());
        
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::MF1);
        assert!(level.is_instructor());
        
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::MF2);
        assert!(level.is_instructor());
    }
    
    #[test]
    fn test_preparing_level() {
        // N2 avec compétences en cours
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        level.add_validated(DivingLevel::PE40);
        assert_eq!(level.preparing_level(), Some("N2".to_string()));
        
        // N2 complet préparant N3
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N2);
        level.add_validated(DivingLevel::PA40);
        assert_eq!(level.preparing_level(), Some("N3".to_string()));
        
        // N3 complet, ne prépare rien
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N3);
        assert_eq!(level.preparing_level(), None);
    }
    
    #[test]
    fn test_e2_level() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::E2);
        assert_eq!(level.display(), "E2");
        assert!(level.is_instructor());
    }
    
    #[test]
    fn test_diver_level_from_string() {
        let level = DiverLevel::from_string("N2").unwrap();
        assert_eq!(level.display(), "N2");
        
        let level = DiverLevel::from_string("PA40,PE60").unwrap();
        let display = level.display();
        assert!(display.contains("PA40"));
        assert!(display.contains("PE60"));
        
        let level = DiverLevel::from_string("").unwrap();
        assert_eq!(level.display(), "Aucun niveau");
    }
    
    #[test]
    fn test_complete_n3_scenario() {
        // Scénario: N2 qui prépare N3
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N2);
        assert_eq!(level.display(), "N2");
        
        // Valide PA40
        level.add_validated(DivingLevel::PA40);
        assert_eq!(level.display(), "PA40");
        
        // Valide PE60
        level.add_validated(DivingLevel::PE60);
        let display = level.display();
        assert!(display.contains("PA40"));
        assert!(display.contains("PE60"));
        
        // Valide PA60 -> devient N3
        level.add_validated(DivingLevel::PA60);
        assert_eq!(level.display(), "N3");
    }
    
    #[test]
    fn test_only_n1() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N1);
        assert_eq!(level.display(), "N1");
    }
    
    #[test]
    fn test_n4_level() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N4);
        assert_eq!(level.display(), "N4");
    }
    
    #[test]
    fn test_mf1_level() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::MF1);
        assert_eq!(level.display(), "MF1");
    }
    
    #[test]
    fn test_to_string_conversion() {
        let mut level = DiverLevel::new();
        level.add_validated(DivingLevel::N2);
        level.add_validated(DivingLevel::PA40);
        level.add_validated(DivingLevel::PE60);
        
        let str_repr = level.to_string();
        assert!(str_repr.contains("N2"));
        assert!(str_repr.contains("PA40"));
        assert!(str_repr.contains("PE60"));
    }
}

