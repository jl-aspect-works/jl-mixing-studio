use crate::models::WorkspaceStatus;
use crate::workspace::discover_workspace_at;
use serde_json::json;
use std::fs;
use tempfile::tempdir;

#[test]
fn windows_absolute_studio_root_is_accepted_by_bundled_schema() {
    let temp = tempdir().expect("temporary workspace");
    let root = temp.path();
    fs::create_dir(root.join("Studio")).expect("Studio directory");
    fs::create_dir(root.join("Clients")).expect("Clients directory");

    let windows_root = r"C:\Users\Tester\Music\Mixes";
    let studio = json!({
        "metadata": {
            "schema": "mixing-studio",
            "schema_version": "1.1.0",
            "document_id": "00000000-0000-0000-0000-000000000001",
            "created_with": "jl-mixing 1.5.0-rc.1",
            "created_at": "2030-01-01T12:00:00Z",
            "last_modified_at": "2030-01-01T12:00:00Z"
        },
        "studio_id": "test-studio",
        "studio_name": "Test Studio",
        "root_path": windows_root,
        "defaults": {
            "mix_engineer": "Engineer",
            "audio": {
                "sample_rate": 48000,
                "bit_depth": 24,
                "file_format": "WAV"
            },
            "delivery": {
                "method": "Cloud transfer",
                "requested_deliverables": ["main_mix"]
            }
        },
        "cli": {
            "change_directory_after_create": false
        }
    });
    fs::write(
        root.join("Studio").join("studio.json"),
        serde_json::to_vec_pretty(&studio).expect("studio json"),
    )
    .expect("write studio.json");

    let snapshot = discover_workspace_at(root);
    assert_eq!(snapshot.status, WorkspaceStatus::Empty);
    assert!(snapshot.issues.is_empty());
    assert_eq!(
        snapshot.studio.expect("studio summary").root_path,
        windows_root
    );
}
