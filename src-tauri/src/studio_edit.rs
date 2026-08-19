use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::AppHandle;

use crate::automation_api::{invoke_api, resolve_command, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner, AUTOMATION_EXECUTABLE};
use crate::models::{StudioEditInfo, StudioUpdateCode, StudioUpdateRequest, StudioUpdateResult};
use crate::{resolve_home, resolve_workspace_root};

fn studio_file(workspace: &Path) -> PathBuf {
    workspace.join("Studio").join("studio.json")
}

fn read_edit_metadata(workspace: &Path) -> Result<(String, String), String> {
    let path = studio_file(workspace);
    if path.is_symlink() || !path.is_file() {
        return Err("Studio configuration is unavailable or unsafe.".into());
    }
    let text = fs::read_to_string(&path).map_err(|_| "Studio configuration could not be read.".to_owned())?;
    let document: Value = serde_json::from_str(&text).map_err(|_| "Studio configuration is not valid JSON.".to_owned())?;
    let metadata = document.get("metadata").and_then(Value::as_object).ok_or_else(|| "Studio metadata is unavailable.".to_owned())?;
    let document_id = metadata.get("document_id").and_then(Value::as_str).unwrap_or_default().to_owned();
    let last_modified_at = metadata.get("last_modified_at").and_then(Value::as_str).unwrap_or_default().to_owned();
    if document_id.is_empty() || last_modified_at.is_empty() {
        return Err("Studio conflict metadata is incomplete.".into());
    }
    Ok((document_id, last_modified_at))
}

fn discovery_supports_update(home: &Path) -> Result<bool, String> {
    let executable = resolve_command(home, AUTOMATION_EXECUTABLE)
        .ok_or_else(|| "JL Mixing Automation was not found.".to_owned())?;
    let arguments = vec!["system-info".to_owned(), "--json".to_owned()];
    let output = SystemProcessRunner
        .run(&executable, &arguments, None)
        .map_err(|_| "JL Mixing Automation discovery could not be started.".to_owned())?;
    if !output.success {
        return Err("JL Mixing Automation discovery failed.".into());
    }
    let document: Value = serde_json::from_str(output.stdout.trim())
        .map_err(|_| "JL Mixing Automation returned malformed discovery data.".to_owned())?;
    let supported = document
        .get("capabilities")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.as_str() == Some("studio.update")));
    Ok(supported)
}

pub fn get_studio_edit_info(app: &AppHandle) -> Result<StudioEditInfo, String> {
    let home = resolve_home(app)?;
    let workspace = resolve_workspace_root(app)?;
    let (document_id, last_modified_at) = read_edit_metadata(&workspace)?;
    match discovery_supports_update(&home) {
        Ok(true) => Ok(StudioEditInfo {
            update_supported: true,
            document_id,
            last_modified_at,
            message: "Studio editing is available.".into(),
        }),
        Ok(false) => Ok(StudioEditInfo {
            update_supported: false,
            document_id,
            last_modified_at,
            message: "The installed JL Mixing Automation does not advertise studio.update.".into(),
        }),
        Err(message) => Ok(StudioEditInfo {
            update_supported: false,
            document_id,
            last_modified_at,
            message,
        }),
    }
}

fn blocked(code: StudioUpdateCode, message: impl Into<String>) -> StudioUpdateResult {
    StudioUpdateResult { ok: false, code, message: message.into() }
}

pub fn update_studio(app: &AppHandle, request: StudioUpdateRequest) -> StudioUpdateResult {
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return blocked(StudioUpdateCode::Failed, message),
    };
    let workspace = match resolve_workspace_root(app) {
        Ok(value) => value,
        Err(message) => return blocked(StudioUpdateCode::Failed, message),
    };
    let (_, current_modified) = match read_edit_metadata(&workspace) {
        Ok(value) => value,
        Err(message) => return blocked(StudioUpdateCode::Failed, message),
    };
    if current_modified != request.expected_last_modified_at {
        return blocked(
            StudioUpdateCode::Conflict,
            "Studio settings changed outside this edit session. Refresh and review the newer values before saving.",
        );
    }
    match discovery_supports_update(&home) {
        Ok(true) => {}
        Ok(false) => return blocked(StudioUpdateCode::UnsupportedCapability, "The installed JL Mixing Automation does not support Studio editing."),
        Err(message) => return blocked(StudioUpdateCode::AutomationUnavailable, message),
    }

    if request.studio_name.trim().is_empty() {
        return blocked(StudioUpdateCode::InvalidInput, "Studio name is required.");
    }
    if request.delivery_method.trim().is_empty() {
        return blocked(StudioUpdateCode::InvalidInput, "Delivery method is required.");
    }
    if request.requested_deliverables.is_empty() {
        return blocked(StudioUpdateCode::InvalidInput, "Select at least one requested deliverable.");
    }

    let arguments = vec![
        "studio".into(), "update".into(), "--json".into(),
        "--studio".into(), workspace.to_string_lossy().into_owned(),
        "--name".into(), request.studio_name.trim().into(),
        "--engineer".into(), request.mix_engineer.trim().into(),
        "--sample-rate".into(), request.sample_rate.to_string(),
        "--bit-depth".into(), request.bit_depth.to_string(),
        "--file-format".into(), request.file_format.trim().to_ascii_uppercase(),
        "--delivery-method".into(), request.delivery_method.trim().into(),
        "--deliverables".into(), request.requested_deliverables.join(","),
    ];

    match invoke_api(&home, "studio.update", &arguments, Some(&workspace), &SystemProcessRunner) {
        Ok(response) if response.status == ApiStatus::Success => {
            match read_edit_metadata(&workspace) {
                Ok((_, modified)) if modified != request.expected_last_modified_at => StudioUpdateResult {
                    ok: true,
                    code: StudioUpdateCode::Updated,
                    message: "Studio settings were updated and verified.".into(),
                },
                _ => blocked(StudioUpdateCode::Uncertain, "Automation reported success, but Studio could not verify the updated authoritative metadata. Refresh before retrying."),
            }
        }
        Ok(response) => {
            let message = response.errors.first().map(|error| error.message.clone()).unwrap_or_else(|| "JL Mixing Automation rejected the Studio update.".into());
            blocked(StudioUpdateCode::Rejected, message)
        }
        Err(ApiCallError::Unavailable) => blocked(StudioUpdateCode::AutomationUnavailable, "JL Mixing Automation was not found."),
        Err(error) => blocked(StudioUpdateCode::Failed, error.message()),
    }
}
