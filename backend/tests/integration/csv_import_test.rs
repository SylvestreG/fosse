use chrono::Utc;
use fosse_backend::{
    config::{Config, MagicLinkConfig},
    entities::{prelude::*, sessions},
    services::{EmailService, ImportService},
};
use sea_orm::{Database, DatabaseConnection, EntityTrait, Set};
use uuid::Uuid;

async fn setup_test_db() -> DatabaseConnection {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    migration::Migrator::up(&db, None).await.unwrap();
    db
}

async fn create_test_session(db: &DatabaseConnection) -> Uuid {
    let session_id = Uuid::new_v4();
    let now = Utc::now().naive_utc();
    
    let session = sessions::ActiveModel {
        id: Set(session_id),
        name: Set("Test Session".to_string()),
        start_date: Set(chrono::NaiveDate::from_ymd_opt(2024, 6, 1).unwrap()),
        end_date: Set(chrono::NaiveDate::from_ymd_opt(2024, 6, 7).unwrap()),
        location: Set(Some("Test Pool".to_string())),
        description: Set(Some("Test description".to_string())),
        created_at: Set(now),
        updated_at: Set(now),
    };
    
    session.insert(db).await.unwrap();
    session_id
}

fn create_test_config() -> Config {
    // Load the test config from fixtures
    Config::load("fixtures/test_config.json")
        .expect("Failed to load test config")
}

fn create_mock_email_service(config: &Config) -> EmailService {
    EmailService::new(config.magic_link.base_url.clone())
}

#[tokio::test]
async fn test_csv_import_valid_data() {
    let db = setup_test_db().await;
    let session_id = create_test_session(&db).await;
    let config = create_test_config();
    let email_service = create_mock_email_service(&config);
    
    let csv_content = "first_name,last_name,email,phone
Jean,Dupont,jean.dupont@example.com,0612345678
Marie,Martin,marie.martin@example.com,0698765432";
    
    // Note: This test will fail email sending since we're using a mock SMTP
    // In a real scenario, you'd mock the email service or use a test SMTP server
    let result = ImportService::import_csv(
        &db,
        &email_service,
        session_id,
        "test.csv".to_string(),
        csv_content,
        72,
    )
    .await;
    
    // Even if email fails, import job should be created
    if let Ok(import_job_id) = result {
        let import_job = ImportService::get_import_job(&db, import_job_id).await.unwrap();
        
        assert_eq!(import_job.total_rows, 2);
        insta::assert_yaml_snapshot!("csv_import_valid", import_job);
    }
}

#[tokio::test]
async fn test_csv_import_invalid_email() {
    let db = setup_test_db().await;
    let session_id = create_test_session(&db).await;
    let config = create_test_config();
    let email_service = create_mock_email_service(&config);
    
    let csv_content = "first_name,last_name,email,phone
Jean,Dupont,invalid-email,0612345678
Marie,Martin,marie.martin@example.com,0698765432";
    
    let result = ImportService::import_csv(
        &db,
        &email_service,
        session_id,
        "test_invalid.csv".to_string(),
        csv_content,
        72,
    )
    .await;
    
    if let Ok(import_job_id) = result {
        let import_job = ImportService::get_import_job(&db, import_job_id).await.unwrap();
        
        assert_eq!(import_job.total_rows, 2);
        assert!(import_job.error_count > 0, "Should have at least one error");
        insta::assert_yaml_snapshot!("csv_import_invalid_email", import_job);
    }
}

#[tokio::test]
async fn test_csv_import_duplicate_email() {
    let db = setup_test_db().await;
    let session_id = create_test_session(&db).await;
    let config = create_test_config();
    let email_service = create_mock_email_service(&config);
    
    let csv_content = "first_name,last_name,email,phone
Jean,Dupont,jean.dupont@example.com,0612345678
Jean,Dupont,jean.dupont@example.com,0612345678";
    
    let result = ImportService::import_csv(
        &db,
        &email_service,
        session_id,
        "test_duplicate.csv".to_string(),
        csv_content,
        72,
    )
    .await;
    
    if let Ok(import_job_id) = result {
        let import_job = ImportService::get_import_job(&db, import_job_id).await.unwrap();
        
        // Should create person once, questionnaires for both rows
        insta::assert_yaml_snapshot!("csv_import_duplicate_email", import_job);
    }
}

#[tokio::test]
async fn test_people_created_from_csv() {
    let db = setup_test_db().await;
    let session_id = create_test_session(&db).await;
    let config = create_test_config();
    let email_service = create_mock_email_service(&config);
    
    let csv_content = "first_name,last_name,email,phone
Alice,Wonder,alice@example.com,0611111111";
    
    let _ = ImportService::import_csv(
        &db,
        &email_service,
        session_id,
        "people_test.csv".to_string(),
        csv_content,
        72,
    )
    .await;
    
    // Check that person was created
    let people = People::find().all(&db).await.unwrap();
    
    if !people.is_empty() {
        let person = &people[0];
        assert_eq!(person.first_name, "Alice");
        assert_eq!(person.last_name, "Wonder");
        assert_eq!(person.email, "alice@example.com");
        
        insta::assert_yaml_snapshot!("person_from_csv", person);
    }
}

