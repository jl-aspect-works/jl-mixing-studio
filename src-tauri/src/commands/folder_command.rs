use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{FolderLocation, FolderRequest, FolderResult, WorkspaceStatus};
use crate::workspace;
use std::path::{Path, PathBuf};

#[tauri::command]
pub(crate) fn resolve_folder(
    app: tauri::AppHandle,
    request: FolderRequest,
) -> Result<FolderResult, String> {
    let root = resolve_workspace_root(&app)?;
    let snapshot = workspace::discover_workspace_at(&root);
    if !matches!(
        snapshot.status,
        WorkspaceStatus::Healthy | WorkspaceStatus::Empty | WorkspaceStatus::Partial
    ) {
        return Err("Resolve workspace issues before opening folders".into());
    }
    let project_path = || {
        let client_id = request.client_id.as_deref()?;
        let project_id = request.project_id.as_deref()?;
        validated_project_directory(&root, &snapshot, client_id, project_id)
    };
    let path = match request.location {
        FolderLocation::Workspace => root.clone(),
        FolderLocation::Studio => root.join("Studio"),
        FolderLocation::Client => workspace::find_validated_client_path(
            &root,
            request.client_id.as_deref().unwrap_or_default(),
        )
        .ok_or("The client folder could not be resolved safely")?,
        FolderLocation::Project => {
            project_path().ok_or("The project folder could not be resolved safely")?
        }
        FolderLocation::Intake => intake_directory(
            &project_path().ok_or("The project folder could not be resolved safely")?,
        ),
        FolderLocation::AudioPrep => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("02_Audio_Preparation"),
        FolderLocation::References => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("01_Client_Files")
            .join("References"),
        FolderLocation::Revisions => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("04_Revisions"),
        FolderLocation::Delivery => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("05_Final_Delivery"),
    };
    let canonical = path
        .canonicalize()
        .map_err(|_| "The requested folder is unavailable")?;
    let canonical_root = root
        .canonicalize()
        .map_err(|_| "The workspace folder is unavailable")?;
    if !canonical.is_dir() || !canonical.starts_with(&canonical_root) {
        return Err("The requested folder could not be resolved safely".into());
    }
    Ok(FolderResult {
        path: user_visible_path(&canonical),
    })
}

fn user_visible_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    value.strip_prefix(r"\\?\").unwrap_or(&value).to_owned()
}

pub(crate) fn intake_directory(project_directory: &Path) -> PathBuf {
    project_directory
        .join("01_Client_Files")
        .join("Original_Delivery")
}

#[tauri::command]
pub(crate) fn open_folder(
    app: tauri::AppHandle,
    request: FolderRequest,
) -> Result<FolderResult, String> {
    let result = resolve_folder(app, request)?;

    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer.exe")
            .arg(&result.path)
            .spawn()
            .map_err(|_| "The operating-system folder window could not be opened")?;
        return Ok(result);
    }

    let mut command = if cfg!(target_os = "macos") {
        std::process::Command::new("open")
    } else {
        std::process::Command::new("xdg-open")
    };
    let status = command
        .arg(&result.path)
        .status()
        .map_err(|_| "The operating-system folder window could not be opened")?;
    if !status.success() {
        return Err("The operating-system folder window could not be opened".into());
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::user_visible_path;
    use std::path::Path;

    #[test]
    fn strips_windows_verbatim_drive_prefix_for_display() {
        assert_eq!(
            user_visible_path(Path::new(r"\\?\C:\Users\mix\Music\Mixes")),
            r"C:\Users\mix\Music\Mixes"
        );
    }

    #[test]
    fn converts_windows_verbatim_unc_prefix_for_display() {
        assert_eq!(
            user_visible_path(Path::new(r"\\?\UNC\server\share\Mixes")),
            r"\\server\share\Mixes"
        );
    }
}
