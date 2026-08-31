use super::{
    listening_configuration, publish_listening_copy, resolve_workspace_root,
    validated_project_directory, ListeningSourceSelection,
};
use crate::models::{
    DeliveryCreationPreview, DeliveryStatusRequest, ListeningDestination, ListeningPublishClass,
    ListeningPublishResult, ListeningPublishStatus, PlannedDeliveryFile,
};
use crate::workspace;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Emitter;

const PUBLISH_EVENT: &str = "delivered-listening-publish-results";
const MAIN_MIX_TYPE: &str = "main_mix";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeliveredListeningPublishEvent {
    client_id: String,
    project_id: String,
    revision: u32,
    results: Vec<ListeningPublishResult>,
}

pub(crate) fn publish_after_delivery_creation(
    app: &tauri::AppHandle,
    project_directory: &Path,
    preview: &DeliveryCreationPreview,
) {
    let results = publish_from_delivery_preview(app, project_directory, preview);
    if !results.is_empty() {
        emit_results(
            app,
            &preview.client_id,
            &preview.project_id,
            preview.approved_revision,
            results,
        );
    }
}

#[tauri::command]
pub(crate) fn republish_delivered_listening(
    app: tauri::AppHandle,
    request: DeliveryStatusRequest,
) -> Result<Vec<ListeningPublishResult>, String> {
    let workspace_root = resolve_workspace_root(&app)?;
    let snapshot = workspace::discover_workspace_at(&workspace_root);
    let client_id = request.client_id.trim();
    let project_id = request.project_id.trim();
    let project = super::find_project_summary(&snapshot, client_id, project_id)
        .ok_or_else(|| "The selected project is no longer available".to_owned())?;
    let delivery = project
        .delivery
        .as_ref()
        .ok_or_else(|| "Create a delivery package before republishing Delivered Listening".to_owned())?;
    let project_directory = validated_project_directory(
        &workspace_root,
        &snapshot,
        client_id,
        project_id,
    )
    .ok_or_else(|| "The selected project directory could not be resolved safely".to_owned())?;

    let results = publish_from_delivery_package(
        &app,
        &project_directory,
        delivery.revision,
        &delivery.files,
    );
    if !results.is_empty() {
        emit_results(
            &app,
            client_id,
            project_id,
            delivery.revision,
            results.clone(),
        );
    }
    Ok(results)
}

fn emit_results(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
    revision: u32,
    results: Vec<ListeningPublishResult>,
) {
    let _ = app.emit(
        PUBLISH_EVENT,
        DeliveredListeningPublishEvent {
            client_id: client_id.to_owned(),
            project_id: project_id.to_owned(),
            revision,
            results,
        },
    );
}

fn delivered_destinations(app: &tauri::AppHandle) -> Result<Vec<ListeningDestination>, String> {
    listening_configuration(app).map(|configuration| {
        configuration
            .destinations
            .into_iter()
            .filter(|destination| {
                destination.enabled
                    && destination.publish_class == ListeningPublishClass::DeliveredListening
            })
            .collect()
    })
}

fn publish_from_delivery_preview(
    app: &tauri::AppHandle,
    project_directory: &Path,
    preview: &DeliveryCreationPreview,
) -> Vec<ListeningPublishResult> {
    let destinations = match delivered_destinations(app) {
        Ok(destinations) => destinations,
        Err(message) => return configuration_failure(message),
    };
    if destinations.is_empty() {
        return Vec::new();
    }

    let revision_root = project_directory
        .join("04_Revisions")
        .join(format!("Revision_{:02}", preview.approved_revision));
    destinations
        .iter()
        .map(|destination| {
            let selection = select_preview_main_mix(
                &revision_root,
                &preview.selected,
                &destination.required_extension,
            );
            publish_selection_result(selection, destination)
        })
        .collect()
}

fn publish_from_delivery_package(
    app: &tauri::AppHandle,
    project_directory: &Path,
    _revision: u32,
    files: &[crate::models::DeliveryFile],
) -> Vec<ListeningPublishResult> {
    let destinations = match delivered_destinations(app) {
        Ok(destinations) => destinations,
        Err(message) => return configuration_failure(message),
    };
    if destinations.is_empty() {
        return Vec::new();
    }

    let delivery_root = project_directory.join("05_Final_Delivery");
    destinations
        .iter()
        .map(|destination| {
            let selection = select_package_main_mix(
                &delivery_root,
                files,
                &destination.required_extension,
            );
            publish_selection_result(selection, destination)
        })
        .collect()
}

