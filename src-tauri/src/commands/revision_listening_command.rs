use super::{
    find_project_summary, listening_configuration, publish_listening_copy, resolve_workspace_root,
    validated_project_directory,
};
use crate::models::{
    ListeningDestination, ListeningPublishClass, ListeningPublishResult, ListeningPublishStatus,
};
use crate::workspace;
use serde::{Deserialize, Serialize};
use std::collections::{hash_map::Entry, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

const SCAN_INTERVAL: Duration = Duration::from_secs(1);
const STABLE_SAMPLE_COUNT: u8 = 3;
const FAILED_RETRY_SCANS: u64 = 10;
const PUBLISH_EVENT: &str = "revision-listening-publish-results";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RevisionListeningProjectRequest {
    pub client_id: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RevisionListeningPublishEvent {
    client_id: String,
    project_id: String,
    revision: u32,
    results: Vec<ListeningPublishResult>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ActiveProject {
    client_id: String,
    project_id: String,
}

struct RevisionPublishContext<'a> {
    client_id: &'a str,
    project_id: &'a str,
    revision: u32,
    revision_root: &'a Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SourceFingerprint {
    path: PathBuf,
    size: u64,
    modified_at_ms: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ObservedSource {
    Missing,
    Candidate(SourceFingerprint),
}

#[derive(Debug, Clone)]
struct DestinationObservation {
    source: ObservedSource,
    stable_samples: u8,
    published: Option<SourceFingerprint>,
    last_attempt: Option<(SourceFingerprint, u64)>,
}

impl DestinationObservation {
    fn missing() -> Self {
        Self {
            source: ObservedSource::Missing,
            stable_samples: 0,
            published: None,
            last_attempt: None,
        }
    }

    fn candidate(fingerprint: SourceFingerprint) -> Self {
        Self {
            source: ObservedSource::Candidate(fingerprint),
            stable_samples: 1,
            published: None,
            last_attempt: None,
        }
    }
}

#[derive(Default)]
struct MonitorData {
    active_project: Option<ActiveProject>,
    generation: u64,
    scan_number: u64,
    destinations: HashMap<String, DestinationObservation>,
}

#[derive(Default)]
pub(crate) struct RevisionListeningMonitorState {
    inner: Mutex<MonitorData>,
}

#[tauri::command]
pub(crate) fn set_revision_listening_project(
    state: tauri::State<'_, RevisionListeningMonitorState>,
    request: Option<RevisionListeningProjectRequest>,
) -> Result<(), String> {
    let next = request
        .map(|request| ActiveProject {
            client_id: request.client_id.trim().to_owned(),
            project_id: request.project_id.trim().to_owned(),
        })
        .filter(|project| !project.client_id.is_empty() && !project.project_id.is_empty());

    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.active_project != next {
        monitor.active_project = next;
        monitor.generation = monitor.generation.wrapping_add(1);
        monitor.scan_number = 0;
        monitor.destinations.clear();
    }
    Ok(())
}

pub(crate) fn start_revision_listening_monitor(app: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(SCAN_INTERVAL);
        let _ = scan_active_revision(&app);
    });
}

fn scan_active_revision(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<RevisionListeningMonitorState>();
    let (active, generation, scan_number) = {
        let mut monitor = state
            .inner
            .lock()
            .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
        let Some(active) = monitor.active_project.clone() else {
            return Ok(());
        };
        monitor.scan_number = monitor.scan_number.wrapping_add(1);
        (active, monitor.generation, monitor.scan_number)
    };

    let configuration = listening_configuration(app)?;
    let destinations = configuration
        .destinations
        .into_iter()
        .filter(|destination| {
            destination.enabled
                && destination.publish_class == ListeningPublishClass::RevisionListening
        })
        .collect::<Vec<_>>();
    if destinations.is_empty() {
        clear_stale_destinations(&state, generation, &[])?;
        return Ok(());
    }

    let workspace_root = resolve_workspace_root(app)?;
    let snapshot = workspace::discover_workspace_at(&workspace_root);
    let project = find_project_summary(&snapshot, &active.client_id, &active.project_id)
        .ok_or_else(|| "The active Revision Listening project is no longer available".to_owned())?;
    let revision = project.current_revision;
    let project_directory = validated_project_directory(
        &workspace_root,
        &snapshot,
        &active.client_id,
        &active.project_id,
    )
    .ok_or_else(|| {
        "The active Revision Listening project could not be resolved safely".to_owned()
    })?;
    let revision_root = project_directory
        .join("04_Revisions")
        .join(format!("Revision_{revision:02}"));
    let context = RevisionPublishContext {
        client_id: &active.client_id,
        project_id: &active.project_id,
        revision,
        revision_root: &revision_root,
    };

    let destination_ids = destinations
        .iter()
        .map(|destination| destination.id.clone())
        .collect::<Vec<_>>();
    clear_stale_destinations(&state, generation, &destination_ids)?;

    let mut results = Vec::new();
    for destination in destinations {
        if !generation_is_current(&state, generation)? {
            return Ok(());
        }
        if let Some(result) =
            scan_destination(&state, generation, scan_number, &context, &destination)?
        {
            results.push(result);
        }
    }

    if !results.is_empty() && generation_is_current(&state, generation)? {
        let _ = app.emit(
            PUBLISH_EVENT,
            RevisionListeningPublishEvent {
                client_id: active.client_id,
                project_id: active.project_id,
                revision,
                results,
            },
        );
    }
    Ok(())
}

fn clear_stale_destinations(
    state: &RevisionListeningMonitorState,
    generation: u64,
    current_ids: &[String],
) -> Result<(), String> {
    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.generation != generation {
        return Ok(());
    }
    monitor
        .destinations
        .retain(|destination_id, _| current_ids.contains(destination_id));
    Ok(())
}

fn generation_is_current(
    state: &RevisionListeningMonitorState,
    generation: u64,
) -> Result<bool, String> {
    state
        .inner
        .lock()
        .map(|monitor| monitor.generation == generation && monitor.active_project.is_some())
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())
}

