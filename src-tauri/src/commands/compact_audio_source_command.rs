use super::comparison::comparison_source;
use super::project_file_open::resolve_project_entry;
use super::project_files::is_audio_extension;
use super::resolve_workspace_root;
use crate::models::ProjectSummary;
use crate::workspace;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompactAudioSourceRequest {
    client_id: String,
    project_id: String,
    revision: Option<u32>,
    delivery: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompactAudioSourceResult {
    available: bool,
    relative_path: Option<String>,
    display_name: Option<String>,
    reason: String,
}

impl CompactAudioSourceResult {
    fn available(project_directory: &Path, path: PathBuf) -> Self {
        let relative_path = path
            .strip_prefix(project_directory)
            .expect("selected compact audio remains inside the project")
            .to_string_lossy()
            .replace('\\', "/");
        let display_name = path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned());
        Self {
            available: true,
            relative_path: Some(relative_path),
            display_name,
            reason: "Audio preview is available.".into(),
        }
    }

    fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            available: false,
            relative_path: None,
            display_name: None,
            reason: reason.into(),
        }
    }
}

#[tauri::command]
pub(crate) async fn resolve_compact_audio_source(
    app: tauri::AppHandle,
    request: CompactAudioSourceRequest,
) -> Result<CompactAudioSourceResult, String> {
    tauri::async_runtime::spawn_blocking(move || resolve_source(&app, request))
        .await
        .map_err(|_| "The compact audio source check could not complete".to_owned())?
}

fn resolve_source(
    app: &tauri::AppHandle,
    request: CompactAudioSourceRequest,
) -> Result<CompactAudioSourceResult, String> {
    if request.delivery == request.revision.is_some() {
        return Err("Choose exactly one compact audio source target".into());
    }
    let root = resolve_workspace_root(app)?;
    let (project_directory, project) =
        workspace::discover_project_at(&root, request.client_id.trim(), request.project_id.trim())
            .ok_or_else(|| "The selected project could not be resolved safely".to_owned())?;

    if request.delivery {
        return Ok(resolve_delivery_source(&project_directory, &project));
    }
    let revision = request.revision.expect("request target was validated");
    if !project.revisions.iter().any(|item| item.number == revision) {
        return Ok(CompactAudioSourceResult::unavailable(
            "This revision is no longer recorded in the project.",
        ));
    }
    let revision_directory = project_directory
        .join("04_Revisions")
        .join(format!("Revision_{revision:02}"));
    match comparison_source(&revision_directory) {
        Ok(Some(path)) => Ok(CompactAudioSourceResult::available(
            &project_directory,
            path,
        )),
        Ok(None) => Ok(CompactAudioSourceResult::unavailable(
            "No supported audio file was found in this revision.",
        )),
        Err(error) => Ok(CompactAudioSourceResult::unavailable(error)),
    }
}

