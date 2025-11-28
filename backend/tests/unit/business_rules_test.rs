use fosse_backend::models::SubmitQuestionnaireRequest;
use fosse_backend::services::QuestionnaireService;
use uuid::Uuid;

#[test]
fn test_business_rule_encadrant_gets_2nd_reg() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: true,
        wants_nitrox: false,
        wants_2nd_reg: false, // User says no, but rule should override
        wants_stab: false,
        stab_size: None,
        has_car: false,
        car_seats: None,
        comments: None,
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert!(request.wants_2nd_reg, "Encadrant should automatically get 2nd regulator");
    insta::assert_yaml_snapshot!("encadrant_2nd_reg", request);
}

#[test]
fn test_business_rule_stab_size_only_if_wants_stab() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: false,
        wants_nitrox: false,
        wants_2nd_reg: false,
        wants_stab: false,
        stab_size: Some("Large".to_string()), // Should be cleared
        has_car: false,
        car_seats: None,
        comments: None,
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert!(request.stab_size.is_none(), "Stab size should be None when wants_stab is false");
    insta::assert_yaml_snapshot!("no_stab_clears_size", request);
}

#[test]
fn test_business_rule_stab_size_kept_when_wants_stab() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: false,
        wants_nitrox: false,
        wants_2nd_reg: false,
        wants_stab: true,
        stab_size: Some("Medium".to_string()),
        has_car: false,
        car_seats: None,
        comments: None,
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert_eq!(request.stab_size, Some("Medium".to_string()));
    insta::assert_yaml_snapshot!("wants_stab_keeps_size", request);
}

#[test]
fn test_business_rule_car_seats_required_when_has_car() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: false,
        wants_nitrox: false,
        wants_2nd_reg: false,
        wants_stab: false,
        stab_size: None,
        has_car: true,
        car_seats: None, // Should default to 1
        comments: None,
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert_eq!(request.car_seats, Some(1), "Car seats should default to 1 when has_car is true");
    insta::assert_yaml_snapshot!("has_car_defaults_seats", request);
}

#[test]
fn test_business_rule_car_seats_corrected_to_minimum() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: false,
        wants_nitrox: false,
        wants_2nd_reg: false,
        wants_stab: false,
        stab_size: None,
        has_car: true,
        car_seats: Some(0), // Invalid, should be corrected to 1
        comments: None,
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert_eq!(request.car_seats, Some(1), "Car seats should be at least 1");
    insta::assert_yaml_snapshot!("car_seats_corrected_minimum", request);
}

#[test]
fn test_business_rule_no_car_clears_seats() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: false,
        wants_nitrox: false,
        wants_2nd_reg: false,
        wants_stab: false,
        stab_size: None,
        has_car: false,
        car_seats: Some(4), // Should be cleared
        comments: None,
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert!(request.car_seats.is_none(), "Car seats should be None when has_car is false");
    insta::assert_yaml_snapshot!("no_car_clears_seats", request);
}

#[test]
fn test_business_rule_complex_scenario() {
    let mut request = SubmitQuestionnaireRequest {
        token: Uuid::new_v4(),
        is_encadrant: true,
        wants_nitrox: true,
        wants_2nd_reg: false, // Will be forced to true
        wants_stab: false,
        stab_size: Some("Large".to_string()), // Will be cleared
        has_car: true,
        car_seats: Some(0), // Will be corrected to 1
        comments: Some("Looking forward to the session!".to_string()),
    };

    QuestionnaireService::apply_business_rules(&mut request);

    assert!(request.wants_2nd_reg);
    assert!(request.stab_size.is_none());
    assert_eq!(request.car_seats, Some(1));
    insta::assert_yaml_snapshot!("complex_business_rules", request);
}

