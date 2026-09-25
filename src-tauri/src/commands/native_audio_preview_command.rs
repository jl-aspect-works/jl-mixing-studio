use super::resolve_workspace_root;
use super::waveform_cache::{ProjectAudioWaveform, WaveformCache};
use crate::audio_preview::{
    self, NativeAudioPreviewState, NativeAudioPreviewStatus, NativeComparisonAudioStatus,
};
use crate::models::ProjectFileMutationRequest;
use crate::workspace;
use rodio::{Decoder, Source};
use serde::Deserialize;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::Instant;
use tauri::Manager;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeComparisonCandidateRequest {
    blind_id: String,
    client_id: String,
    project_id: String,
    relative_path: String,
    applied_gain_db: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeComparisonPrepareRequest {
    candidates: Vec<NativeComparisonCandidateRequest>,
    start_seconds: f64,
}

fn resolve_project_audio_file(
    app: &tauri::AppHandle,
    request: &ProjectFileMutationRequest,
) -> Result<(PathBuf, String), String> {
    let root = resolve_workspace_root(app)?;
    let project_directory = workspace::find_validated_project_path(
        &root,
        request.client_id.trim(),
        request.project_id.trim(),
    )
    .ok_or_else(|| "The selected project could not be resolved safely".to_owned())?;
    resolve_project_entry(&project_directory, &request.relative_path)
}

fn resolve_project_entry(
    project_directory: &Path,
    relative_path: &str,
) -> Result<(PathBuf, String), String> {
    let normalized = normalize_relative_path(relative_path)?;
    let project_metadata = fs::symlink_metadata(project_directory)
        .map_err(|error| format!("Unable to inspect the project root: {error}"))?;
    if project_metadata.file_type().is_symlink() || !project_metadata.is_dir() {
        return Err("The selected project root is unavailable or unsafe".into());
    }
    let canonical_project = project_directory
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the project root: {error}"))?;

    let mut current = project_directory.to_path_buf();
    for component in normalized.split('/') {
        current.push(component);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| format!("Unable to resolve the selected project path: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Symbolic-link project paths are not allowed".into());
        }
    }

    let metadata = fs::symlink_metadata(&current)
        .map_err(|error| format!("Unable to inspect the selected project entry: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Only regular project audio files can be previewed".into());
    }
    let canonical = current
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the selected project entry: {error}"))?;
    if !canonical.starts_with(&canonical_project) {
        return Err("The selected project entry could not be resolved safely".into());
    }
    Ok((canonical, normalized))
}

fn normalize_relative_path(relative_path: &str) -> Result<String, String> {
    let value = relative_path.trim();
    if value.is_empty() {
        return Err("A project file path is required".into());
    }
    if value.starts_with('/') || value.contains('\\') {
        return Err("Project file paths must be portable project-relative paths".into());
    }
    if value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return Err("Unsafe project file path segments are not allowed".into());
    }
    Ok(value.to_owned())
}

