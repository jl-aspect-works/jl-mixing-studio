use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::automation_api::{invoke_api, ApiStatus, SystemProcessRunner};
use crate::cli::{advertised_capabilities, invoke_with_progress, IntakeProgressEvent};
use crate::workspace::find_validated_project_path;
use crate::{resolve_home, resolve_workspace_root};

const IMPORT_PLAN_OPERATION: &str = "client.files.import.plan";
const IMPORT_EXECUTE_OPERATION: &str = "client.files.import.execute";
const IMPORT_PROGRESS_CAPABILITY: &str = "client.files.import.progress";
const RESET_PLAN_OPERATION: &str = "audio.prep.reset.plan";
const RESET_EXECUTE_OPERATION: &str = "audio.prep.reset.execute";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedImportRequest {
    pub client_id: String,
    pub project_id: String,
    pub source_kind: String,
    pub sources: Vec<String>,
    pub plan_id: Option<String>,
    #[serde(default)]
    pub decisions: HashMap<String, String>,
    #[serde(default)]
    pub selected_relative_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPrepResetRequest {
    pub client_id: String,
    pub project_id: String,
    pub relative_paths: Vec<String>,
    pub plan_id: Option<String>,
    #[serde(default)]
    pub decisions: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedOperationResult {
    pub ok: bool,
    pub status: String,
    pub message: String,
    pub data: Value,
}

fn project_directory(
    app: &AppHandle,
    client_id: &str,
    project_id: &str,
) -> Result<PathBuf, String> {
    let workspace = resolve_workspace_root(app)?;
    find_validated_project_path(&workspace, client_id.trim(), project_id.trim())
        .ok_or_else(|| "The selected project is unavailable or ambiguous.".to_owned())
}

fn status_name(status: ApiStatus) -> &'static str {
    match status {
        ApiStatus::Success => "success",
        ApiStatus::Planned => "planned",
        ApiStatus::Blocked => "blocked",
        ApiStatus::Error => "error",
    }
}

fn with_project_argument(project: &Path, mut arguments: Vec<String>) -> Vec<String> {
    arguments.insert(2, "--project".into());
    arguments.insert(3, project.to_string_lossy().into_owned());
    arguments
}

fn call_api(
    app: &AppHandle,
    project: &Path,
    operation: &str,
    arguments: Vec<String>,
) -> ManagedOperationResult {
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => {
            return ManagedOperationResult {
                ok: false,
                status: "error".into(),
                message,
                data: Value::Object(Default::default()),
            }
        }
    };
    let arguments = with_project_argument(project, arguments);
    match invoke_api(&home, operation, &arguments, None, &SystemProcessRunner) {
        Ok(response) => {
            let ok = matches!(response.status, ApiStatus::Success | ApiStatus::Planned);
            let message = response
                .errors
                .first()
                .map(|error| error.message.clone())
                .unwrap_or_default();
            ManagedOperationResult {
                ok,
                status: status_name(response.status).into(),
                message,
                data: response.data,
            }
        }
        Err(error) => ManagedOperationResult {
            ok: false,
            status: "error".into(),
            message: error.message(),
            data: Value::Object(Default::default()),
        },
    }
}

fn finish_streaming_response(
    response: crate::cli::StreamingAutomationResponse,
) -> ManagedOperationResult {
    let ok = matches!(response.status, ApiStatus::Success | ApiStatus::Planned);
    let message = response
        .errors
        .first()
        .map(|error| error.message.clone())
        .unwrap_or_default();
    ManagedOperationResult {
        ok,
        status: status_name(response.status).into(),
        message,
        data: response.data,
    }
}

fn supports_import_progress(home: &Path) -> bool {
    advertised_capabilities(home, &SystemProcessRunner).is_some_and(|capabilities| {
        capabilities
            .iter()
            .any(|value| value == IMPORT_PROGRESS_CAPABILITY)
    })
}

fn import_arguments(request: &ManagedImportRequest, execute: bool) -> Result<Vec<String>, String> {
    if !matches!(request.source_kind.as_str(), "zip" | "folder" | "files") {
        return Err("Import source kind must be zip, folder, or files.".into());
    }
    if request.sources.is_empty() {
        return Err("Select at least one import source.".into());
    }
    let mut arguments = vec![
        "client-files".into(),
        if execute {
            "import-execute"
        } else {
            "import-plan"
        }
        .into(),
        "--json".into(),
        "--source-kind".into(),
        request.source_kind.clone(),
    ];
    for source in &request.sources {
        arguments.push("--source".into());
        arguments.push(source.clone());
    }
    if execute {
        let plan_id = request
            .plan_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "The import plan is missing its plan ID.".to_owned())?;
        arguments.push("--plan-id".into());
        arguments.push(plan_id.clone());
        if let Some(selected_relative_paths) = &request.selected_relative_paths {
            if selected_relative_paths.is_empty() {
                return Err("Select at least one planned file to import.".into());
            }
            for relative_path in selected_relative_paths {
                arguments.push("--include-relative-path".into());
                arguments.push(relative_path.clone());
            }
        }
        if !request.decisions.is_empty() {
            arguments.push("--decisions-json".into());
            arguments.push(
                serde_json::to_string(&request.decisions)
                    .map_err(|_| "Import conflict decisions could not be encoded.".to_owned())?,
            );
        }
    }
    Ok(arguments)
}

