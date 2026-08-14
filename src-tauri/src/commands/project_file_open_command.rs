use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{ProjectFileMutationRequest, ProjectFileMutationResult, WorkspaceStatus};
use crate::workspace;
use std::fs;
use std::path::{Path, PathBuf};

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
            path.parent().ok_or("The selected project file has no parent folder")?
        };
        std::process::Command::new("xdg-open").arg(directory).status()
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
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "jl-mixing-studio-project-open-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn resolves_regular_project_entries_but_rejects_traversal() {
        let project = TestDirectory::new();
        let folder = project.0.join("01_Client_Files/References");
        fs::create_dir_all(&folder).expect("create folder");
        fs::write(folder.join("reference.wav"), b"audio").expect("create file");

        let (resolved, relative) = resolve_project_entry(
            &project.0,
            "01_Client_Files/References/reference.wav",
        )
        .expect("resolve project file");
        assert!(resolved.is_file());
        assert_eq!(relative, "01_Client_Files/References/reference.wav");
        assert!(resolve_project_entry(&project.0, "../outside.wav").is_err());
        assert!(resolve_project_entry(&project.0, "/absolute.wav").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_entries_and_symlink_path_components() {
        use std::os::unix::fs::symlink;

        let project = TestDirectory::new();
        let outside = TestDirectory::new();
        fs::create_dir_all(project.0.join("01_Client_Files/References")).expect("create references");
        fs::write(outside.0.join("outside.wav"), b"audio").expect("create outside file");
        symlink(
            outside.0.join("outside.wav"),
            project.0.join("01_Client_Files/References/link.wav"),
        )
        .expect("create symlink");

        assert!(resolve_project_entry(
            &project.0,
            "01_Client_Files/References/link.wav",
        )
        .is_err());
    }
}
