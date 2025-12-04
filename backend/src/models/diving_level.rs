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
    
    /// Vérifie si c'est une compétence intermédiaire (gardé pour compatibilité)
    #[allow(dead_code)]
    pub fn is_competency(&self) -> bool {
        matches!(
            self,
            DivingLevel::PE40 | DivingLevel::PA20 | DivingLevel::PA40 | DivingLevel::PE60 | DivingLevel::PA60
        )
    }
    
    /// Parse une chaîne en DivingLevel
    pub fn parse(s: &str) -> Option<DivingLevel> {
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
    
    /// Crée un DiverLevel depuis une chaîne formatée (ex: "N2", "N2,preparing_N3", "N3")
    pub fn from_string(s: &str) -> Option<Self> {
        if s.is_empty() {
            return Some(DiverLevel::new());
        }
        
        let mut diver_level = DiverLevel::new();
        
        for part in s.split(',') {
            let trimmed = part.trim();
            
            // Ignorer les préfixes "preparing_" - on les parse séparément
            if trimmed.starts_with("preparing_") {
                continue;
            }
            
            if let Some(level) = DivingLevel::parse(trimmed) {
                diver_level.validated.push(level);
            }
        }
        
        Some(diver_level)
    }
    
    /// Extrait le niveau préparé depuis une chaîne (cherche "preparing_N2", "preparing_N3", etc.)
    pub fn extract_preparing_level(s: &str) -> Option<String> {
        for part in s.split(',') {
            let trimmed = part.trim();
            if let Some(level) = trimmed.strip_prefix("preparing_") {
                return Some(level.to_string());
            }
        }
        None
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
    #[allow(dead_code)]
    pub fn preparing_level(&self) -> Option<String> {
        // Cette méthode n'est plus utilisée - on utilise extract_preparing_level() à la place
        None
    }
    
    
    /// Calcule la représentation affichée du niveau actuel
    /// 
    /// Retourne simplement le niveau le plus haut validé
    pub fn display(&self) -> String {
        if let Some(highest) = self.highest_complete_level() {
            return highest.to_string();
        }
        
        "Aucun niveau".to_string()
    }
    
    /// Convertit en string pour la base de données
    #[allow(dead_code)]
    pub fn to_db_string(&self) -> String {
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
    fn test_hierarchy_ordering() {
        assert!(DivingLevel::N2.hierarchy() > DivingLevel::N1.hierarchy());
        assert!(DivingLevel::N3.hierarchy() > DivingLevel::N2.hierarchy());
        assert!(DivingLevel::E2.hierarchy() > DivingLevel::N5.hierarchy());
        assert!(DivingLevel::MF2.hierarchy() > DivingLevel::MF1.hierarchy());
    }
    
    #[test]
    fn test_from_string() {
        assert_eq!(DivingLevel::parse("N1"), Some(DivingLevel::N1));
        assert_eq!(DivingLevel::parse("n2"), Some(DivingLevel::N2));
        assert_eq!(DivingLevel::parse("E2"), Some(DivingLevel::E2));
        assert_eq!(DivingLevel::parse("MF1"), Some(DivingLevel::MF1));
        assert_eq!(DivingLevel::parse("invalid"), None);
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
        
        let level = DiverLevel::from_string("N1,N2,N3").unwrap();
        assert_eq!(level.display(), "N3");
        
        let level = DiverLevel::from_string("").unwrap();
        assert_eq!(level.display(), "Aucun niveau");
    }
    
    #[test]
    fn test_extract_preparing_level() {
        assert_eq!(DiverLevel::extract_preparing_level("N2,preparing_N3"), Some("N3".to_string()));
        assert_eq!(DiverLevel::extract_preparing_level("N1,preparing_N2"), Some("N2".to_string()));
        assert_eq!(DiverLevel::extract_preparing_level("N2"), None);
        assert_eq!(DiverLevel::extract_preparing_level(""), None);
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
}

