use super::listening_artwork::ensure_artist_artwork_sidecars;
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

    let results = reconcile_from_delivery_package(
        &app,
        &project_directory,
        client_id,
        project_id,
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
        .filter_map(|destination| {
            let selection = select_preview_main_mix(
                &revision_root,
                &preview.selected,
                &destination.required_extension,
            );
            publish_selection_result(
                selection,
                destination,
                &preview.client_id,
                &preview.project_id,
            )
        })
        .collect()
}

fn reconcile_from_delivery_package(
    app: &tauri::AppHandle,
    project_directory: &Path,
    client_id: &str,
    project_id: &str,
    revision: u32,
    files: &[crate::models::DeliveryFile],
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
        .join(format!("Revision_{revision:02}"));
    let delivery_root = project_directory.join("05_Final_Delivery");
    destinations
        .iter()
        .filter_map(|destination| {
            let selection = select_package_main_mix(
                &revision_root,
                &delivery_root,
                files,
                &destination.required_extension,
            );
            reconcile_selection_result(selection, destination, client_id, project_id)
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
    client_id: &str,
    project_id: &str,
) -> Option<ListeningPublishResult> {
    match selection {
        Ok(None) => None,
        Ok(Some(selection)) => {
            let scoped_destination = match client_scoped_destination(destination, client_id) {
                Ok(destination) => destination,
                Err(message) => {
                    return Some(ListeningPublishResult {
                        destination_id: destination.id.clone(),
                        status: ListeningPublishStatus::Failed,
                        message,
                        selected_source: Some(selection.path.to_string_lossy().into_owned()),
                        destination_path: Some(
                            PathBuf::from(&destination.path)
                                .join(client_id)
                                .to_string_lossy()
                                .into_owned(),
                        ),
                    })
                }
            };
            let target_name =
                match delivered_target_name(project_id, &destination.required_extension) {
                    Ok(name) => name,
                    Err(message) => {
                        return Some(ListeningPublishResult {
                            destination_id: destination.id.clone(),
                            status: ListeningPublishStatus::Failed,
                            message,
                            selected_source: Some(selection.path.to_string_lossy().into_owned()),
                            destination_path: Some(scoped_destination.path.clone()),
                        })
                    }
                };
            Some(publish_listening_copy(
                Some(&selection),
                &scoped_destination,
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
    client_id: &str,
    project_id: &str,
) -> Option<ListeningPublishResult> {
    match selection {
        Ok(None) => None,
        Ok(Some(selection)) => {
            let scoped_destination = match client_scoped_destination(destination, client_id) {
                Ok(destination) => destination,
                Err(message) => {
                    return Some(ListeningPublishResult {
                        destination_id: destination.id.clone(),
                        status: ListeningPublishStatus::Failed,
                        message,
                        selected_source: Some(selection.path.to_string_lossy().into_owned()),
                        destination_path: Some(
                            PathBuf::from(&destination.path)
                                .join(client_id)
                                .to_string_lossy()
                                .into_owned(),
                        ),
                    })
                }
            };
            let target_name =
                match delivered_target_name(project_id, &destination.required_extension) {
                    Ok(name) => name,
                    Err(message) => {
                        return Some(ListeningPublishResult {
                            destination_id: destination.id.clone(),
                            status: ListeningPublishStatus::Failed,
                            message,
                            selected_source: Some(selection.path.to_string_lossy().into_owned()),
                            destination_path: Some(scoped_destination.path.clone()),
                        })
                    }
                };
            match listening_target_is_current(&selection, &scoped_destination, &target_name) {
                Ok(true) => None,
                Ok(false) => Some(publish_listening_copy(
                    Some(&selection),
                    &scoped_destination,
                    Some(&target_name),
                    true,
                )),
                Err(message) => Some(ListeningPublishResult {
                    destination_id: destination.id.clone(),
                    status: ListeningPublishStatus::Failed,
                    message,
                    selected_source: Some(selection.path.to_string_lossy().into_owned()),
                    destination_path: Some(
                        PathBuf::from(&scoped_destination.path)
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

fn portable_component(value: &str, label: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty()
        || value == "."
        || value == ".."
        || value.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        || value.ends_with('.')
        || value.ends_with(' ')
    {
        return Err(format!(
            "The {label} cannot be used as a portable Listening folder or filename"
        ));
    }
    Ok(value.to_owned())
}

fn client_scoped_destination(
    destination: &ListeningDestination,
    client_id: &str,
) -> Result<ListeningDestination, String> {
    let client_id = portable_component(client_id, "client id")?;
    let client_root = PathBuf::from(&destination.path).join(client_id);
    fs::create_dir_all(&client_root)
        .map_err(|error| format!("Unable to create the Listening client folder: {error}"))?;
    ensure_artist_artwork_sidecars(&client_root, destination.artwork_policy)
        .map_err(|error| format!("Unable to reconcile Listening artist artwork: {error}"))?;
    let mut scoped = destination.clone();
    scoped.path = client_root.to_string_lossy().into_owned();
    Ok(scoped)
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
    let project_id = portable_component(project_id, "project id")?;
    Ok(format!(
        "{project_id}.{}",
        normalized_extension(required_extension)?
    ))
}

fn select_revision_primary(
    revision_root: &Path,
    required_extension: &str,
) -> Result<Option<ListeningSourceSelection>, String> {
    super::project_revision_files::select_listening_source(revision_root, required_extension, None)
}

fn select_preview_main_mix(
    revision_root: &Path,
    selected: &[PlannedDeliveryFile],
    required_extension: &str,
) -> Result<Option<ListeningSourceSelection>, String> {
    let Some(primary) = select_revision_primary(revision_root, required_extension)? else {
        return Ok(None);
    };

    let packaged = selected
        .iter()
        .filter(|file| extension_matches(&file.source_name, required_extension))
        .filter(|file| file.source_name == primary.file_name)
        .count();
    if packaged == 0 {
        return Ok(None);
    }
    if packaged > 1 {
        return Err(format!(
            "The successful delivery selected the primary .{} source more than once; Delivered Listening will not guess",
            normalized_extension(required_extension)?
        ));
    }
    Ok(Some(primary))
}

fn validate_source_path(source_path: &str) -> Result<&str, String> {
    let value = source_path.trim();
    if value.is_empty() || value.starts_with('/') || value.contains('\\') {
        return Err("The delivery manifest contains an unsafe revision source path".into());
    }
    if value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return Err("The delivery manifest contains an unsafe revision source path".into());
    }
    Ok(value)
}

fn select_package_main_mix(
    revision_root: &Path,
    delivery_root: &Path,
    files: &[crate::models::DeliveryFile],
    required_extension: &str,
) -> Result<Option<ListeningSourceSelection>, String> {
    // New delivery manifests map every packaged file back to its immutable revision source.
    // Determine the primary source with the same selector used by Revision Listening, then map
    // that exact source through the manifest to the packaged delivery copy.
    if files.iter().any(|file| file.source_path.is_some()) {
        let Some(primary) = select_revision_primary(revision_root, required_extension)? else {
            return Ok(None);
        };
        let mut candidates = Vec::new();
        for file in files {
            let Some(source_path) = file.source_path.as_deref() else {
                continue;
            };
            let source_path = validate_source_path(source_path)?;
            if source_path == primary.file_name && extension_matches(&file.path, required_extension)
            {
                candidates.push(file);
            }
        }
        if candidates.is_empty() {
            return Ok(None);
        }
        if candidates.len() > 1 {
            return Err(format!(
                "The current delivery contains the selected primary .{} source more than once; Delivered Listening will not guess",
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
    fn successful_preview_uses_revision_primary_when_it_was_packaged() {
        let temp = tempdir().expect("tempdir");
        fs::write(temp.path().join("Selected.wav"), b"selected").expect("selected");
        fs::write(temp.path().join("Z-Newer.wav"), b"newer").expect("newer");

        let selection = select_preview_main_mix(
            temp.path(),
            &[
                planned("Selected.wav", "unclassified"),
                planned("Z-Newer.wav", "unclassified"),
            ],
            "wav",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.file_name, "Z-Newer.wav");
        assert!(!selection.explicit_override);
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
    fn recovery_maps_deterministic_revision_primary_through_provenance() {
        let project = tempdir().expect("project");
        let revision = project.path().join("Revision_01");
        let delivery = project.path().join("Delivery");
        fs::create_dir(&revision).expect("revision");
        fs::create_dir(&delivery).expect("delivery");
        fs::write(revision.join("A.mp3"), b"a").expect("a revision");
        fs::write(revision.join("Z.mp3"), b"z").expect("z revision");
        fs::write(delivery.join("A.mp3"), b"a").expect("a delivery");
        fs::write(delivery.join("Z.mp3"), b"z").expect("z delivery");

        let selection = select_package_main_mix(
            &revision,
            &delivery,
            &[
                delivered_with_source("A.mp3", "A.mp3", "unclassified"),
                delivered_with_source("Z.mp3", "Z.mp3", "unclassified"),
            ],
            "mp3",
        )
        .expect("selection")
        .expect("source");
        assert_eq!(selection.file_name, "Z.mp3");
    }

    #[test]
    fn recovery_is_quiet_when_revision_primary_was_not_packaged() {
        let project = tempdir().expect("project");
        let revision = project.path().join("Revision_01");
        let delivery = project.path().join("Delivery");
        fs::create_dir(&revision).expect("revision");
        fs::create_dir(&delivery).expect("delivery");
        fs::write(revision.join("A.mp3"), b"a").expect("a revision");
        fs::write(revision.join("Z.mp3"), b"z").expect("z revision");
        fs::write(delivery.join("A.mp3"), b"a").expect("a delivery");

        assert!(select_package_main_mix(
            &revision,
            &delivery,
            &[delivered_with_source("A.mp3", "A.mp3", "unclassified")],
            "mp3",
        )
        .expect("selection")
        .is_none());
    }

    #[test]
    fn recovery_uses_current_delivery_main_mix_for_legacy_manifest() {
        let temp = tempdir().expect("tempdir");
        fs::create_dir_all(temp.path().join("Stems")).expect("stems");
        fs::write(temp.path().join("Final.mp3"), b"final").expect("final");
        fs::write(temp.path().join("Stems/Vocal.mp3"), b"stem").expect("stem");
        let selection = select_package_main_mix(
            temp.path(),
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
    fn delivered_target_uses_client_folder_and_omits_revision_suffix() {
        let temp = tempdir().expect("tempdir");
        let destination = destination(temp.path(), "mp3");
        let scoped = client_scoped_destination(&destination, "roman-styx").expect("scope");
        let target = PathBuf::from(&scoped.path)
            .join(delivered_target_name("7-feel", "mp3").expect("target"));
        assert_eq!(target, temp.path().join("roman-styx").join("7-feel.mp3"));
        assert!(!target.to_string_lossy().contains("-rev-"));
        assert!(temp.path().join("roman-styx").join("artist.png").is_file());
        assert!(temp.path().join("roman-styx").join("folder.png").is_file());
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
}