fn resolve_delivery_source(
    project_directory: &Path,
    project: &ProjectSummary,
) -> CompactAudioSourceResult {
    let Some(delivery) = project.delivery.as_ref() else {
        return CompactAudioSourceResult::unavailable("No Final Delivery has been recorded.");
    };
    if project.delivered_revision != Some(delivery.revision) {
        return CompactAudioSourceResult::unavailable(
            "The delivered revision could not be verified.",
        );
    }

    let has_source_provenance = delivery.files.iter().any(|file| file.source_path.is_some());
    let primary_source_name = if has_source_provenance {
        let revision_directory = project_directory
            .join("04_Revisions")
            .join(format!("Revision_{:02}", delivery.revision));
        match comparison_source(&revision_directory) {
            Ok(Some(path)) => path
                .file_name()
                .map(|value| value.to_string_lossy().into_owned()),
            Ok(None) => None,
            Err(error) => return CompactAudioSourceResult::unavailable(error),
        }
    } else {
        None
    };
    if has_source_provenance && primary_source_name.is_none() {
        return CompactAudioSourceResult::unavailable(
            "The delivered revision has no supported primary audio source.",
        );
    }

    let mut main_mix = Vec::new();
    let mut fallback = Vec::new();
    let mut supported_main_mix_recorded = false;
    for file in &delivery.files {
        let supported = Path::new(&file.path)
            .extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .is_some_and(|extension| is_audio_extension(&extension));
        if !supported {
            continue;
        }
        if has_source_provenance && file.source_path.as_deref() != primary_source_name.as_deref() {
            continue;
        }
        if file.deliverable_type == "main_mix" {
            supported_main_mix_recorded = true;
        }
        let relative_path = format!("05_Final_Delivery/{}", file.path);
        let (path, _) = match resolve_project_entry(project_directory, &relative_path) {
            Ok(value) if value.0.is_file() => value,
            _ => continue,
        };
        let modified = fs::metadata(&path).and_then(|value| value.modified()).ok();
        let candidate = (modified, path);
        if has_source_provenance || file.deliverable_type == "main_mix" {
            main_mix.push(candidate);
        } else if !file.path.contains('/') && !file.path.contains('\\') {
            fallback.push(candidate);
        }
    }

    if has_source_provenance && main_mix.len() > 1 {
        return CompactAudioSourceResult::unavailable(
            "Final Delivery contains the primary source more than once; Studio will not guess.",
        );
    }

    let candidates = if has_source_provenance || supported_main_mix_recorded {
        &mut main_mix
    } else {
        &mut fallback
    };
    candidates.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    match candidates.pop() {
        Some((_, path)) => CompactAudioSourceResult::available(project_directory, path),
        None => CompactAudioSourceResult::unavailable(
            "No supported audio file is available in Final Delivery.",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DeliveryFile, DeliverySummary, RevisionSummary};

    fn delivery(files: Vec<DeliveryFile>) -> ProjectSummary {
        let summary = DeliverySummary {
            document_id: "delivery".into(),
            created_with: "test".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            method: "Download".into(),
            revision: 1,
            revision_id: "revision-1".into(),
            description: "Mix".into(),
            approved_at: "2026-01-01T00:00:00Z".into(),
            approved_by: "JL".into(),
            files,
        };
        ProjectSummary {
            project_id: "project".into(),
            project_name: "Project".into(),
            artist: "Artist".into(),
            schema_version: "1.1.0".into(),
            created_with: "test".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            deadline: None,
            sample_rate: 48_000,
            bit_depth: 24,
            file_format: "WAV".into(),
            delivery_method: "Download".into(),
            current_revision: 1,
            approved_revision: Some(1),
            delivered_revision: Some(1),
            delivery: Some(summary),
            revisions: vec![RevisionSummary {
                number: 1,
                revision_id: "revision-1".into(),
                created_at: "2026-01-01T00:00:00Z".into(),
                description: "Mix".into(),
                approved_at: Some("2026-01-01T00:00:00Z".into()),
                approved_by: Some("JL".into()),
                lifecycle: "open".into(),
            }],
        }
    }

    fn file(path: &str, deliverable_type: &str) -> DeliveryFile {
        DeliveryFile {
            path: path.into(),
            source_path: None,
            deliverable_type: deliverable_type.into(),
            size_bytes: 1,
            sha256: "0".repeat(64),
        }
    }

    fn sourced_file(path: &str, source_path: &str) -> DeliveryFile {
        DeliveryFile {
            source_path: Some(source_path.into()),
            ..file(path, "main_mix")
        }
    }

    #[test]
    fn delivery_prefers_the_recorded_main_mix() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("05_Final_Delivery")).unwrap();
        fs::write(root.path().join("05_Final_Delivery/Mix.wav"), b"mix").unwrap();
        fs::write(
            root.path().join("05_Final_Delivery/Instrumental.wav"),
            b"inst",
        )
        .unwrap();
        let project = delivery(vec![
            file("Instrumental.wav", "instrumental"),
            file("Mix.wav", "main_mix"),
        ]);

        let result = resolve_delivery_source(root.path(), &project);
        assert_eq!(
            result.relative_path.as_deref(),
            Some("05_Final_Delivery/Mix.wav")
        );
    }

    #[test]
    fn delivery_never_falls_back_to_a_revision_file() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("04_Revisions/Revision_01")).unwrap();
        fs::write(root.path().join("04_Revisions/Revision_01/Mix.wav"), b"mix").unwrap();
        let project = delivery(Vec::new());

        let result = resolve_delivery_source(root.path(), &project);
        assert!(!result.available);
        assert!(result.relative_path.is_none());
    }

    #[test]
    fn delivery_does_not_replace_a_missing_main_mix_with_an_instrumental() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("05_Final_Delivery")).unwrap();
        fs::write(
            root.path().join("05_Final_Delivery/Instrumental.wav"),
            b"inst",
        )
        .unwrap();
        let project = delivery(vec![
            file("Missing Mix.wav", "main_mix"),
            file("Instrumental.wav", "instrumental"),
        ]);

        let result = resolve_delivery_source(root.path(), &project);
        assert!(!result.available);
        assert!(result.relative_path.is_none());
    }

    #[test]
    fn delivery_maps_the_revision_primary_through_manifest_provenance() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("04_Revisions/Revision_01")).unwrap();
        fs::create_dir(root.path().join("05_Final_Delivery")).unwrap();
        fs::write(
            root.path().join("04_Revisions/Revision_01/Primary.wav"),
            b"source",
        )
        .unwrap();
        fs::write(root.path().join("05_Final_Delivery/Delivered.wav"), b"mix").unwrap();
        let project = delivery(vec![sourced_file("Delivered.wav", "Primary.wav")]);

        let result = resolve_delivery_source(root.path(), &project);
        assert_eq!(
            result.relative_path.as_deref(),
            Some("05_Final_Delivery/Delivered.wav")
        );
    }
}