fn scan_destination(
    state: &RevisionListeningMonitorState,
    generation: u64,
    scan_number: u64,
    context: &RevisionPublishContext<'_>,
    destination: &ListeningDestination,
) -> Result<Option<ListeningPublishResult>, String> {
    let selection = match super::project_revision_files::select_listening_source(
        context.revision_root,
        &destination.required_extension,
        None,
    ) {
        Ok(selection) => selection,
        Err(message) => {
            return Ok(Some(ListeningPublishResult {
                destination_id: destination.id.clone(),
                status: ListeningPublishStatus::Failed,
                message,
                selected_source: None,
                destination_path: Some(destination.path.clone()),
            }))
        }
    };

    let Some(selection) = selection else {
        observe_missing(state, generation, &destination.id)?;
        return Ok(None);
    };

    let fingerprint = source_fingerprint(&selection.path)?;
    let should_publish = observe_candidate(
        state,
        generation,
        scan_number,
        &destination.id,
        &fingerprint,
    )?;
    if !should_publish {
        return Ok(None);
    }

    let scoped_destination = match client_scoped_destination(destination, context.client_id) {
        Ok(destination) => destination,
        Err(message) => {
            let result = ListeningPublishResult {
                destination_id: destination.id.clone(),
                status: ListeningPublishStatus::Failed,
                message,
                selected_source: Some(selection.path.to_string_lossy().into_owned()),
                destination_path: Some(
                    PathBuf::from(&destination.path)
                        .join(context.client_id)
                        .to_string_lossy()
                        .into_owned(),
                ),
            };
            record_publish_result(
                state,
                generation,
                scan_number,
                &destination.id,
                &fingerprint,
                result.status,
            )?;
            return Ok(Some(result));
        }
    };
    let target_name = match revision_target_name(
        context.project_id,
        context.revision,
        &destination.required_extension,
    ) {
        Ok(name) => name,
        Err(message) => {
            let result = ListeningPublishResult {
                destination_id: destination.id.clone(),
                status: ListeningPublishStatus::Failed,
                message,
                selected_source: Some(selection.path.to_string_lossy().into_owned()),
                destination_path: Some(scoped_destination.path.clone()),
            };
            record_publish_result(
                state,
                generation,
                scan_number,
                &destination.id,
                &fingerprint,
                result.status,
            )?;
            return Ok(Some(result));
        }
    };
    let result = publish_listening_copy(
        Some(&selection),
        &scoped_destination,
        Some(&target_name),
        true,
    );
    record_publish_result(
        state,
        generation,
        scan_number,
        &destination.id,
        &fingerprint,
        result.status,
    )?;
    Ok(Some(result))
}

