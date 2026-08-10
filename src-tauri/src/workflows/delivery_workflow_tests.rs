use super::*;
use crate::models::PlannedDeliveryFile;
use tempfile::tempdir;

fn clean_delivery_without_stems() -> DeliveryCreationPreview {
    DeliveryCreationPreview {
        client_id: "acme".into(),
        project_id: "blue-sky".into(),
        project_name: "Blue Sky".into(),
        current_revision: 5,
        approved_revision: 4,
        delivered_revision: Some(4),
        delivery_method: "Download".into(),
        replacement_mode: DeliveryReplacementMode::Clean,
        create_zip: false,
        zip_name: None,
        selected: vec![PlannedDeliveryFile {
            source_name: "Blue Sky Main Mix.wav".into(),
            deliverable_type: "main_mix".into(),
            path: "Blue Sky Main Mix.wav".into(),
        }],
        excluded: Vec::new(),
        deletions: vec![
            "Blue Sky Main Mix.wav".into(),
            "Stems/".into(),
            "Stems/Blue Sky Stems.wav".into(),
            "Delivery_Notes.md".into(),
            "delivery-manifest.json".into(),
        ],
    }
}

#[test]
fn clean_reconciliation_accepts_automation_fixed_empty_stems_directory() {
    let directory = tempdir().expect("temporary project directory");
    let delivery = directory.path().join("05_Final_Delivery");
    fs::create_dir_all(delivery.join("Stems")).expect("fixed Stems directory");
    fs::write(delivery.join("Delivery_Notes.md"), "# Delivery\n").expect("delivery notes");
    fs::write(delivery.join("delivery-manifest.json"), "{}\n").expect("delivery manifest");
    fs::write(delivery.join("Blue Sky Main Mix.wav"), "audio").expect("main mix");

    let expected = clean_delivery_without_stems();
    assert!(verify_delivery_artifacts(directory.path(), &expected, None));

    fs::write(delivery.join("Stems/Blue Sky Stems.wav"), "stale stem").expect("stale stem");
    assert!(!verify_delivery_artifacts(directory.path(), &expected, None));
}