fn configuration_failure(message: String) -> Vec<ListeningPublishResult> {
    vec![ListeningPublishResult {
        destination_id: "configuration".into(),
        status: ListeningPublishStatus::Failed,
        message,
        selected_source: None,
        destination_path: None,
    }]
}

fn publish_selection_result(
    selection: Result<Option<ListeningSourceSelection>, String>,
    destination: &ListeningDestination,
) -> ListeningPublishResult {
    match selection {
        Ok(selection) => publish_listening_copy(selection.as_ref(), destination, None, true),
        Err(message) => ListeningPublishResult {
            destination_id: destination.id.clone(),
            status: ListeningPublishStatus::Failed,
            message,
            selected_source: None,
            destination_path: Some(destination.path.clone()),
        },
    }
}

fn select_preview_main_mix(
    revision_root: &Path,
    selected: &[PlannedDeliveryFile],
    required_extension: &str,
) -> Result<Option<ListeningSourceSelection>, String> {
    let candidates = selected
        .iter()
        .filter(|file| file.deliverable_type == MAIN_MIX_TYPE)
        .filter(|file| extension_matches(&file.source_name, required_extension))
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        return Ok(None);
    }
    if candidates.len() > 1 {
        return Err(format!(
            "The successful delivery selected multiple main-mix .{} sources; Delivered Listening will not guess",
            normalized_extension(required_extension)?
        ));
    }

    let source = resolve_delivery_source_name(revision_root, &candidates[0].source_name)?;
    selection_for_file(source, true).map(Some)
}

fn select_package_main_mix(
    delivery_root: &Path,
    files: &[crate::models::DeliveryFile],
    required_extension: &str,
) -> Result<Option<ListeningSourceSelection>, String> {
    let candidates = files
        .iter()
        .filter(|file| file.deliverable_type == MAIN_MIX_TYPE)
        .filter(|file| extension_matches(&file.path, required_extension))
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        return Ok(None);
    }
    if candidates.len() > 1 {
        return Err(format!(
            "The current delivery contains multiple main-mix .{} files; Delivered Listening will not guess",
            normalized_extension(required_extension)?
        ));
    }

    let source = safe_relative_file(delivery_root, &candidates[0].path)?;
    selection_for_file(source, true).map(Some)
}

fn resolve_delivery_source_name(revision_root: &Path, source_name: &str) -> Result<PathBuf, String> {
    let source_name = portable_file_name(source_name)?;
    let root_candidate = revision_root.join(&source_name);
    let variants_candidate = revision_root.join("Variants").join(&source_name);
    let root_exists = regular_file(&root_candidate);
    let variants_exists = regular_file(&variants_candidate);
    match (root_exists, variants_exists) {
        (true, false) => Ok(root_candidate),
        (false, true) => Ok(variants_candidate),
        (true, true) => Err(format!(
            "The delivered source '{source_name}' exists in both the revision root and Variants; Delivered Listening will not guess"
        )),
        (false, false) => Err(format!(
            "The main-mix source selected by the successful delivery is no longer available: {source_name}"
        )),
    }
}

fn safe_relative_file(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let value = relative.trim();
    if value.is_empty() || value.starts_with('/') || value.contains('\\') {
        return Err("The delivery manifest contains an unsafe main-mix path".into());
    }
    if value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return Err("The delivery manifest contains an unsafe main-mix path".into());
    }
    let path = root.join(value);
    if !regular_file(&path) {
        return Err("The current delivered main-mix file is unavailable or unsafe".into());
    }
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the delivery folder: {error}"))?;
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the delivered main-mix file: {error}"))?;
    if !canonical.starts_with(&canonical_root) {
        return Err("The delivered main-mix file resolves outside the delivery folder".into());
    }
    Ok(canonical)
}

fn portable_file_name(value: &str) -> Result<String, String> {
    let name = value.trim();
    if name.is_empty()
        || Path::new(name).components().count() != 1
        || name.contains('/')
        || name.contains('\\')
    {
        return Err("The successful delivery returned an unsafe main-mix source name".into());
    }
    Ok(name.to_owned())
}

