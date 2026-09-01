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

// Kept as the Tauri command name for compatibility with the current frontend bridge.
// The operation is reconciliation: current Listening copies are left untouched.
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
    let Some(delivery) = project.delivery.as_ref() else {
        return Ok(Vec::new());
    };
    let project_directory =
        validated_project_directory(&workspace_root, &snapshot, client_id, project_id).ok_or_else(
            || "The selected project directory could not be resolved safely".to_owned(),
        )?;

    let results =
        reconcile_from_delivery_package(&app, &project_directory, project_id, &delivery.files);
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
        .filter_map(|destination| {
            let selection = select_preview_main_mix(
                &revision_root,
                &preview.selected,
                &destination.required_extension,
            );
            publish_selection_result(selection, destination, &preview.project_id)
        })
        .collect()
}

fn reconcile_from_delivery_package(
    app: &tauri::AppHandle,
    project_directory: &Path,
    project_id: &str,
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
        .filter_map(|destination| {
            let selection =
                select_package_main_mix(&delivery_root, files, &destination.required_extension);
            reconcile_selection_result(selection, destination, project_id)
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
    project_id: &str,
) -> Option<ListeningPublishResult> {
    match selection {
        Ok(None) => None,
        Ok(Some(selection)) => {
            let target_name =
                match delivered_target_name(project_id, &destination.required_extension) {
                    Ok(name) => name,
                    Err(message) => {
                        return Some(ListeningPublishResult {
                            destination_id: destination.id.clone(),
                            status: ListeningPublishStatus::Failed,
                            message,
                            selected_source: Some(selection.path.to_string_lossy().into_owned()),
                            destination_path: Some(destination.path.clone()),
                        })
                    }
                };
            Some(publish_listening_copy(
                Some(&selection),
                destination,
                Some(&target_name),
                true,
            ))
        }
        Err(message) => Some(ListeningPublishResult {
            destination_id: destination.id.clone(),
            status: ListeningPublishStatus::Failed,
            message,
            selected_source: None,
            destination_path: Some(destination.path.clone()),
        }),
    }
}

fn reconcile_selection_result(
    selection: Result<Option<ListeningSourceSelection>, String>,
    destination: &ListeningDestination,
    project_id: &str,
) -> Option<ListeningPublishResult> {
    match selection {
        Ok(None) => None,
        Ok(Some(selection)) => {
            let target_name =
                match delivered_target_name(project_id, &destination.required_extension) {
                    Ok(name) => name,
                    Err(message) => {
                        return Some(ListeningPublishResult {
                            destination_id: destination.id.clone(),
                            status: ListeningPublishStatus::Failed,
                            message,
                            selected_source: Some(selection.path.to_string_lossy().into_owned()),
                            destination_path: Some(destination.path.clone()),
                        })
                    }
                };
            match listening_target_is_current(&selection, destination, &target_name) {
                Ok(true) => None,
                Ok(false) => Some(publish_listening_copy(
                    Some(&selection),
                    destination,
                    Some(&target_name),
                    true,
                )),
                Err(message) => Some(ListeningPublishResult {
                    destination_id: destination.id.clone(),
                    status: ListeningPublishStatus::Failed,
                    message,
                    selected_source: Some(selection.path.to_string_lossy().into_owned()),
                    destination_path: Some(
                        PathBuf::from(&destination.path)
                            .join(&target_name)
                            .to_string_lossy()
                            .into_owned(),
                    ),
                }),
            }
        }
        Err(message) => Some(ListeningPublishResult {
            destination_id: destination.id.clone(),
            status: ListeningPublishStatus::Failed,
            message,
            selected_source: None,
            destination_path: Some(destination.path.clone()),
        }),
    }
}

fn listening_target_is_current(
    selection: &ListeningSourceSelection,
    destination: &ListeningDestination,
    target_name: &str,
) -> Result<bool, String> {
    let target = PathBuf::from(&destination.path).join(target_name);
    let target_metadata = match fs::symlink_metadata(&target) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => {
            return Err(format!(
                "Unable to inspect the Delivered Listening destination: {error}"
            ))
        }
    };
    if target_metadata.file_type().is_symlink() || !target_metadata.is_file() {
        return Ok(false);
    }

    let source_metadata = fs::symlink_metadata(&selection.path)
        .map_err(|error| format!("Unable to inspect the Delivered Listening source: {error}"))?;
    if source_metadata.file_type().is_symlink() || !source_metadata.is_file() {
        return Err("Delivered Listening source must be a regular file".into());
    }

    let source_modified = source_metadata.modified().map_err(|error| {
        format!("Unable to read the Delivered Listening source timestamp: {error}")
    })?;
    let target_modified = target_metadata.modified().map_err(|error| {
        format!("Unable to read the Delivered Listening destination timestamp: {error}")
    })?;
    Ok(target_modified >= source_modified)
}

fn delivered_target_name(project_id: &str, required_extension: &str) -> Result<String, String> {
    let project_id = project_id.trim();
    if project_id.is_empty()
        || project_id.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        || project_id.ends_with('.')
        || project_id.ends_with(' ')
    {
        return Err(
            "The project id cannot be used as a portable Delivered Listening filename".into(),
        );
    }
    Ok(format!(
        "{project_id}.{}",
        normalized_extension(required_extension)?
    ))
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

fn source_path_is_primary(source_path: &str) -> Result<bool, String> {
    let value = source_path.trim();
    if value.is_empty() || value.starts_with('/') || value.contains('\\') {
        return Err("The delivery manifest contains an unsafe revision source path".into());
    }
    let parts = value.split('/').collect::<Vec<_>>();
    if parts
        .iter()
        .any(|component| component.is_empty() || *component == "." || *component == "..")
    {
        return Err("The delivery manifest contains an unsafe revision source path".into());
    }
    Ok(parts.len() == 1)
}

fn select_package_main_mix(
    delivery_root: &Path,
    files: &[crate::models::DeliveryFile],
    required_extension: &str,
) -> Result<Option<ListeningSourceSelection>, String> {
    // New delivery manifests persist the exact revision-relative source path for every file.
    // A source at the revision root is authoritative primary-mix provenance; Variants are not.
    // If any provenance is present, use it instead of filename classification or delivery layout.
    if files.iter().any(|file| file.source_path.is_some()) {
        let mut candidates = Vec::new();
        for file in files {
            let Some(source_path) = file.source_path.as_deref() else {
                continue;
            };
            if source_path_is_primary(source_path)?
                && extension_matches(&file.path, required_extension)
            {
                candidates.push(file);
            }
        }
        if candidates.is_empty() {
            return Ok(None);
        }
        if candidates.len() > 1 {
            return Err(format!(
                "The delivered revision contains multiple primary .{} files; Delivered Listening will not guess",
                normalized_extension(required_extension)?
            ));
        }
        let source = safe_relative_file(delivery_root, &candidates[0].path)?;
        return selection_for_file(source, true).map(Some);
    }

    // Legacy delivery manifests do not contain source provenance. Prefer their historical
    // main_mix classification, then conservatively fall back to one top-level matching file.
    let classified = files
        .iter()
        .filter(|file| file.deliverable_type == MAIN_MIX_TYPE)
        .filter(|file| extension_matches(&file.path, required_extension))
        .collect::<Vec<_>>();
    if classified.len() > 1 {
        return Err(format!(
            "The current delivery contains multiple main-mix .{} files; Delivered Listening will not guess",
            normalized_extension(required_extension)?
        ));
    }

    let candidate = if let Some(candidate) = classified.first() {
        *candidate
    } else {
        let top_level = files
            .iter()
            .filter(|file| !file.path.contains('/') && !file.path.contains('\\'))
            .filter(|file| extension_matches(&file.path, required_extension))
            .collect::<Vec<_>>();
        if top_level.is_empty() {
            return Ok(None);
        }
        if top_level.len() > 1 {
            return Err(format!(
                "The current delivery contains multiple top-level .{} files without source provenance; Delivered Listening will not guess",
                normalized_extension(required_extension)?
            ));
        }
        top_level[0]
    };

    let source = safe_relative_file(delivery_root, &candidate.path)?;
    selection_for_file(source, true).map(Some)
}

fn resolve_delivery_source_name(
    revision_root: &Path,
    source_name: &str,
) -> Result<PathBuf, String> {
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

fn selection_for_file(
    path: PathBuf,
    explicit_override: bool,
) -> Result<ListeningSourceSelection, String> {
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
    use crate::models::{ListeningArtworkPolicy, ListeningMetadataPolicy};
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
            source_path: None,
            deliverable_type: deliverable_type.into(),
            size_bytes: 1,
            sha256: "hash".into(),
        }
    }

    fn delivered_with_source(
        path: &str,
        source_path: &str,
        deliverable_type: &str,
    ) -> crate::models::DeliveryFile {
        crate::models::DeliveryFile {
            path: path.into(),
            source_path: Some(source_path.into()),
            deliverable_type: deliverable_type.into(),
            size_bytes: 1,
            sha256: "hash".into(),
        }
    }

    fn destination(path: &Path, extension: &str) -> ListeningDestination {
        ListeningDestination {
            id: "delivered-test".into(),
            name: "Delivered Test".into(),
            enabled: true,
            publish_class: ListeningPublishClass::DeliveredListening,
            path: path.to_string_lossy().into_owned(),
            required_extension: extension.into(),
            metadata_policy: ListeningMetadataPolicy::Replace,
            artwork_policy: ListeningArtworkPolicy::ReplaceWithStudioArtwork,
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
    fn missing_required_format_is_quiet() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Mix.wav"), b"wave").expect("wave");
        assert!(
            select_preview_main_mix(temp.path(), &[planned("Mix.wav", MAIN_MIX_TYPE)], "mp3")
                .expect("selection")
                .is_none()
        );
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
    fn recovery_uses_authoritative_revision_source_provenance() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Primary.mp3"), b"primary").expect("primary");
        fs::write(temp.path().join("Alt.mp3"), b"variant").expect("variant");
        let selection = select_package_main_mix(
            temp.path(),
            &[
                delivered_with_source("Primary.mp3", "Primary.mp3", "unclassified"),
                delivered_with_source("Alt.mp3", "Variants/Alt.mp3", MAIN_MIX_TYPE),
            ],
            "mp3",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.file_name, "Primary.mp3");
    }

    #[test]
    fn recovery_rejects_multiple_primary_sources_for_one_format() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Mix A.mp3"), b"a").expect("a");
        fs::write(temp.path().join("Mix B.mp3"), b"b").expect("b");
        let error = select_package_main_mix(
            temp.path(),
            &[
                delivered_with_source("Mix A.mp3", "Mix A.mp3", "unclassified"),
                delivered_with_source("Mix B.mp3", "Mix B.mp3", "unclassified"),
            ],
            "mp3",
        )
        .expect_err("ambiguous");
        assert!(error.contains("multiple primary"));
    }

    #[test]
    fn recovery_uses_current_delivery_main_mix_for_legacy_manifest() {
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
    fn recovery_uses_single_unclassified_top_level_file_for_legacy_manifest() {
        let temp = tempdir().expect("tempdir");
        fs::create_dir_all(temp.path().join("Stems")).expect("stems");
        fs::write(temp.path().join("Final.mp3"), b"final").expect("final");
        fs::write(temp.path().join("Stems/Vocal.mp3"), b"stem").expect("stem");
        let selection = select_package_main_mix(
            temp.path(),
            &[
                delivered("Final.mp3", "unclassified"),
                delivered("Stems/Vocal.mp3", "unclassified"),
            ],
            "mp3",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.file_name, "Final.mp3");
    }

    #[test]
    fn recovery_does_not_guess_between_unclassified_legacy_files() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Mix A.mp3"), b"a").expect("a");
        fs::write(temp.path().join("Mix B.mp3"), b"b").expect("b");
        let error = select_package_main_mix(
            temp.path(),
            &[
                delivered("Mix A.mp3", "unclassified"),
                delivered("Mix B.mp3", "unclassified"),
            ],
            "mp3",
        )
        .expect_err("ambiguous");
        assert!(error.contains("multiple top-level"));
    }

    #[test]
    fn delivered_target_is_stable_across_redelivery_source_names() {
        assert_eq!(
            delivered_target_name("blue-sky", "WAV").as_deref(),
            Ok("blue-sky.wav")
        );
        assert_eq!(
            delivered_target_name("blue-sky", ".wav").as_deref(),
            Ok("blue-sky.wav")
        );
    }

    #[test]
    fn current_target_is_left_untouched() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("source.mp3");
        fs::write(&source, b"source").expect("source");
        let target = temp.path().join("blue-sky.mp3");
        fs::write(&target, b"target").expect("target");
        let selection = selection_for_file(source, true).expect("selection");
        let destination = destination(temp.path(), "mp3");
        assert!(
            listening_target_is_current(&selection, &destination, "blue-sky.mp3").expect("current")
        );
    }

    #[test]
    fn missing_target_requires_reconciliation() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("source.mp3");
        fs::write(&source, b"source").expect("source");
        let selection = selection_for_file(source, true).expect("selection");
        let destination = destination(temp.path(), "mp3");
        assert!(
            !listening_target_is_current(&selection, &destination, "blue-sky.mp3")
                .expect("missing")
        );
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
