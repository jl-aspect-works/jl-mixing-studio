use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::audio_preview::{
    self, NativeAudioPreviewState, NativeAudioPreviewStatus, NativeComparisonAudioStatus,
};
use crate::models::{ProjectFileMutationRequest, WorkspaceStatus};
use crate::workspace;
use rodio::{Decoder, Source};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectAudioWaveform {
    duration_seconds: f64,
    peaks: Vec<f32>,
}

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
    let snapshot = workspace::discover_workspace_at(&root);
    if !matches!(
        snapshot.status,
        WorkspaceStatus::Healthy | WorkspaceStatus::Empty | WorkspaceStatus::Partial
    ) {
        return Err("The configured workspace is unavailable; reconnect it and try again".into());
    }
    let project_directory = validated_project_directory(
        &root,
        &snapshot,
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
pub(crate) fn get_project_audio_waveform(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectAudioWaveform, String> {
    const PEAK_COUNT: usize = 480;
    let (path, _) = resolve_project_audio_file(&app, &request)?;
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
pub(crate) fn prepare_native_comparison_audio(
    app: tauri::AppHandle,
    state: tauri::State<'_, NativeAudioPreviewState>,
    request: NativeComparisonPrepareRequest,
) -> Result<NativeComparisonAudioStatus, String> {
    if !cfg!(target_os = "windows") {
        return audio_preview::comparison_status(&state);
    }
    let candidates = request
        .candidates
        .into_iter()
        .map(|candidate| {
            let file_request = ProjectFileMutationRequest {
                client_id: candidate.client_id,
                project_id: candidate.project_id,
                relative_path: candidate.relative_path,
            };
            resolve_project_audio_file(&app, &file_request)
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
