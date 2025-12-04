use serde::{Deserialize, Serialize};
use std::fmt;

/// Liste des permissions disponibles dans l'application
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // Sessions
    SessionsView,
    SessionsCreate,
    SessionsEdit,
    SessionsDelete,
    
    // Questionnaires
    QuestionnairesView,
    QuestionnairesEdit,
    QuestionnairesDelete,
    
    // Users/People
    UsersView,
    UsersCreate,
    UsersEdit,
    UsersDelete,
    
    // Competencies
    CompetenciesView,
    CompetenciesCreate,
    CompetenciesEdit,
    CompetenciesDelete,
    CompetenciesValidate, // Pour les encadrants: valider les compétences des élèves
    
    // Emails
    EmailsView,
    EmailsSend,
    
    // Import
    ImportCsv,
    
    // Groups/ACL management (admin only)
    GroupsView,
    GroupsEdit,
    
    // Summaries
    SummariesView,
}

impl Permission {
    /// Retourne toutes les permissions disponibles
    pub fn all() -> Vec<Permission> {
        vec![
            Permission::SessionsView,
            Permission::SessionsCreate,
            Permission::SessionsEdit,
            Permission::SessionsDelete,
            Permission::QuestionnairesView,
            Permission::QuestionnairesEdit,
            Permission::QuestionnairesDelete,
            Permission::UsersView,
            Permission::UsersCreate,
            Permission::UsersEdit,
            Permission::UsersDelete,
            Permission::CompetenciesView,
            Permission::CompetenciesCreate,
            Permission::CompetenciesEdit,
            Permission::CompetenciesDelete,
            Permission::CompetenciesValidate,
            Permission::EmailsView,
            Permission::EmailsSend,
            Permission::ImportCsv,
            Permission::GroupsView,
            Permission::GroupsEdit,
            Permission::SummariesView,
        ]
    }

    /// Parse depuis une string
    pub fn parse(s: &str) -> Option<Permission> {
        match s {
            "sessions_view" => Some(Permission::SessionsView),
            "sessions_create" => Some(Permission::SessionsCreate),
            "sessions_edit" => Some(Permission::SessionsEdit),
            "sessions_delete" => Some(Permission::SessionsDelete),
            "questionnaires_view" => Some(Permission::QuestionnairesView),
            "questionnaires_edit" => Some(Permission::QuestionnairesEdit),
            "questionnaires_delete" => Some(Permission::QuestionnairesDelete),
            "users_view" => Some(Permission::UsersView),
            "users_create" => Some(Permission::UsersCreate),
            "users_edit" => Some(Permission::UsersEdit),
            "users_delete" => Some(Permission::UsersDelete),
            "competencies_view" => Some(Permission::CompetenciesView),
            "competencies_create" => Some(Permission::CompetenciesCreate),
            "competencies_edit" => Some(Permission::CompetenciesEdit),
            "competencies_delete" => Some(Permission::CompetenciesDelete),
            "competencies_validate" => Some(Permission::CompetenciesValidate),
            "emails_view" => Some(Permission::EmailsView),
            "emails_send" => Some(Permission::EmailsSend),
            "import_csv" => Some(Permission::ImportCsv),
            "groups_view" => Some(Permission::GroupsView),
            "groups_edit" => Some(Permission::GroupsEdit),
            "summaries_view" => Some(Permission::SummariesView),
            _ => None,
        }
    }

    /// Convertit en string pour la DB
    pub fn as_str(&self) -> &'static str {
        match self {
            Permission::SessionsView => "sessions_view",
            Permission::SessionsCreate => "sessions_create",
            Permission::SessionsEdit => "sessions_edit",
            Permission::SessionsDelete => "sessions_delete",
            Permission::QuestionnairesView => "questionnaires_view",
            Permission::QuestionnairesEdit => "questionnaires_edit",
            Permission::QuestionnairesDelete => "questionnaires_delete",
            Permission::UsersView => "users_view",
            Permission::UsersCreate => "users_create",
            Permission::UsersEdit => "users_edit",
            Permission::UsersDelete => "users_delete",
            Permission::CompetenciesView => "competencies_view",
            Permission::CompetenciesCreate => "competencies_create",
            Permission::CompetenciesEdit => "competencies_edit",
            Permission::CompetenciesDelete => "competencies_delete",
            Permission::CompetenciesValidate => "competencies_validate",
            Permission::EmailsView => "emails_view",
            Permission::EmailsSend => "emails_send",
            Permission::ImportCsv => "import_csv",
            Permission::GroupsView => "groups_view",
            Permission::GroupsEdit => "groups_edit",
            Permission::SummariesView => "summaries_view",
        }
    }

    /// Description de la permission
    pub fn description(&self) -> &'static str {
        match self {
            Permission::SessionsView => "Voir les sessions",
            Permission::SessionsCreate => "Créer des sessions",
            Permission::SessionsEdit => "Modifier les sessions",
            Permission::SessionsDelete => "Supprimer les sessions",
            Permission::QuestionnairesView => "Voir les questionnaires",
            Permission::QuestionnairesEdit => "Modifier les questionnaires",
            Permission::QuestionnairesDelete => "Supprimer les questionnaires",
            Permission::UsersView => "Voir les utilisateurs",
            Permission::UsersCreate => "Créer des utilisateurs",
            Permission::UsersEdit => "Modifier les utilisateurs",
            Permission::UsersDelete => "Supprimer les utilisateurs",
            Permission::CompetenciesView => "Voir les compétences",
            Permission::CompetenciesCreate => "Créer des compétences",
            Permission::CompetenciesEdit => "Modifier les compétences",
            Permission::CompetenciesDelete => "Supprimer les compétences",
            Permission::CompetenciesValidate => "Valider les compétences des élèves",
            Permission::EmailsView => "Voir les emails",
            Permission::EmailsSend => "Envoyer des emails",
            Permission::ImportCsv => "Importer des fichiers CSV",
            Permission::GroupsView => "Voir les groupes et permissions",
            Permission::GroupsEdit => "Modifier les groupes et permissions",
            Permission::SummariesView => "Voir les résumés de session",
        }
    }

    /// Catégorie de la permission
    pub fn category(&self) -> &'static str {
        match self {
            Permission::SessionsView | Permission::SessionsCreate | 
            Permission::SessionsEdit | Permission::SessionsDelete => "Sessions",
            Permission::QuestionnairesView | Permission::QuestionnairesEdit | 
            Permission::QuestionnairesDelete => "Questionnaires",
            Permission::UsersView | Permission::UsersCreate | 
            Permission::UsersEdit | Permission::UsersDelete => "Utilisateurs",
            Permission::CompetenciesView | Permission::CompetenciesCreate | 
            Permission::CompetenciesEdit | Permission::CompetenciesDelete |
            Permission::CompetenciesValidate => "Compétences",
            Permission::EmailsView | Permission::EmailsSend => "Emails",
            Permission::ImportCsv => "Import",
            Permission::GroupsView | Permission::GroupsEdit => "Administration",
            Permission::SummariesView => "Résumés",
        }
    }
}

