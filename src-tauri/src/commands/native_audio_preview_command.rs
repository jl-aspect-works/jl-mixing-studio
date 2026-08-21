use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::audio_preview::{self, NativeAudioPreviewState, NativeAudioPreviewStatus};
use crate::models::{ProjectFileMutationRequest, WorkspaceStatus};
use crate::workspace;
use std::fs;
use std::path::{Path, PathBuf};

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
    if !is_native_preview_audio_file(&canonical) {
        return Err("This file format is not supported by Windows embedded preview".into());
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

fn is_native_preview_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "wav" | "wave" | "aif" | "aiff" | "mp3"
            )
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_preview_accepts_required_windows_formats() {
        for name in ["mix.wav", "mix.WAVE", "mix.aif", "mix.AIFF", "mix.mp3"] {
            assert!(is_native_preview_audio_file(Path::new(name)), "{name}");
        }
        for name in ["mix.flac", "mix.m4a", "mix.aac", "mix.mp4", "notes.txt"] {
            assert!(!is_native_preview_audio_file(Path::new(name)), "{name}");
        }
    }

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
