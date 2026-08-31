use super::{
    find_project_summary, listening_configuration, publish_listening_copy, resolve_workspace_root,
    validated_project_directory,
};
use crate::models::{
    ListeningDestination, ListeningPublishClass, ListeningPublishResult, ListeningPublishStatus,
};
use crate::workspace;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    missing_reported: bool,
}

impl DestinationObservation {
    fn missing() -> Self {
        Self {
            source: ObservedSource::Missing,
            stable_samples: 0,
            published: None,
            last_attempt: None,
            missing_reported: false,
        }
    }

    fn candidate(fingerprint: SourceFingerprint) -> Self {
        Self {
            source: ObservedSource::Candidate(fingerprint),
            stable_samples: 1,
            published: None,
            last_attempt: None,
            missing_reported: false,
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
    .ok_or_else(|| "The active Revision Listening project could not be resolved safely".to_owned())?;
    let revision_root = project_directory
        .join("04_Revisions")
        .join(format!("Revision_{revision:02}"));

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
        if let Some(result) = scan_destination(
            &state,
            generation,
            scan_number,
            revision,
            &revision_root,
            &destination,
        )? {
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
    revision: u32,
    revision_root: &Path,
    destination: &ListeningDestination,
) -> Result<Option<ListeningPublishResult>, String> {
    let selection = match super::project_revision_files::select_listening_source(
        revision_root,
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
        let should_report = observe_missing(state, generation, &destination.id)?;
        return Ok(should_report
            .then(|| publish_listening_copy(None, destination, None, true)));
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

    let target_name = revision_target_name(&selection.path, revision);
    let result = publish_listening_copy(Some(&selection), destination, target_name.as_deref(), true);
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
) -> Result<bool, String> {
    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.generation != generation {
        return Ok(false);
    }
    let observation = monitor
        .destinations
        .entry(destination_id.to_owned())
        .or_insert_with(DestinationObservation::missing);
    if !matches!(observation.source, ObservedSource::Missing) {
        *observation = DestinationObservation::missing();
    }
    if observation.missing_reported {
        return Ok(false);
    }
    observation.missing_reported = true;
    Ok(true)
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
    let observation = monitor
        .destinations
        .entry(destination_id.to_owned())
        .or_insert_with(|| DestinationObservation::candidate(fingerprint.clone()));

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
            attempted == fingerprint && scan_number.saturating_sub(*attempt_scan) < FAILED_RETRY_SCANS
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

fn revision_target_name(source: &Path, revision: u32) -> Option<String> {
    let stem = source.file_stem()?.to_str()?;
    let extension = source.extension()?.to_str()?;
    let marker = format!("R{revision:02}");
    let normalized_stem = stem.trim_end();
    if normalized_stem
        .to_ascii_lowercase()
        .ends_with(&marker.to_ascii_lowercase())
    {
        return Some(format!("{normalized_stem}.{extension}"));
    }
    Some(format!("{normalized_stem} - {marker}.{extension}"))
}

#[cfg(test)]
mod tests {
    use super::*;
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
        record_publish_result(
            &state,
            1,
            3,
            "wav",
            &source,
            ListeningPublishStatus::Failed,
        )
        .expect("failed");
        assert!(!observe_candidate(&state, 1, 4, "wav", &source).expect("backoff"));
        assert!(observe_candidate(&state, 1, 13, "wav", &source).expect("retry"));
    }

    #[test]
    fn missing_source_is_reported_once_until_a_candidate_appears() {
        let state = state_with_project();
        assert!(observe_missing(&state, 1, "mp3").expect("first missing"));
        assert!(!observe_missing(&state, 1, "mp3").expect("duplicate missing"));
        let source = fingerprint(Path::new("mix.mp3"), 10, 100);
        assert!(!observe_candidate(&state, 1, 2, "mp3", &source).expect("candidate"));
        {
            let mut monitor = state.inner.lock().expect("state");
            monitor.destinations.remove("mp3");
        }
        assert!(observe_missing(&state, 1, "mp3").expect("missing again"));
    }

    #[test]
    fn target_name_preserves_existing_revision_marker_or_adds_one() {
        assert_eq!(
            revision_target_name(Path::new("Artist - Song.wav"), 4).as_deref(),
            Some("Artist - Song - R04.wav")
        );
        assert_eq!(
            revision_target_name(Path::new("Artist - Song - R04.wav"), 4).as_deref(),
            Some("Artist - Song - R04.wav")
        );
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
