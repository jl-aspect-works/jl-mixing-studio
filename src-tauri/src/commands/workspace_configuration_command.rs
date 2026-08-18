use std::fs;
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::models::{WorkspaceConfiguration, WorkspaceSnapshot, WorkspaceStatus};
use crate::workspace;

const WORKSPACE_CONFIG_FILE: &str = "workspace.json";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredWorkspaceConfiguration {
    workspace_path: String,
}

pub(crate) fn default_workspace_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map(|home| home.join("Music").join("Mixes"))
        .map_err(|_| "The current user's home directory could not be resolved".to_owned())
}

fn configuration_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(WORKSPACE_CONFIG_FILE))
        .map_err(|_| "Studio's local configuration directory could not be resolved".to_owned())
}

fn read_stored_configuration(path: &Path) -> Result<Option<StoredWorkspaceConfiguration>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)
        .map_err(|_| "Studio's saved workspace configuration could not be read".to_owned())?;
    let stored: StoredWorkspaceConfiguration = serde_json::from_str(&content)
        .map_err(|_| "Studio's saved workspace configuration is invalid".to_owned())?;
    let workspace_path = PathBuf::from(stored.workspace_path.trim());
    if !workspace_path.is_absolute() {
        return Err("Studio's saved workspace path is not absolute".to_owned());
    }
    Ok(Some(StoredWorkspaceConfiguration {
        workspace_path: workspace_path.to_string_lossy().into_owned(),
    }))
}

pub(crate) fn workspace_configuration(
    app: &tauri::AppHandle,
) -> Result<WorkspaceConfiguration, String> {
    let config_path = configuration_path(app)?;
    if let Some(stored) = read_stored_configuration(&config_path)? {
        return Ok(WorkspaceConfiguration {
            workspace_path: stored.workspace_path,
            configured: true,
        });
    }
    Ok(WorkspaceConfiguration {
        workspace_path: default_workspace_root(app)?.to_string_lossy().into_owned(),
        configured: false,
    })
}

pub(crate) fn resolve_workspace_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(PathBuf::from(workspace_configuration(app)?.workspace_path))
}

fn candidate_workspace(path: &str) -> Result<(PathBuf, WorkspaceSnapshot), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Choose an existing JL Mixing workspace folder".to_owned());
    }
    let candidate = PathBuf::from(trimmed);
    if !candidate.is_absolute() {
        return Err("Workspace paths must be absolute".to_owned());
    }
    let canonical = candidate
        .canonicalize()
        .map_err(|_| "The selected workspace is unavailable or cannot be accessed".to_owned())?;
    if !canonical.is_dir() {
        return Err("The selected workspace path is not a folder".to_owned());
    }
    let snapshot = workspace::discover_workspace_at(&canonical);
    if !matches!(
        snapshot.status,
        WorkspaceStatus::Healthy | WorkspaceStatus::Empty | WorkspaceStatus::Partial
    ) {
        let detail = snapshot
            .issues
            .first()
            .map(|issue| issue.message.as_str())
            .unwrap_or("The selected folder is not a valid JL Mixing workspace");
        return Err(format!("Workspace validation failed: {detail}"));
    }
    Ok((canonical, snapshot))
}

fn write_configuration(path: &Path, workspace_path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Studio's local configuration path is invalid")?;
    fs::create_dir_all(parent)
        .map_err(|_| "Studio's local configuration directory could not be created".to_owned())?;
    let stored = StoredWorkspaceConfiguration {
        workspace_path: workspace_path.to_string_lossy().into_owned(),
    };
    let content = serde_json::to_vec_pretty(&stored)
        .map_err(|_| "Studio's workspace configuration could not be encoded".to_owned())?;
    fs::write(path, content)
        .map_err(|_| "Studio's workspace configuration could not be saved".to_owned())
}

#[tauri::command]
pub(crate) fn get_workspace_configuration(
    app: tauri::AppHandle,
) -> Result<WorkspaceConfiguration, String> {
    workspace_configuration(&app)
}

#[tauri::command]
pub(crate) fn validate_workspace_root(path: String) -> Result<WorkspaceSnapshot, String> {
    candidate_workspace(&path).map(|(_, snapshot)| snapshot)
}

#[tauri::command]
pub(crate) fn set_workspace_root(
    app: tauri::AppHandle,
    path: String,
) -> Result<WorkspaceSnapshot, String> {
    // Revalidate immediately before persisting so a stale candidate can never become authority.
    let (canonical, snapshot) = candidate_workspace(&path)?;
    write_configuration(&configuration_path(&app)?, &canonical)?;
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn choose_workspace_folder() -> Result<Option<String>, String> {
    choose_workspace_folder_path().map(|selected| {
        selected.map(|path| path.to_string_lossy().into_owned())
    })
}

#[cfg(target_os = "macos")]
fn choose_workspace_folder_path() -> Result<Option<PathBuf>, String> {
    let output = Command::new("/usr/bin/osascript")
        .args([
            "-e",
            "try",
            "-e",
            "POSIX path of (choose folder with prompt \"Choose a folder\")",
            "-e",
            "on error number -128",
            "-e",
            "return \"\"",
            "-e",
            "end try",
        ])
        .output()
        .map_err(|error| format!("Unable to open the folder picker: {error}"))?;
    if !output.status.success() {
        return Err("Unable to open the folder picker".into());
    }
    let selected = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    Ok((!selected.is_empty()).then(|| PathBuf::from(selected)))
}

#[cfg(target_os = "windows")]
fn choose_workspace_folder_path() -> Result<Option<PathBuf>, String> {
    let script = r#"Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Choose a folder'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|error| format!("Unable to open the folder picker: {error}"))?;
    if !output.status.success() {
        return Err("Unable to open the folder picker".into());
    }
    let selected = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    Ok((!selected.is_empty()).then(|| PathBuf::from(selected)))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn choose_workspace_folder_path() -> Result<Option<PathBuf>, String> {
    Err("Folder selection is currently supported on macOS and Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn stored_configuration_requires_absolute_path() {
        let temp = tempdir().expect("tempdir");
        let config = temp.path().join(WORKSPACE_CONFIG_FILE);
        fs::write(&config, r#"{"workspacePath":"relative/Mixes"}"#).expect("write");
        let error = read_stored_configuration(&config).expect_err("relative path must fail");
        assert!(error.contains("not absolute"));
    }

    #[test]
    fn missing_configuration_is_distinct_from_invalid_configuration() {
        let temp = tempdir().expect("tempdir");
        let config = temp.path().join(WORKSPACE_CONFIG_FILE);
        assert!(read_stored_configuration(&config)
            .expect("missing is valid")
            .is_none());
        fs::write(&config, "not json").expect("write");
        assert!(read_stored_configuration(&config).is_err());
    }

    #[test]
    fn candidate_workspace_rejects_non_absolute_paths() {
        let error = candidate_workspace("Music/Mixes").expect_err("relative path must fail");
        assert_eq!(error, "Workspace paths must be absolute");
    }
}