impl fmt::Display for Permission {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Types de groupes prédéfinis
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum GroupType {
    Admin,
    Encadrant,
    Eleve,
}

impl GroupType {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            GroupType::Admin => "admin",
            GroupType::Encadrant => "encadrant",
            GroupType::Eleve => "eleve",
        }
    }

    #[allow(dead_code)]
    pub fn parse(s: &str) -> Option<GroupType> {
        match s {
            "admin" => Some(GroupType::Admin),
            "encadrant" => Some(GroupType::Encadrant),
            "eleve" => Some(GroupType::Eleve),
            _ => None,
        }
    }

    #[allow(dead_code)]
    pub fn display_name(&self) -> &'static str {
        match self {
            GroupType::Admin => "Administrateur",
            GroupType::Encadrant => "Encadrant",
            GroupType::Eleve => "Élève",
        }
    }

    /// Permissions par défaut pour chaque type de groupe
    #[allow(dead_code)]
    pub fn default_permissions(&self) -> Vec<Permission> {
        match self {
            GroupType::Admin => Permission::all(), // Admin a toutes les permissions
            GroupType::Encadrant => vec![
                Permission::SessionsView,
                Permission::SessionsCreate,
                Permission::SessionsEdit,
                Permission::QuestionnairesView,
                Permission::QuestionnairesEdit,
                Permission::UsersView,
                Permission::CompetenciesView,
                Permission::CompetenciesValidate, // Peut valider les compétences des élèves
                Permission::EmailsView,
                Permission::EmailsSend,
                Permission::ImportCsv,
                Permission::SummariesView,
            ],
            GroupType::Eleve => vec![
                Permission::SessionsView,
                Permission::QuestionnairesView,
                Permission::CompetenciesView,
                Permission::SummariesView,
            ],
        }
    }

    #[allow(dead_code)]
    pub fn all() -> Vec<GroupType> {
        vec![GroupType::Admin, GroupType::Encadrant, GroupType::Eleve]
    }
}

impl fmt::Display for GroupType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Response pour une permission
#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionInfo {
    pub key: String,
    pub description: String,
    pub category: String,
}

impl From<Permission> for PermissionInfo {
    fn from(p: Permission) -> Self {
        PermissionInfo {
            key: p.as_str().to_string(),
            description: p.description().to_string(),
            category: p.category().to_string(),
        }
    }
}

/// Response pour un groupe
#[derive(Debug, Serialize, Deserialize)]
pub struct GroupResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub group_type: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Request pour créer/modifier un groupe
#[derive(Debug, Deserialize)]
pub struct UpdateGroupPermissionsRequest {
    pub permissions: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_roundtrip() {
        for perm in Permission::all() {
            let s = perm.as_str();
            let parsed = Permission::parse(s);
            assert_eq!(Some(perm), parsed, "Failed for permission: {:?}", perm);
        }
    }

    #[test]
    fn test_group_type_roundtrip() {
        for gt in GroupType::all() {
            let s = gt.as_str();
            let parsed = GroupType::parse(s);
            assert_eq!(Some(gt), parsed, "Failed for group type: {:?}", gt);
        }
    }

    #[test]
    fn test_admin_has_all_permissions() {
        let admin_perms = GroupType::Admin.default_permissions();
        let all_perms = Permission::all();
        assert_eq!(admin_perms.len(), all_perms.len());
    }

    #[test]
    fn test_encadrant_permissions() {
        let perms = GroupType::Encadrant.default_permissions();
        assert!(perms.contains(&Permission::SessionsView));
        assert!(perms.contains(&Permission::SessionsCreate));
        assert!(!perms.contains(&Permission::GroupsEdit)); // Ne peut pas gérer les groupes
    }

    #[test]
    fn test_eleve_permissions() {
        let perms = GroupType::Eleve.default_permissions();
        assert!(perms.contains(&Permission::SessionsView));
        assert!(!perms.contains(&Permission::SessionsCreate)); // Ne peut pas créer de sessions
        assert!(!perms.contains(&Permission::UsersEdit)); // Ne peut pas modifier les users
    }
}