fn reset_arguments(request: &AudioPrepResetRequest, execute: bool) -> Result<Vec<String>, String> {
    if request.relative_paths.is_empty() {
        return Err("Select at least one Client File.".into());
    }
    let mut arguments = vec![
        "audio-prep".into(),
        if execute {
            "reset-execute"
        } else {
            "reset-plan"
        }
        .into(),
        "--json".into(),
    ];
    for path in &request.relative_paths {
        arguments.push("--relative-path".into());
        arguments.push(path.clone());
    }
    if execute {
        let plan_id = request
            .plan_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "The Audio Prep plan is missing its plan ID.".to_owned())?;
        arguments.push("--plan-id".into());
        arguments.push(plan_id.clone());
        if !request.decisions.is_empty() {
            arguments.push("--decisions-json".into());
            arguments.push(
                serde_json::to_string(&request.decisions).map_err(|_| {
                    "Audio Prep conflict decisions could not be encoded.".to_owned()
                })?,
            );
        }
    }
    Ok(arguments)
}

fn request_error(message: String) -> ManagedOperationResult {
    ManagedOperationResult {
        ok: false,
        status: "error".into(),
        message,
        data: Value::Object(Default::default()),
    }
}

pub fn plan_import(app: &AppHandle, request: ManagedImportRequest) -> ManagedOperationResult {
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    match import_arguments(&request, false) {
        Ok(arguments) => call_api(app, &project, IMPORT_PLAN_OPERATION, arguments),
        Err(message) => request_error(message),
    }
}

pub fn execute_import_with_progress<F>(
    app: &AppHandle,
    request: ManagedImportRequest,
    on_progress: F,
) -> ManagedOperationResult
where
    F: FnMut(IntakeProgressEvent) + Send + 'static,
{
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let mut arguments = match import_arguments(&request, true) {
        Ok(arguments) => arguments,
        Err(message) => return request_error(message),
    };
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let total = request
        .selected_relative_paths
        .as_ref()
        .map_or(request.sources.len(), Vec::len);
    let mut on_progress = on_progress;
    on_progress(IntakeProgressEvent {
        operation: IMPORT_EXECUTE_OPERATION.into(),
        phase: "staging".into(),
        completed: 0,
        total: Some(total),
        active: Vec::new(),
    });
    if !supports_import_progress(&home) {
        return call_api(app, &project, IMPORT_EXECUTE_OPERATION, arguments);
    }
    arguments.push("--progress=stderr-json".into());
    let arguments = with_project_argument(&project, arguments);
    match invoke_with_progress(&home, &arguments, IMPORT_EXECUTE_OPERATION, on_progress) {
        Ok(response) => finish_streaming_response(response),
        Err(error) => ManagedOperationResult {
            ok: false,
            status: "error".into(),
            message: error.message(),
            data: Value::Object(Default::default()),
        },
    }
}

pub fn plan_reset(app: &AppHandle, request: AudioPrepResetRequest) -> ManagedOperationResult {
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    match reset_arguments(&request, false) {
        Ok(arguments) => call_api(app, &project, RESET_PLAN_OPERATION, arguments),
        Err(message) => request_error(message),
    }
}

pub fn execute_reset(app: &AppHandle, request: AudioPrepResetRequest) -> ManagedOperationResult {
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    match reset_arguments(&request, true) {
        Ok(arguments) => call_api(app, &project, RESET_EXECUTE_OPERATION, arguments),
        Err(message) => request_error(message),
    }
}

pub fn choose_import_sources(source_kind: &str) -> Result<Vec<String>, String> {
    match source_kind {
        "zip" => Ok(rfd::FileDialog::new()
            .add_filter("ZIP archives", &["zip"])
            .pick_file()
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect()),
        "folder" => Ok(rfd::FileDialog::new()
            .pick_folder()
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect()),
        "files" => Ok(rfd::FileDialog::new()
            .pick_files()
            .unwrap_or_default()
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect()),
        _ => Err("Import source kind must be zip, folder, or files.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::with_project_argument;
    use std::path::Path;

    #[test]
    fn managed_operations_supply_explicit_project_path() {
        let project = Path::new(r"\\NAS\media\Mixes\Clients\Client\Projects\Project");
        let arguments = vec![
            "client-files".into(),
            "import-plan".into(),
            "--json".into(),
            "--source-kind".into(),
            "files".into(),
        ];

        let arguments = with_project_argument(project, arguments);

        assert_eq!(arguments[0], "client-files");
        assert_eq!(arguments[1], "import-plan");
        assert_eq!(arguments[2], "--project");
        assert_eq!(arguments[3], project.to_string_lossy());
        assert!(arguments.iter().any(|argument| argument == "--json"));
    }
}
