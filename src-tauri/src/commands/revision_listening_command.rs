use super::listening_artwork::ensure_artist_artwork_sidecars;
use super::listening_metadata::listening_metadata_is_current;
use super::{listening_configuration, publish_listening_copy, resolve_workspace_root};
use crate::diagnostic_log;
use crate::models::{
    ListeningDestination, ListeningPublishClass, ListeningPublishResult, ListeningPublishStatus,
};
use crate::workspace;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{hash_map::Entry, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

const SCAN_INTERVAL: Duration = Duration::from_secs(1);
const SLOW_SCAN_THRESHOLD: Duration = Duration::from_millis(1_500);
const SLOW_SCAN_RECOVERY_THRESHOLD: Duration = Duration::from_millis(1_250);
const SCAN_TIMING_TRANSITION_SAMPLES: u8 = 3;
const STABLE_SAMPLE_COUNT: u8 = 3;
const FAILED_RETRY_SCANS: u64 = 10;
const PUBLISH_EVENT: &str = "revision-listening-publish-results";
const DELIVERY_IDENTITY_CHANGED_EVENT: &str = "project-delivery-identity-changed";

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDeliveryIdentityChangedEvent {
    client_id: String,
    project_id: String,
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
    last_scan_error: Option<String>,
    last_scan_slow: bool,
    consecutive_slow_scans: u8,
    consecutive_recovered_scans: u8,
    revision_diagnostic: Option<DiagnosticOutcome>,
    delivered_diagnostic: Option<DiagnosticOutcome>,
    delivery_identity: Option<Option<DeliveryIdentity>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiagnosticOutcome {
    signature: String,
    failed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DeliveryIdentity {
    document_id: String,
    created_at: String,
    revision: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DiagnosticTransition {
    Unchanged,
    Changed,
    Recovered,
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
        monitor.active_project = next.clone();
        monitor.generation = monitor.generation.wrapping_add(1);
        monitor.scan_number = 0;
        monitor.destinations.clear();
        monitor.last_scan_error = None;
        monitor.last_scan_slow = false;
        monitor.consecutive_slow_scans = 0;
        monitor.consecutive_recovered_scans = 0;
        monitor.revision_diagnostic = None;
        monitor.delivered_diagnostic = None;
        monitor.delivery_identity = None;
        diagnostic_log::info(
            "listening_monitor_project_changed",
            &[
                ("active", json!(next.is_some())),
                (
                    "client_id",
                    json!(next.as_ref().map(|project| project.client_id.as_str())),
                ),
                (
                    "project_id",
                    json!(next.as_ref().map(|project| project.project_id.as_str())),
                ),
                ("generation", json!(monitor.generation)),
            ],
        );
    }
    Ok(())
}

pub(crate) fn start_revision_listening_monitor(app: tauri::AppHandle) {
    // The historical command/state names are retained for bridge compatibility, but this is now
    // the project-scoped Listening reconciler. Each scan checks both Revision and Delivered
    // Listening for the active project.
    thread::spawn(move || loop {
        thread::sleep(SCAN_INTERVAL);
        match scan_active_project(&app) {
            Ok(()) => record_scan_recovery(&app),
            Err(message) => record_scan_failure(&app, &message),
        }
    });
}

fn record_scan_failure(app: &tauri::AppHandle, message: &str) {
    let state = app.state::<RevisionListeningMonitorState>();
    let Ok(mut monitor) = state.inner.lock() else {
        diagnostic_log::error(
            "listening_monitor_scan_failed",
            &[
                ("message", json!(message)),
                ("state_available", json!(false)),
            ],
        );
        return;
    };
    if monitor.last_scan_error.as_deref() == Some(message) {
        return;
    }
    monitor.last_scan_error = Some(message.to_owned());
    let active = monitor.active_project.clone();
    diagnostic_log::error(
        "listening_monitor_scan_failed",
        &[
            ("message", json!(message)),
            ("state_available", json!(true)),
            (
                "client_id",
                json!(active.as_ref().map(|project| project.client_id.as_str())),
            ),
            (
                "project_id",
                json!(active.as_ref().map(|project| project.project_id.as_str())),
            ),
            ("scan_number", json!(monitor.scan_number)),
        ],
    );
}

fn record_scan_recovery(app: &tauri::AppHandle) {
    let state = app.state::<RevisionListeningMonitorState>();
    let Ok(mut monitor) = state.inner.lock() else {
        return;
    };
    let Some(previous_error) = monitor.last_scan_error.take() else {
        return;
    };
    let active = monitor.active_project.clone();
    diagnostic_log::info(
        "listening_monitor_scan_recovered",
        &[
            ("previous_error", json!(previous_error)),
            (
                "client_id",
                json!(active.as_ref().map(|project| project.client_id.as_str())),
            ),
            (
                "project_id",
                json!(active.as_ref().map(|project| project.project_id.as_str())),
            ),
            ("scan_number", json!(monitor.scan_number)),
        ],
    );
}

fn record_scan_timing(
    state: &RevisionListeningMonitorState,
    generation: u64,
    duration: Duration,
    fields: &[(&str, serde_json::Value)],
) -> Result<(), String> {
    let transition = {
        let mut monitor = state
            .inner
            .lock()
            .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
        if monitor.generation != generation {
            return Ok(());
        }
        update_scan_timing_state(&mut monitor, duration)
    };
    if transition == DiagnosticTransition::Unchanged {
        return Ok(());
    }
    diagnostic_log::info(
        if transition == DiagnosticTransition::Changed {
            "listening_monitor_scan_slow"
        } else {
            "listening_monitor_scan_speed_recovered"
        },
        fields,
    );
    Ok(())
}

fn update_scan_timing_state(
    monitor: &mut MonitorData,
    duration: Duration,
) -> DiagnosticTransition {
    if monitor.last_scan_slow {
        monitor.consecutive_slow_scans = 0;
        if duration > SLOW_SCAN_RECOVERY_THRESHOLD {
            monitor.consecutive_recovered_scans = 0;
            return DiagnosticTransition::Unchanged;
        }
        monitor.consecutive_recovered_scans =
            monitor.consecutive_recovered_scans.saturating_add(1);
        if monitor.consecutive_recovered_scans < SCAN_TIMING_TRANSITION_SAMPLES {
            return DiagnosticTransition::Unchanged;
        }
        monitor.last_scan_slow = false;
        monitor.consecutive_recovered_scans = 0;
        return DiagnosticTransition::Recovered;
    }

    monitor.consecutive_recovered_scans = 0;
    if duration < SLOW_SCAN_THRESHOLD {
        monitor.consecutive_slow_scans = 0;
        return DiagnosticTransition::Unchanged;
    }
    monitor.consecutive_slow_scans = monitor.consecutive_slow_scans.saturating_add(1);
    if monitor.consecutive_slow_scans < SCAN_TIMING_TRANSITION_SAMPLES {
        return DiagnosticTransition::Unchanged;
    }
    monitor.last_scan_slow = true;
    monitor.consecutive_slow_scans = 0;
    DiagnosticTransition::Changed
}

fn scan_active_project(app: &tauri::AppHandle) -> Result<(), String> {
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

    let scan_started = Instant::now();
    let configuration_started = Instant::now();
    let configuration = listening_configuration(app)
        .map_err(|message| format!("Listening configuration could not be loaded: {message}"))?;
    let destinations = configuration
        .destinations
        .into_iter()
        .filter(|destination| {
            destination.enabled
                && destination.publish_class == ListeningPublishClass::RevisionListening
        })
        .collect::<Vec<_>>();
    let configuration_duration_ms = configuration_started.elapsed().as_millis() as u64;

    let workspace_root = resolve_workspace_root(app)
        .map_err(|message| format!("Listening workspace could not be resolved: {message}"))?;
    let project_discovery_started = Instant::now();
    let (project_directory, project) =
        workspace::discover_project_at(&workspace_root, &active.client_id, &active.project_id)
            .ok_or_else(|| "The active Listening project is unavailable or invalid".to_owned())?;
    let project_discovery_duration_ms = project_discovery_started.elapsed().as_millis() as u64;
    diagnostic_log::debug(
        "listening_monitor_project_discovered",
        &[
            ("client_id", json!(active.client_id.as_str())),
            ("project_id", json!(active.project_id.as_str())),
            ("scan_number", json!(scan_number)),
            ("workspace_path", json!(workspace_root.to_string_lossy())),
            ("discovery_scope", json!("active_project")),
            (
                "project_discovery_duration_ms",
                json!(project_discovery_duration_ms),
            ),
        ],
    );
    let revision = project.current_revision;
    let revision_root = project_directory
        .join("04_Revisions")
        .join(format!("Revision_{revision:02}"));
    let context = RevisionPublishContext {
        client_id: &active.client_id,
        project_id: &active.project_id,
        revision,
        revision_root: &revision_root,
    };
    diagnostic_log::debug(
        "listening_monitor_project_resolved",
        &[
            ("client_id", json!(active.client_id.as_str())),
            ("project_id", json!(active.project_id.as_str())),
            ("scan_number", json!(scan_number)),
            ("revision", json!(revision)),
            ("delivered_revision", json!(project.delivered_revision)),
            ("delivery_present", json!(project.delivery.is_some())),
            ("revision_path", json!(revision_root.to_string_lossy())),
            ("revision_destination_count", json!(destinations.len())),
        ],
    );

    let revision_reconciliation_started = Instant::now();
    let destination_ids = destinations
        .iter()
        .map(|destination| destination.id.clone())
        .collect::<Vec<_>>();
    clear_stale_destinations(&state, generation, &destination_ids)?;

    let mut results = Vec::new();
    for destination in &destinations {
        if !generation_is_current(&state, generation)? {
            return Ok(());
        }
        if let Some(result) =
            scan_destination(&state, generation, scan_number, &context, destination)?
        {
            results.push(result);
        }
    }

    let quiet_reconciliation =
        results.is_empty() && revision_reconciliation_is_quiet(&context, &destinations);
    if (!results.is_empty() || quiet_reconciliation) && generation_is_current(&state, generation)? {
        let _ = app.emit(
            PUBLISH_EVENT,
            RevisionListeningPublishEvent {
                client_id: active.client_id.clone(),
                project_id: active.project_id.clone(),
                revision,
                results: results.clone(),
            },
        );
    }
    record_reconciliation_diagnostics(&state, generation, "revision", &active, revision, &results)?;
    let revision_reconciliation_duration_ms =
        revision_reconciliation_started.elapsed().as_millis() as u64;

    let delivered_reconciliation_started = Instant::now();
    if generation_is_current(&state, generation)? {
        let delivery_identity_changed = observe_delivery_identity(
            &state,
            generation,
            project.delivery.as_ref().map(|delivery| DeliveryIdentity {
                document_id: delivery.document_id.clone(),
                created_at: delivery.created_at.clone(),
                revision: delivery.revision,
            }),
        )?;
        let delivered_results = super::delivered_listening::reconcile_resolved_project(
            app,
            &project_directory,
            &active.client_id,
            &active.project_id,
            project.delivery.as_ref(),
            "monitor",
        )?;
        record_reconciliation_diagnostics(
            &state,
            generation,
            "delivered",
            &active,
            project
                .delivery
                .as_ref()
                .map_or(revision, |delivery| delivery.revision),
            &delivered_results,
        )?;
        if delivery_identity_changed && generation_is_current(&state, generation)? {
            let _ = app.emit(
                DELIVERY_IDENTITY_CHANGED_EVENT,
                ProjectDeliveryIdentityChangedEvent {
                    client_id: active.client_id.clone(),
                    project_id: active.project_id.clone(),
                },
            );
        }
    }
    let delivered_reconciliation_duration_ms =
        delivered_reconciliation_started.elapsed().as_millis() as u64;
    let total_duration = scan_started.elapsed();
    let timing_fields = [
        ("client_id", json!(active.client_id.as_str())),
        ("project_id", json!(active.project_id.as_str())),
        ("scan_number", json!(scan_number)),
        (
            "configuration_duration_ms",
            json!(configuration_duration_ms),
        ),
        (
            "project_discovery_duration_ms",
            json!(project_discovery_duration_ms),
        ),
        (
            "revision_reconciliation_duration_ms",
            json!(revision_reconciliation_duration_ms),
        ),
        (
            "delivered_reconciliation_duration_ms",
            json!(delivered_reconciliation_duration_ms),
        ),
        (
            "total_duration_ms",
            json!(total_duration.as_millis() as u64),
        ),
    ];
    diagnostic_log::debug("listening_monitor_scan_completed", &timing_fields);
    record_scan_timing(&state, generation, total_duration, &timing_fields)?;
    Ok(())
}

fn observe_delivery_identity(
    state: &RevisionListeningMonitorState,
    generation: u64,
    next: Option<DeliveryIdentity>,
) -> Result<bool, String> {
    let mut monitor = state
        .inner
        .lock()
        .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
    if monitor.generation != generation {
        return Ok(false);
    }
    let Some(previous) = monitor.delivery_identity.as_ref() else {
        monitor.delivery_identity = Some(next);
        return Ok(false);
    };
    if previous == &next {
        return Ok(false);
    }
    monitor.delivery_identity = Some(next);
    Ok(true)
}

fn diagnostic_signature(results: &[ListeningPublishResult]) -> String {
    serde_json::to_string(results).unwrap_or_else(|_| format!("{}-results", results.len()))
}

fn update_diagnostic_outcome(
    previous: &mut Option<DiagnosticOutcome>,
    results: &[ListeningPublishResult],
) -> DiagnosticTransition {
    let next = DiagnosticOutcome {
        signature: diagnostic_signature(results),
        failed: results
            .iter()
            .any(|result| result.status == ListeningPublishStatus::Failed),
    };
    if previous.as_ref() == Some(&next) {
        return DiagnosticTransition::Unchanged;
    }
    let recovered = previous.as_ref().is_some_and(|outcome| outcome.failed) && !next.failed;
    *previous = Some(next);
    if recovered {
        DiagnosticTransition::Recovered
    } else {
        DiagnosticTransition::Changed
    }
}

fn record_reconciliation_diagnostics(
    state: &RevisionListeningMonitorState,
    generation: u64,
    publish_class: &str,
    active: &ActiveProject,
    revision: u32,
    results: &[ListeningPublishResult],
) -> Result<(), String> {
    let transition = {
        let mut monitor = state
            .inner
            .lock()
            .map_err(|_| "Revision Listening monitor state is unavailable".to_owned())?;
        if monitor.generation != generation {
            return Ok(());
        }
        let previous = if publish_class == "revision" {
            &mut monitor.revision_diagnostic
        } else {
            &mut monitor.delivered_diagnostic
        };
        update_diagnostic_outcome(previous, results)
    };
    if transition == DiagnosticTransition::Unchanged {
        return Ok(());
    }
    if transition == DiagnosticTransition::Recovered {
        diagnostic_log::info(
            "listening_reconciliation_recovered",
            &[
                ("publish_class", json!(publish_class)),
                ("client_id", json!(active.client_id.as_str())),
                ("project_id", json!(active.project_id.as_str())),
                ("revision", json!(revision)),
            ],
        );
    }
    for result in results {
        let fields = [
            ("publish_class", json!(publish_class)),
            ("client_id", json!(active.client_id.as_str())),
            ("project_id", json!(active.project_id.as_str())),
            ("revision", json!(revision)),
            ("destination_id", json!(result.destination_id.as_str())),
            ("status", json!(result.status)),
            ("message", json!(result.message.as_str())),
            ("selected_source", json!(result.selected_source.as_deref())),
            (
                "destination_path",
                json!(result.destination_path.as_deref()),
            ),
        ];
        if result.status == ListeningPublishStatus::Failed {
            diagnostic_log::error("listening_reconciliation_result", &fields);
        } else {
            diagnostic_log::info("listening_reconciliation_result", &fields);
        }
    }
    Ok(())
}

fn revision_reconciliation_is_quiet(
    context: &RevisionPublishContext<'_>,
    destinations: &[ListeningDestination],
) -> bool {
    destinations.iter().all(|destination| {
        let selection = match super::project_revision_files::select_listening_source(
            context.revision_root,
            &destination.required_extension,
            None,
        ) {
            Ok(selection) => selection,
            Err(_) => return false,
        };
        let Some(selection) = selection else {
            return true;
        };
        let scoped_destination = match client_scoped_destination(destination, context.client_id) {
            Ok(destination) => destination,
            Err(_) => return false,
        };
        let target_name = match revision_target_name(
            context.project_id,
            context.revision,
            &destination.required_extension,
        ) {
            Ok(name) => name,
            Err(_) => return false,
        };
        revision_target_is_current(&selection.path, &scoped_destination, &target_name)
            .unwrap_or(false)
    })
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
        diagnostic_log::debug(
            "revision_listening_source_missing",
            &[
                ("client_id", json!(context.client_id)),
                ("project_id", json!(context.project_id)),
                ("revision", json!(context.revision)),
                ("destination_id", json!(destination.id)),
                ("required_extension", json!(destination.required_extension)),
                (
                    "revision_path",
                    json!(context.revision_root.to_string_lossy()),
                ),
            ],
        );
        observe_missing(state, generation, &destination.id)?;
        return Ok(None);
    };

    let fingerprint = source_fingerprint(&selection.path)?;
    diagnostic_log::debug(
        "revision_listening_source_selected",
        &[
            ("client_id", json!(context.client_id)),
            ("project_id", json!(context.project_id)),
            ("revision", json!(context.revision)),
            ("destination_id", json!(destination.id)),
            ("required_extension", json!(destination.required_extension)),
            ("source_path", json!(selection.path.to_string_lossy())),
            ("source_size", json!(fingerprint.size)),
            ("source_modified_at_ms", json!(fingerprint.modified_at_ms)),
        ],
    );
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
    let target_current =
        match revision_target_is_current(&selection.path, &scoped_destination, &target_name) {
            Ok(current) => current,
            Err(message) => {
                let result = ListeningPublishResult {
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
    let should_publish = observe_candidate(
        state,
        generation,
        scan_number,
        &destination.id,
        &fingerprint,
        target_current,
    )?;
    diagnostic_log::debug(
        "revision_listening_freshness_checked",
        &[
            ("client_id", json!(context.client_id)),
            ("project_id", json!(context.project_id)),
            ("revision", json!(context.revision)),
            ("destination_id", json!(destination.id)),
            ("target_current", json!(target_current)),
            ("publish_ready", json!(should_publish)),
        ],
    );
    if !should_publish {
        return Ok(None);
    }

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

fn revision_target_is_current(
    source: &Path,
    destination: &ListeningDestination,
    target_name: &str,
) -> Result<bool, String> {
    let target = PathBuf::from(&destination.path).join(target_name);
    let target_metadata = match fs::symlink_metadata(&target) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => {
            return Err(format!(
                "Unable to inspect the Revision Listening destination: {error}"
            ))
        }
    };
    if target_metadata.file_type().is_symlink() || !target_metadata.is_file() {
        return Ok(false);
    }

    let source_metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("Unable to inspect the Revision Listening source: {error}"))?;
    if source_metadata.file_type().is_symlink() || !source_metadata.is_file() {
        return Err("Revision Listening source must be a regular file".into());
    }

    let source_modified = source_metadata.modified().map_err(|error| {
        format!("Unable to read the Revision Listening source timestamp: {error}")
    })?;
    let target_modified = target_metadata.modified().map_err(|error| {
        format!("Unable to read the Revision Listening destination timestamp: {error}")
    })?;
    if target_modified < source_modified {
        return Ok(false);
    }
    listening_metadata_is_current(&target, source, destination.metadata_policy)
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
    target_current: bool,
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
    if target_current {
        observation.published = Some(fingerprint.clone());
        observation.last_attempt = None;
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
    if status == ListeningPublishStatus::Published {
        observation.published = Some(fingerprint.clone());
        observation.last_attempt = None;
    } else if status == ListeningPublishStatus::Failed {
        observation.last_attempt = Some((fingerprint.clone(), scan_number));
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
    ensure_artist_artwork_sidecars(&client_root, destination.artwork_policy)
        .map_err(|error| format!("Unable to reconcile Listening artist artwork: {error}"))?;
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

    fn diagnostic_result(status: ListeningPublishStatus, message: &str) -> ListeningPublishResult {
        ListeningPublishResult {
            destination_id: "diagnostic-destination".into(),
            status,
            message: message.into(),
            selected_source: Some("source.mp3".into()),
            destination_path: Some("listening/project.mp3".into()),
        }
    }

    #[test]
    fn diagnostic_outcomes_suppress_repeated_failures_and_report_recovery() {
        let failure = vec![diagnostic_result(
            ListeningPublishStatus::Failed,
            "destination unavailable",
        )];
        let mut previous = None;

        assert_eq!(
            update_diagnostic_outcome(&mut previous, &failure),
            DiagnosticTransition::Changed
        );
        assert_eq!(
            update_diagnostic_outcome(&mut previous, &failure),
            DiagnosticTransition::Unchanged
        );
        assert_eq!(
            update_diagnostic_outcome(&mut previous, &[]),
            DiagnosticTransition::Recovered
        );
        assert_eq!(
            update_diagnostic_outcome(&mut previous, &[]),
            DiagnosticTransition::Unchanged
        );
    }

    #[test]
    fn marginal_scan_jitter_does_not_create_info_transitions() {
        let mut monitor = MonitorData::default();
        let observed_durations = [1_087, 979, 1_012, 998, 1_104, 965];

        for duration_ms in observed_durations {
            assert_eq!(
                update_scan_timing_state(&mut monitor, Duration::from_millis(duration_ms)),
                DiagnosticTransition::Unchanged
            );
        }

        assert!(!monitor.last_scan_slow);
        assert_eq!(monitor.consecutive_slow_scans, 0);
        assert_eq!(monitor.consecutive_recovered_scans, 0);
    }

    #[test]
    fn scan_timing_requires_sustained_slow_and_recovered_samples() {
        let mut monitor = MonitorData::default();

        for _ in 0..2 {
            assert_eq!(
                update_scan_timing_state(&mut monitor, Duration::from_millis(1_600)),
                DiagnosticTransition::Unchanged
            );
        }
        assert_eq!(
            update_scan_timing_state(&mut monitor, Duration::from_millis(1_600)),
            DiagnosticTransition::Changed
        );
        assert!(monitor.last_scan_slow);

        for _ in 0..2 {
            assert_eq!(
                update_scan_timing_state(&mut monitor, Duration::from_millis(1_200)),
                DiagnosticTransition::Unchanged
            );
        }
        assert_eq!(
            update_scan_timing_state(&mut monitor, Duration::from_millis(1_300)),
            DiagnosticTransition::Unchanged
        );
        for _ in 0..2 {
            assert_eq!(
                update_scan_timing_state(&mut monitor, Duration::from_millis(1_200)),
                DiagnosticTransition::Unchanged
            );
        }
        assert_eq!(
            update_scan_timing_state(&mut monitor, Duration::from_millis(1_200)),
            DiagnosticTransition::Recovered
        );
        assert!(!monitor.last_scan_slow);
    }

    #[test]
    fn delivery_identity_refreshes_only_after_the_observed_identity_changes() {
        let state = state_with_project();
        let first = DeliveryIdentity {
            document_id: "delivery-1".into(),
            created_at: "2026-09-03T10:00:00Z".into(),
            revision: 1,
        };
        let second = DeliveryIdentity {
            document_id: "delivery-2".into(),
            created_at: "2026-09-03T11:00:00Z".into(),
            revision: 2,
        };

        assert!(!observe_delivery_identity(&state, 1, Some(first.clone())).expect("baseline"));
        assert!(!observe_delivery_identity(&state, 1, Some(first)).expect("unchanged"));
        assert!(observe_delivery_identity(&state, 1, Some(second)).expect("changed"));
        assert!(observe_delivery_identity(&state, 1, None).expect("removed"));
        assert!(!observe_delivery_identity(&state, 1, None).expect("still absent"));
    }

    #[test]
    fn changed_diagnostic_failure_is_recorded_without_waiting_for_recovery() {
        let first = vec![diagnostic_result(
            ListeningPublishStatus::Failed,
            "destination unavailable",
        )];
        let second = vec![diagnostic_result(
            ListeningPublishStatus::Failed,
            "source unavailable",
        )];
        let mut previous = None;

        assert_eq!(
            update_diagnostic_outcome(&mut previous, &first),
            DiagnosticTransition::Changed
        );
        assert_eq!(
            update_diagnostic_outcome(&mut previous, &second),
            DiagnosticTransition::Changed
        );
    }

    #[test]
    fn candidate_requires_three_unchanged_samples() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.wav"), 10, 100);
        assert!(!observe_candidate(&state, 1, 1, "wav", &source, false).expect("sample 1"));
        assert!(!observe_candidate(&state, 1, 2, "wav", &source, false).expect("sample 2"));
        assert!(observe_candidate(&state, 1, 3, "wav", &source, false).expect("sample 3"));
    }

    #[test]
    fn changed_file_resets_stability_and_current_target_suppresses_duplicates() {
        let state = state_with_project();
        let first = fingerprint(Path::new("mix.wav"), 10, 100);
        let growing = fingerprint(Path::new("mix.wav"), 20, 101);
        assert!(!observe_candidate(&state, 1, 1, "wav", &first, false).expect("first"));
        assert!(!observe_candidate(&state, 1, 2, "wav", &first, false).expect("second"));
        assert!(!observe_candidate(&state, 1, 3, "wav", &growing, false).expect("changed"));
        assert!(!observe_candidate(&state, 1, 4, "wav", &growing, false).expect("stable 2"));
        assert!(observe_candidate(&state, 1, 5, "wav", &growing, false).expect("stable 3"));
        record_publish_result(
            &state,
            1,
            5,
            "wav",
            &growing,
            ListeningPublishStatus::Published,
        )
        .expect("published");
        assert!(!observe_candidate(&state, 1, 6, "wav", &growing, true).expect("current"));
    }

    #[test]
    fn missing_target_republishes_stable_source_after_success() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.wav"), 10, 100);
        for scan in 1..=3 {
            let _ = observe_candidate(&state, 1, scan, "wav", &source, false).expect("stable");
        }
        record_publish_result(
            &state,
            1,
            3,
            "wav",
            &source,
            ListeningPublishStatus::Published,
        )
        .expect("published");
        assert!(observe_candidate(&state, 1, 4, "wav", &source, false).expect("repair"));
    }

    #[test]
    fn failed_publish_retries_after_backoff_without_requiring_a_new_bounce() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.wav"), 10, 100);
        for scan in 1..=3 {
            let _ = observe_candidate(&state, 1, scan, "wav", &source, false).expect("stable");
        }
        record_publish_result(&state, 1, 3, "wav", &source, ListeningPublishStatus::Failed)
            .expect("failed");
        assert!(!observe_candidate(&state, 1, 4, "wav", &source, false).expect("backoff"));
        assert!(observe_candidate(&state, 1, 13, "wav", &source, false).expect("retry"));
    }

    #[test]
    fn missing_source_resets_observation_without_a_publish_result() {
        let state = state_with_project();
        let source = fingerprint(Path::new("mix.mp3"), 10, 100);
        for scan in 1..=3 {
            let _ = observe_candidate(&state, 1, scan, "mp3", &source, false).expect("stable");
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
        assert!(!observe_candidate(&state, 1, 4, "mp3", &source, false).expect("candidate 1"));
        assert!(!observe_candidate(&state, 1, 5, "mp3", &source, false).expect("candidate 2"));
        assert!(observe_candidate(&state, 1, 6, "mp3", &source, false).expect("candidate 3"));
    }

    #[test]
    fn target_current_check_detects_missing_and_current_files() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("source.mp3");
        fs::write(&source, b"source").expect("source");
        let destination_root = temp.path().join("listening");
        fs::create_dir_all(&destination_root).expect("destination");
        let mut scoped = destination(&destination_root);
        scoped.metadata_policy = ListeningMetadataPolicy::Off;
        assert!(
            !revision_target_is_current(&source, &scoped, "project-rev-01.mp3")
                .expect("missing target")
        );

        thread::sleep(Duration::from_millis(5));
        fs::write(destination_root.join("project-rev-01.mp3"), b"published").expect("target");
        assert!(
            revision_target_is_current(&source, &scoped, "project-rev-01.mp3")
                .expect("current target")
        );
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
        assert!(temp.path().join("client-a").join("artist.png").is_file());
        assert!(temp.path().join("client-a").join("folder.png").is_file());
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
