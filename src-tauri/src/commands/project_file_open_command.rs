use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{
    ProjectAudioPreviewResult, ProjectFileMutationRequest, ProjectFileMutationResult,
    WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[tauri::command]
pub(crate) fn open_project_file(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let (path, relative_path) = resolve_project_entry(&project_directory, &request.relative_path)?;
    open_with_system(&path)?;
    Ok(ProjectFileMutationResult { relative_path })
}

#[tauri::command]
pub(crate) fn reveal_project_file(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let (path, relative_path) = resolve_project_entry(&project_directory, &request.relative_path)?;
    reveal_with_system(&path)?;
    Ok(ProjectFileMutationResult { relative_path })
}

#[tauri::command]
pub(crate) fn prepare_project_audio_preview(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectAudioPreviewResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let (path, relative_path) = resolve_project_entry(&project_directory, &request.relative_path)?;

    if !path.is_file() {
        return Err("Only regular project files can be previewed".into());
    }

    if !cfg!(target_os = "macos") {
        return Ok(ProjectAudioPreviewResult {
            supported: false,
            relative_path,
            file_path: None,
        });
    }

    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|error| format!("Unable to authorize this audio file for preview: {error}"))?;

    Ok(ProjectAudioPreviewResult {
        supported: true,
        relative_path,
        file_path: Some(path.to_string_lossy().into_owned()),
    })
}

fn resolve_project_directory(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
) -> Result<PathBuf, String> {
    let root = resolve_workspace_root(app)?;
    let snapshot = workspace::discover_workspace_at(&root);
    if !matches!(
        snapshot.status,
        WorkspaceStatus::Healthy | WorkspaceStatus::Empty | WorkspaceStatus::Partial
    ) {
        return Err("The configured workspace is unavailable; reconnect it and try again".into());
    }

    validated_project_directory(&root, &snapshot, client_id.trim(), project_id.trim())
        .ok_or_else(|| "The selected project could not be resolved safely".into())
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

fn resolve_project_entry(
    project_directory: &Path,
    relative_path: &str,
) -> Result<(PathBuf, String), String> {
    let normalized = normalize_relative_path(relative_path)?;
    let project_metadata = fs::symlink_metadata(project_directory)
        .map_err(|error| filesystem_error("inspect the project root", error))?;
    if project_metadata.file_type().is_symlink() || !project_metadata.is_dir() {
        return Err("The selected project root is unavailable or unsafe".into());
    }
    let canonical_project = project_directory
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the project root", error))?;

    let mut current = project_directory.to_path_buf();
    for component in normalized.split('/') {
        current.push(component);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| filesystem_error("resolve the selected project path", error))?;
        if metadata.file_type().is_symlink() {
            return Err("Symbolic-link project paths are not allowed".into());
        }
    }

    let metadata = fs::symlink_metadata(&current)
        .map_err(|error| filesystem_error("inspect the selected project entry", error))?;
    if metadata.file_type().is_symlink() || !(metadata.is_file() || metadata.is_dir()) {
        return Err("Only regular project files and folders can be opened or revealed".into());
    }

    let canonical = current
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the selected project entry", error))?;
    if !canonical.starts_with(&canonical_project) {
        return Err("The selected project entry could not be resolved safely".into());
    }

    Ok((canonical, normalized))
}

fn open_with_system(path: &Path) -> Result<(), String> {
    let mut command = if cfg!(target_os = "macos") {
        std::process::Command::new("open")
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
    } else {
        std::process::Command::new("xdg-open")
    };

    if cfg!(target_os = "windows") {
        command.args(["/C", "start", ""]);
    }
    let status = command
        .arg(path)
        .status()
        .map_err(|_| "The selected project entry could not be opened".to_owned())?;
    if !status.success() {
        return Err("The selected project entry could not be opened".into());
    }
    Ok(())
}

fn reveal_with_system(path: &Path) -> Result<(), String> {
    let status = if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", path.to_string_lossy()))
            .status()
    } else {
        let directory = if path.is_dir() {
            path
        } else {
            path.parent()
                .ok_or("The selected project file has no parent folder")?
        };
        std::process::Command::new("xdg-open")
            .arg(directory)
            .status()
    }
    .map_err(|_| "The selected project entry could not be revealed".to_owned())?;

    if !status.success() {
        return Err("The selected project entry could not be revealed".into());
    }
    Ok(())
}

fn filesystem_error(action: &str, error: std::io::Error) -> String {
    format!("Unable to {action}: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(tempfile::TempDir);

    impl TestDirectory {
        fn new() -> Self {
            Self(tempfile::tempdir().expect("create test directory"))
        }

        fn path(&self) -> &Path {
            self.0.path()
        }
    }

    #[test]
    fn resolves_regular_project_entries_but_rejects_traversal() {
        let project = TestDirectory::new();
        let folder = project.path().join("01_Client_Files/References");
        fs::create_dir_all(&folder).expect("create folder");
        fs::write(folder.join("reference.wav"), b"audio").expect("create file");

        let (resolved, relative) =
            resolve_project_entry(project.path(), "01_Client_Files/References/reference.wav")
                .expect("resolve project file");
        assert!(resolved.is_file());
        assert_eq!(relative, "01_Client_Files/References/reference.wav");
        assert!(resolve_project_entry(project.path(), "../outside.wav").is_err());
        assert!(resolve_project_entry(project.path(), "/absolute.wav").is_err());
    }

    #[test]
    fn preview_resolution_does_not_filter_regular_files_by_extension() {
        let project = TestDirectory::new();
        let folder = project.path().join("01_Client_Files/References");
        fs::create_dir_all(&folder).expect("create folder");
        fs::write(folder.join("reference.m4a"), b"audio").expect("create m4a");
        fs::write(folder.join("reference.ogg"), b"audio").expect("create ogg");

        for relative_path in [
            "01_Client_Files/References/reference.m4a",
            "01_Client_Files/References/reference.ogg",
        ] {
            let (resolved, _) = resolve_project_entry(project.path(), relative_path)
                .expect("preview candidate should resolve independently of extension");
            assert!(resolved.is_file());
        }
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_entries_and_symlink_path_components() {
        use std::os::unix::fs::symlink;

        let project = TestDirectory::new();
        let outside = TestDirectory::new();
        fs::create_dir_all(project.path().join("01_Client_Files/References"))
            .expect("create references");
        fs::write(outside.path().join("outside.wav"), b"audio").expect("create outside file");
        symlink(
            outside.path().join("outside.wav"),
            project.path().join("01_Client_Files/References/link.wav"),
        )
        .expect("create symlink");

        assert!(
            resolve_project_entry(project.path(), "01_Client_Files/References/link.wav",).is_err()
        );
    }
}