fn source_fingerprint(path: &Path) -> Result<SourceFingerprint, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect the Revision Listening source: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Revision Listening source must be a regular file".into());
    }
    let modified_at_ms = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    Ok(SourceFingerprint {
        path: path.to_path_buf(),
        size: metadata.len(),
        modified_at_ms,
    })
}

fn observe_missing(
    state: &RevisionListeningMonitorState,
    generation: u64,
    destination_id: &str,
) -> Result<(), String> {
    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.generation != generation {
        return Ok(());
    }
    let observation = monitor
        .destinations
        .entry(destination_id.to_owned())
        .or_insert_with(DestinationObservation::missing);
    if !matches!(observation.source, ObservedSource::Missing) {
        *observation = DestinationObservation::missing();
    }
    Ok(())
}

fn observe_candidate(
    state: &RevisionListeningMonitorState,
    generation: u64,
    scan_number: u64,
    destination_id: &str,
    fingerprint: &SourceFingerprint,
) -> Result<bool, String> {
    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.generation != generation {
        return Ok(false);
    }

    let observation = match monitor.destinations.entry(destination_id.to_owned()) {
        Entry::Vacant(entry) => {
            entry.insert(DestinationObservation::candidate(fingerprint.clone()))
        }
        Entry::Occupied(entry) => {
            let observation = entry.into_mut();
            match &observation.source {
                ObservedSource::Candidate(current) if current == fingerprint => {
                    observation.stable_samples = observation.stable_samples.saturating_add(1);
                }
                _ => {
                    let published = observation.published.clone();
                    *observation = DestinationObservation::candidate(fingerprint.clone());
                    observation.published = published;
                }
            }
            observation
        }
    };

    if observation.stable_samples < STABLE_SAMPLE_COUNT {
        return Ok(false);
    }
    if observation.published.as_ref() == Some(fingerprint) {
        return Ok(false);
    }
    if observation
        .last_attempt
        .as_ref()
        .is_some_and(|(attempted, attempt_scan)| {
            attempted == fingerprint
                && scan_number.saturating_sub(*attempt_scan) < FAILED_RETRY_SCANS
        })
    {
        return Ok(false);
    }
    Ok(true)
}

fn record_publish_result(
    state: &RevisionListeningMonitorState,
    generation: u64,
    scan_number: u64,
    destination_id: &str,
    fingerprint: &SourceFingerprint,
    status: ListeningPublishStatus,
) -> Result<(), String> {
    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.generation != generation {
        return Ok(());
    }
    let Some(observation) = monitor.destinations.get_mut(destination_id) else {
        return Ok(());
    };
    observation.last_attempt = Some((fingerprint.clone(), scan_number));
    if status == ListeningPublishStatus::Published {
        observation.published = Some(fingerprint.clone());
    }
    Ok(())
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
    let mut scoped = destination.clone();
    scoped.path = client_root.to_string_lossy().into_owned();
    Ok(scoped)
}

