use super::resolve_workspace_root;
use super::workspace_command_support::{find_project_summary, validated_project_directory};
use crate::models::{
    RevisionNotesDocument, RevisionNotesRequest, RevisionNotesUpdateRequest, WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub(crate) const REVISION_NOTES_MAX_BYTES: usize = 65_536;

#[tauri::command]
pub(crate) fn get_revision_notes(
    app: tauri::AppHandle,
    request: RevisionNotesRequest,
) -> Result<RevisionNotesDocument, String> {
    let path = resolve_revision_notes_path_for_read(
        &app,
        &request.client_id,
        &request.project_id,
        request.revision,
    )?;
    read_revision_notes(&path)
}

#[tauri::command]
pub(crate) fn update_revision_notes(
    app: tauri::AppHandle,
    request: RevisionNotesUpdateRequest,
) -> Result<RevisionNotesDocument, String> {
    if request.content.len() > REVISION_NOTES_MAX_BYTES {
        return Err(format!(
            "Revision Notes must not exceed {REVISION_NOTES_MAX_BYTES} bytes"
        ));
    }
    let path = resolve_revision_notes_path(
        &app,
        &request.client_id,
        &request.project_id,
        request.revision,
        false,
    )?;
    write_revision_notes(&path, &request.content)?;
    let saved = read_revision_notes(&path)?;
    if saved.content != request.content {
        return Err("Revision Notes were written but could not be verified exactly".into());
    }
    Ok(saved)
}

fn resolve_revision_notes_path_for_read(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
    revision: u32,
) -> Result<PathBuf, String> {
    if revision == 0 {
        return Err("Revision number must be greater than zero".into());
    }
    let root = resolve_workspace_root(app)?;
    let project_path = workspace::find_validated_project_path(
        &root,
        client_id.trim(),
        project_id.trim(),
    )
    .ok_or("The selected project directory could not be resolved safely")?;
    resolve_revision_notes_under_project(&project_path, revision)
}

fn resolve_revision_notes_path(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
    revision: u32,
    allow_partial: bool,
) -> Result<PathBuf, String> {
    if revision == 0 {
        return Err("Revision number must be greater than zero".into());
    }
    let root = resolve_workspace_root(app)?;
    let snapshot = workspace::discover_workspace_at(&root);
    if snapshot.status != WorkspaceStatus::Healthy
        && !(allow_partial && snapshot.status == WorkspaceStatus::Partial)
    {
        return Err("Resolve workspace issues before editing Revision Notes".into());
    }
    let project = find_project_summary(&snapshot, client_id.trim(), project_id.trim())
        .ok_or("The selected project is no longer available in the validated workspace")?;
    if !project.revisions.iter().any(|item| item.number == revision) {
        return Err(format!("Revision {revision} is no longer available"));
    }
    let project_path =
        validated_project_directory(&root, &snapshot, client_id.trim(), project_id.trim())
            .ok_or("The selected project directory could not be resolved safely")?;
    resolve_revision_notes_under_project(&project_path, revision)
}

fn resolve_revision_notes_under_project(
    project_path: &Path,
    revision: u32,
) -> Result<PathBuf, String> {
    let canonical_project = project_path
        .canonicalize()
        .map_err(|_| "The project folder is unavailable")?;
    let revision_path = project_path
        .join("04_Revisions")
        .join(format!("Revision_{revision:02}"));
    let metadata = fs::symlink_metadata(&revision_path)
        .map_err(|_| "The selected revision folder is unavailable")?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("The selected revision folder could not be resolved safely".into());
    }
    let canonical_revision = revision_path
        .canonicalize()
        .map_err(|_| "The selected revision folder could not be resolved safely")?;
    if !canonical_revision.starts_with(&canonical_project) {
        return Err("The selected revision folder could not be resolved safely".into());
    }
    let notes_path = canonical_revision.join("Revision_Notes.md");
    let metadata = fs::symlink_metadata(&notes_path)
        .map_err(|_| "Revision_Notes.md is missing from the selected revision")?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Revision_Notes.md could not be resolved safely".into());
    }
    let canonical_notes = notes_path
        .canonicalize()
        .map_err(|_| "Revision_Notes.md could not be resolved safely")?;
    if !canonical_notes.starts_with(&canonical_revision) {
        return Err("Revision_Notes.md could not be resolved safely".into());
    }
    Ok(canonical_notes)
}

pub(crate) fn read_revision_notes(path: &std::path::Path) -> Result<RevisionNotesDocument, String> {
    let metadata = fs::metadata(path).map_err(|_| "Revision Notes could not be read")?;
    if metadata.len() > REVISION_NOTES_MAX_BYTES as u64 {
        return Err(format!(
            "Revision Notes exceed the {REVISION_NOTES_MAX_BYTES}-byte editor limit"
        ));
    }
    let content = fs::read_to_string(path)
        .map_err(|_| "Revision Notes must be a readable UTF-8 Markdown file")?;
    Ok(RevisionNotesDocument {
        content,
        max_bytes: REVISION_NOTES_MAX_BYTES,
    })
}

pub(crate) fn write_revision_notes(path: &std::path::Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Revision Notes do not have a valid parent folder")?;
    let temporary = parent.join(format!(
        ".Revision_Notes.md.jl-mixing-studio-{}.tmp",
        std::process::id()
    ));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "A Revision Notes save is already pending or could not be started")?;
    if let Err(error) = file
        .write_all(content.as_bytes())
        .and_then(|_| file.sync_all())
    {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Revision Notes could not be saved: {error}"));
    }
    drop(file);
    replace_revision_notes_file(&temporary, path)
}

#[cfg(not(target_os = "windows"))]
fn replace_revision_notes_file(
    temporary: &std::path::Path,
    path: &std::path::Path,
) -> Result<(), String> {
    fs::rename(temporary, path).map_err(|error| {
        let _ = fs::remove_file(temporary);
        format!("Revision Notes could not be replaced safely: {error}")
    })
}

#[cfg(target_os = "windows")]
fn replace_revision_notes_file(
    temporary: &std::path::Path,
    path: &std::path::Path,
) -> Result<(), String> {
    let backup = path.with_file_name(".Revision_Notes.md.jl-mixing-studio.backup");
    if backup.exists() {
        let _ = fs::remove_file(temporary);
        return Err("A prior Revision Notes backup requires manual review".into());
    }
    fs::rename(path, &backup).map_err(|error| {
        let _ = fs::remove_file(temporary);
        format!("Revision Notes could not be prepared for replacement: {error}")
    })?;
    if let Err(error) = fs::rename(temporary, path) {
        let _ = fs::rename(&backup, path);
        let _ = fs::remove_file(temporary);
        return Err(format!(
            "Revision Notes could not be replaced safely: {error}"
        ));
    }
    fs::remove_file(&backup).map_err(|error| {
        format!("Revision Notes were saved, but the backup could not be removed: {error}")
    })
}