#[tauri::command]
pub(crate) async fn get_project_audio_waveform(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectAudioWaveform, String> {
    tauri::async_runtime::spawn_blocking(move || get_project_audio_waveform_blocking(app, request))
        .await
        .map_err(|_| "Comparison loading task could not complete".to_owned())?
}

fn get_project_audio_waveform_blocking(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectAudioWaveform, String> {
    static CACHE: OnceLock<WaveformCache> = OnceLock::new();
    static REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);
    let request_id = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let lookup_started = Instant::now();
    let source = resolve_project_audio_file(&app, &request);
    log_waveform_phase(request_id, "lookup", lookup_started, source.is_ok(), "none");
    let (path, _) = source?;
    let cache_started = Instant::now();
    let result = CACHE.get_or_init(WaveformCache::default).get(&path, || {
        let decode_started = Instant::now();
        let result = decode_waveform(&path);
        log_waveform_phase(request_id, "decode", decode_started, result.is_ok(), "miss");
        result
    });
    let cache_state = match &result {
        Ok((_, true)) => "hit",
        Ok((_, false)) => "miss",
        Err(_) => "error",
    };
    log_waveform_phase(
        request_id,
        "cache",
        cache_started,
        result.is_ok(),
        cache_state,
    );
    result.map(|(waveform, _)| waveform)
}

fn log_waveform_phase(
    request_id: u64,
    phase: &str,
    started: Instant,
    success: bool,
    cache_state: &str,
) {
    crate::diagnostic_log::log(
        "info",
        "comparison_waveform",
        &[
            ("request_id", json!(request_id)),
            ("phase", json!(phase)),
            ("elapsed_ms", json!(started.elapsed().as_millis())),
            ("outcome", json!(if success { "success" } else { "error" })),
            ("cache_state", json!(cache_state)),
        ],
    );
}

fn decode_waveform(path: &Path) -> Result<ProjectAudioWaveform, String> {
    const PEAK_COUNT: usize = 480;
    let decoder = Decoder::try_from(
        fs::File::open(path).map_err(|error| format!("Unable to open waveform source: {error}"))?,
    )
    .map_err(|error| format!("Unable to decode waveform source: {error}"))?;
    let channels = usize::from(decoder.channels().get());
    let sample_rate = decoder.sample_rate().get() as usize;
    let duration_seconds = decoder
        .total_duration()
        .map(|value| value.as_secs_f64())
        .ok_or_else(|| "The waveform duration could not be determined".to_owned())?;
    let total_samples = (duration_seconds * sample_rate as f64 * channels as f64).ceil() as usize;
    let samples_per_peak = total_samples.div_ceil(PEAK_COUNT).max(1);
    let mut peaks = vec![0.0_f32; PEAK_COUNT];
    for (index, sample) in decoder.enumerate() {
        let peak = (index / samples_per_peak).min(PEAK_COUNT - 1);
        peaks[peak] = peaks[peak].max(sample.abs());
    }
    while peaks.last().is_some_and(|value| *value == 0.0) {
        peaks.pop();
    }
    Ok(ProjectAudioWaveform {
        duration_seconds,
        peaks,
    })
}

#[tauri::command]
pub(crate) fn load_native_project_audio_preview(
    app: tauri::AppHandle,
    state: tauri::State<'_, NativeAudioPreviewState>,
    request: ProjectFileMutationRequest,
) -> Result<NativeAudioPreviewStatus, String> {
    if !cfg!(target_os = "windows") {
        return audio_preview::status(&state);
    }
    let (path, relative_path) = resolve_project_audio_file(&app, &request)?;
    audio_preview::load(&state, &path, relative_path)
}

#[tauri::command]
pub(crate) fn play_native_project_audio_preview(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeAudioPreviewStatus, String> {
    audio_preview::play(&state)
}

#[tauri::command]
pub(crate) fn pause_native_project_audio_preview(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeAudioPreviewStatus, String> {
    audio_preview::pause(&state)
}

#[tauri::command]
pub(crate) fn seek_native_project_audio_preview(
    state: tauri::State<'_, NativeAudioPreviewState>,
    seconds: f64,
) -> Result<NativeAudioPreviewStatus, String> {
    audio_preview::seek(&state, seconds)
}

#[tauri::command]
pub(crate) fn set_native_project_audio_preview_volume(
    state: tauri::State<'_, NativeAudioPreviewState>,
    volume: f32,
) -> Result<NativeAudioPreviewStatus, String> {
    audio_preview::set_volume(&state, volume)
}

#[tauri::command]
pub(crate) fn stop_native_project_audio_preview(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeAudioPreviewStatus, String> {
    audio_preview::stop(&state)
}

#[tauri::command]
pub(crate) fn get_native_project_audio_preview_status(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeAudioPreviewStatus, String> {
    audio_preview::status(&state)
}

#[tauri::command]
pub(crate) async fn prepare_native_comparison_audio(
    app: tauri::AppHandle,
    request: NativeComparisonPrepareRequest,
) -> Result<NativeComparisonAudioStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<NativeAudioPreviewState>();
        prepare_native_comparison_audio_blocking(app.clone(), state, request)
    })
    .await
    .map_err(|_| "Comparison audio preparation could not complete".to_owned())?
}

fn prepare_native_comparison_audio_blocking(
    app: tauri::AppHandle,
    state: tauri::State<'_, NativeAudioPreviewState>,
    request: NativeComparisonPrepareRequest,
) -> Result<NativeComparisonAudioStatus, String> {
    if !cfg!(target_os = "windows") {
        return audio_preview::comparison_status(&state);
    }
    let first = request
        .candidates
        .first()
        .ok_or("No comparison candidates selected")?;
    if request.candidates.iter().any(|candidate| {
        candidate.client_id != first.client_id || candidate.project_id != first.project_id
    }) {
        return Err("Comparison candidates must belong to one project".into());
    }
    let root = resolve_workspace_root(&app)?;
    let directory =
        workspace::find_validated_project_path(&root, &first.client_id, &first.project_id)
            .ok_or("Comparison project could not be resolved safely")?;
    let candidates = request
        .candidates
        .into_iter()
        .map(|candidate| {
            resolve_project_entry(&directory, &candidate.relative_path)
                .map(|(path, _)| (candidate.blind_id, path, candidate.applied_gain_db))
        })
        .collect::<Result<Vec<_>, _>>()?;
    audio_preview::prepare_comparison(&state, candidates, request.start_seconds)
}

#[tauri::command]
pub(crate) fn play_native_comparison_audio(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::play_comparison(&state)
}

#[tauri::command]
pub(crate) fn pause_native_comparison_audio(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::pause_comparison(&state)
}

#[tauri::command]
pub(crate) fn seek_native_comparison_audio(
    state: tauri::State<'_, NativeAudioPreviewState>,
    seconds: f64,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::seek_comparison(&state, seconds)
}

#[tauri::command]
pub(crate) fn switch_native_comparison_candidate(
    state: tauri::State<'_, NativeAudioPreviewState>,
    candidate_id: String,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::switch_comparison_candidate(&state, &candidate_id)
}

#[tauri::command]
pub(crate) fn set_native_comparison_audio_volume(
    state: tauri::State<'_, NativeAudioPreviewState>,
    volume: f32,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::set_comparison_volume(&state, volume)
}

#[tauri::command]
pub(crate) fn set_native_comparison_match_gains(
    state: tauri::State<'_, NativeAudioPreviewState>,
    gains: std::collections::BTreeMap<String, Option<f64>>,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::set_comparison_match_gains(&state, gains)
}

#[tauri::command]
pub(crate) fn stop_native_comparison_audio(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::stop_comparison(&state)
}

#[tauri::command]
pub(crate) fn get_native_comparison_audio_status(
    state: tauri::State<'_, NativeAudioPreviewState>,
) -> Result<NativeComparisonAudioStatus, String> {
    audio_preview::comparison_status(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_preview_rejects_unsafe_relative_paths() {
        assert!(normalize_relative_path("../outside.wav").is_err());
        assert!(normalize_relative_path("/absolute.wav").is_err());
        assert!(normalize_relative_path("folder\\file.wav").is_err());
        assert_eq!(
            normalize_relative_path("04_Revisions/Revision_01/mix.wav").unwrap(),
            "04_Revisions/Revision_01/mix.wav"
        );
    }
}