fn revision_target_name(
    project_id: &str,
    revision: u32,
    required_extension: &str,
) -> Result<String, String> {
    let project_id = portable_component(project_id, "project id")?;
    let extension = required_extension.trim().trim_start_matches('.');
    if extension.is_empty()
        || extension.contains('/')
        || extension.contains('\\')
        || !extension
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        return Err("The Revision Listening format cannot be used in a filename".into());
    }
    Ok(format!(
        "{project_id}-rev-{revision:02}.{}",
        extension.to_ascii_lowercase()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ListeningArtworkPolicy, ListeningMetadataPolicy};
    use tempfile::tempdir;

    fn state_with_project() -> RevisionListeningMonitorState {
        let state = RevisionListeningMonitorState::default();
        {
            let mut monitor = state.inner.lock().expect("state");
            monitor.active_project = Some(ActiveProject {
                client_id: "client".into(),
                project_id: "project".into(),
            });
            monitor.generation = 1;
        }
        state
    }

    fn fingerprint(path: &Path, size: u64, modified_at_ms: u128) -> SourceFingerprint {
        SourceFingerprint {
            path: path.to_path_buf(),
            size,
            modified_at_ms,
        }
    }

    fn destination(path: &Path) -> ListeningDestination {
        ListeningDestination {
            id: "revision-listening-1".into(),
            name: "Plex Media Server".into(),
            enabled: true,
            publish_class: ListeningPublishClass::RevisionListening,
            path: path.to_string_lossy().into_owned(),
            required_extension: "mp3".into(),
            metadata_policy: ListeningMetadataPolicy::Replace,
            artwork_policy: ListeningArtworkPolicy::ReplaceWithStudioArtwork,
        }
    }

    #[test]
    fn candidate_requires_three_unchanged_samples() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.wav"), 10, 100);
        assert!(!observe_candidate(&state, 1, 1, "wav", &source).expect("sample 1"));
        assert!(!observe_candidate(&state, 1, 2, "wav", &source).expect("sample 2"));
        assert!(observe_candidate(&state, 1, 3, "wav", &source).expect("sample 3"));
    }

    #[test]
    fn changed_file_resets_stability_and_published_state_suppresses_duplicates() {
        let state = state_with_project();
        let first = fingerprint(Path::new("mix.wav"), 10, 100);
        let growing = fingerprint(Path::new("mix.wav"), 20, 101);
        assert!(!observe_candidate(&state, 1, 1, "wav", &first).expect("first"));
        assert!(!observe_candidate(&state, 1, 2, "wav", &first).expect("second"));
        assert!(!observe_candidate(&state, 1, 3, "wav", &growing).expect("changed"));
        assert!(!observe_candidate(&state, 1, 4, "wav", &growing).expect("stable 2"));
        assert!(observe_candidate(&state, 1, 5, "wav", &growing).expect("stable 3"));
        record_publish_result(
            &state,
            1,
            5,
            "wav",
            &growing,
            ListeningPublishStatus::Published,
        )
        .expect("published");
        assert!(!observe_candidate(&state, 1, 6, "wav", &growing).expect("duplicate"));
    }

    #[test]
    fn failed_publish_retries_after_backoff_without_requiring_a_new_bounce() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.wav"), 10, 100);
        for scan in 1..=3 {
            let _ = observe_candidate(&state, 1, scan, "wav", &source).expect("stable");
        }
        record_publish_result(&state, 1, 3, "wav", &source, ListeningPublishStatus::Failed)
            .expect("failed");
        assert!(!observe_candidate(&state, 1, 4, "wav", &source).expect("backoff"));
        assert!(observe_candidate(&state, 1, 13, "wav", &source).expect("retry"));
    }

    #[test]
    fn missing_source_resets_observation_without_a_publish_result() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.mp3"), 10, 100);
        for scan in 1..=3 {
            let _ = observe_candidate(&state, 1, scan, "mp3", &source).expect("stable");
        }
        record_publish_result(
            &state,
            1,
            3,
            "mp3",
            &source,
            ListeningPublishStatus::Published,
        )
        .expect("published");
        observe_missing(&state, 1, "mp3").expect("missing");
        assert!(!observe_candidate(&state, 1, 4, "mp3", &source).expect("candidate 1"));
        assert!(!observe_candidate(&state, 1, 5, "mp3", &source).expect("candidate 2"));
        assert!(observe_candidate(&state, 1, 6, "mp3", &source).expect("candidate 3"));
    }

    #[test]
    fn target_name_uses_project_and_revision_not_source_filename() {
        assert_eq!(
            revision_target_name("project-a", 4, ".MP3").expect("target name"),
            "project-a-rev-04.mp3"
        );
    }

    #[test]
    fn client_scoped_destination_creates_client_folder() {
        let temp = tempdir().expect("tempdir");
        let scoped =
            client_scoped_destination(&destination(temp.path()), "client-a").expect("scoped");
        assert_eq!(PathBuf::from(&scoped.path), temp.path().join("client-a"));
        assert!(temp.path().join("client-a").is_dir());
    }

    #[test]
    fn fingerprint_changes_during_multi_step_write() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("Mix.wav");
        fs::write(&source, b"partial").expect("partial write");
        let first = source_fingerprint(&source).expect("first fingerprint");
        thread::sleep(Duration::from_millis(5));
        fs::write(&source, b"completed audio payload").expect("final write");
        let second = source_fingerprint(&source).expect("second fingerprint");
        assert_ne!(first, second);
    }
}