fn normalized_extension(value: &str) -> Result<String, String> {
    let extension = value.trim().trim_start_matches('.');
    if extension.is_empty()
        || extension.contains('/')
        || extension.contains('\\')
        || extension.contains('.')
    {
        return Err("Listening format must be a single file extension".into());
    }
    Ok(extension.to_ascii_lowercase())
}

fn extension_matches(path: &str, required_extension: &str) -> bool {
    let Ok(extension) = normalized_extension(required_extension) else {
        return false;
    };
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(&extension))
}

fn regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .is_ok_and(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
}

fn selection_for_file(path: PathBuf, explicit_override: bool) -> Result<ListeningSourceSelection, String> {
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Unable to inspect the Delivered Listening source: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Delivered Listening source must be a regular file".into());
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("Delivered Listening source filename must be valid UTF-8")?
        .to_owned();
    let modified_at_ms = metadata
        .modified()
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    Ok(ListeningSourceSelection {
        path,
        file_name,
        modified_at_ms,
        explicit_override,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn planned(source_name: &str, deliverable_type: &str) -> PlannedDeliveryFile {
        PlannedDeliveryFile {
            source_name: source_name.into(),
            deliverable_type: deliverable_type.into(),
            path: source_name.into(),
        }
    }

    fn delivered(path: &str, deliverable_type: &str) -> crate::models::DeliveryFile {
        crate::models::DeliveryFile {
            path: path.into(),
            deliverable_type: deliverable_type.into(),
            size_bytes: 1,
            sha256: "hash".into(),
        }
    }

    #[test]
    fn successful_preview_uses_exact_selected_main_mix() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Selected.wav"), b"selected").expect("selected");
        fs::write(temp.path().join("Newer.wav"), b"newer").expect("newer");

        let selection = select_preview_main_mix(
            temp.path(),
            &[planned("Selected.wav", MAIN_MIX_TYPE)],
            "wav",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.file_name, "Selected.wav");
        assert!(selection.explicit_override);
    }

    #[test]
    fn successful_preview_can_reuse_explicit_variant_selected_by_delivery() {
        let temp = tempdir().expect("tempdir");
        let variants = temp.path().join("Variants");
        fs::create_dir(&variants).expect("variants");
        fs::write(variants.join("Instrumental.mp3"), b"variant").expect("variant");

        let selection = select_preview_main_mix(
            temp.path(),
            &[planned("Instrumental.mp3", MAIN_MIX_TYPE)],
            "mp3",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.path, variants.join("Instrumental.mp3"));
    }

    #[test]
    fn successful_preview_never_falls_back_when_required_format_was_not_delivered() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Mix.wav"), b"wave").expect("wave");
        assert!(select_preview_main_mix(
            temp.path(),
            &[planned("Mix.wav", MAIN_MIX_TYPE)],
            "mp3",
        )
        .expect("selection")
        .is_none());
    }

    #[test]
    fn ambiguous_selected_main_mix_fails_instead_of_guessing() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Mix A.wav"), b"a").expect("a");
        fs::write(temp.path().join("Mix B.wav"), b"b").expect("b");
        let error = select_preview_main_mix(
            temp.path(),
            &[
                planned("Mix A.wav", MAIN_MIX_TYPE),
                planned("Mix B.wav", MAIN_MIX_TYPE),
            ],
            "wav",
        )
        .expect_err("ambiguous");
        assert!(error.contains("multiple main-mix"));
    }

    #[test]
    fn manual_republish_uses_current_delivery_main_mix() {
        let temp = tempdir().expect("tempdir");
        fs::create_dir_all(temp.path().join("Stems")).expect("stems");
        fs::write(temp.path().join("Final.mp3"), b"final").expect("final");
        fs::write(temp.path().join("Stems/Vocal.mp3"), b"stem").expect("stem");
        let selection = select_package_main_mix(
            temp.path(),
            &[
                delivered("Final.mp3", MAIN_MIX_TYPE),
                delivered("Stems/Vocal.mp3", "stem"),
            ],
            "mp3",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.file_name, "Final.mp3");
    }

    #[test]
    fn source_name_resolution_rejects_root_variant_ambiguity() {
        let temp = tempdir().expect("tempdir");
        let variants = temp.path().join("Variants");
        fs::create_dir(&variants).expect("variants");
        fs::write(temp.path().join("Mix.wav"), b"root").expect("root");
        fs::write(variants.join("Mix.wav"), b"variant").expect("variant");
        assert!(resolve_delivery_source_name(temp.path(), "Mix.wav").is_err());
    }
}
