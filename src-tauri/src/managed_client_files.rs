use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::automation_api::{invoke_api, ApiStatus, SystemProcessRunner};
use crate::cli::{
    advertised_capabilities, invoke_with_progress, invoke_with_progress_input, IntakeProgressEvent,
};
use crate::workspace::find_validated_project_path;
use crate::{resolve_home, resolve_workspace_root};

const IMPORT_PLAN_OPERATION: &str = "client.files.import.plan";
const IMPORT_EXECUTE_OPERATION: &str = "client.files.import.execute";
const IMPORT_PROGRESS_CAPABILITY: &str = "client.files.import.progress";
const MANAGED_STDIN_CAPABILITY: &str = "managed.requests.stdinjson";
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

fn call_api_with_stdin(
    app: &AppHandle,
    project: &Path,
    operation: &str,
    arguments: Vec<String>,
    stdin_payload: &str,
) -> ManagedOperationResult {
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let arguments = with_project_argument(project, arguments);
    match invoke_with_progress_input(&home, &arguments, operation, Some(stdin_payload), |_| {}) {
        Ok(response) => finish_streaming_response(response),
        Err(error) => request_error(error.message()),
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

fn capabilities(home: &Path) -> Vec<String> {
    advertised_capabilities(home, &SystemProcessRunner).unwrap_or_default()
}

fn supports_import_progress(home: &Path) -> bool {
    capabilities(home)
        .iter()
        .any(|value| value == IMPORT_PROGRESS_CAPABILITY)
}

fn supports_managed_stdin(home: &Path) -> bool {
    capabilities(home)
        .iter()
        .any(|value| value == MANAGED_STDIN_CAPABILITY)
}

fn validate_import_request(request: &ManagedImportRequest, execute: bool) -> Result<(), String> {
    if !matches!(request.source_kind.as_str(), "zip" | "folder" | "files") {
        return Err("Import source kind must be zip, folder, or files.".into());
    }
    if request.sources.is_empty() {
        return Err("Select at least one import source.".into());
    }
    if execute {
        request
            .plan_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "The import plan is missing its plan ID.".to_owned())?;
        if request
            .selected_relative_paths
            .as_ref()
            .is_some_and(Vec::is_empty)
        {
            return Err("Select at least one planned file to import.".into());
        }
    }
    Ok(())
}

fn import_arguments(request: &ManagedImportRequest, execute: bool) -> Result<Vec<String>, String> {
    validate_import_request(request, execute)?;
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
        let plan_id = request.plan_id.as_ref().expect("validated plan id");
        arguments.push("--plan-id".into());
        arguments.push(plan_id.clone());
        if let Some(selected_relative_paths) = &request.selected_relative_paths {
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

fn import_stdin_request(
    request: &ManagedImportRequest,
    execute: bool,
) -> Result<(Vec<String>, String), String> {
    validate_import_request(request, execute)?;
    let mut arguments = vec![
        "client-files".into(),
        if execute {
            "import-execute"
        } else {
            "import-plan"
        }
        .into(),
        "--json".into(),
        "--request-stdin".into(),
        "--source-kind".into(),
        request.source_kind.clone(),
    ];
    if execute {
        arguments.push("--plan-id".into());
        arguments.push(request.plan_id.clone().expect("validated plan id"));
    }
    let payload = if execute {
        json!({
            "sources": request.sources,
            "selected_relative_paths": request.selected_relative_paths,
            "decisions": request.decisions,
        })
    } else {
        json!({
            "sources": request.sources,
        })
    };
    serde_json::to_string(&payload)
        .map(|payload| (arguments, payload))
        .map_err(|_| "Import request could not be encoded.".to_owned())
}

fn validate_reset_request(request: &AudioPrepResetRequest, execute: bool) -> Result<(), String> {
    if request.relative_paths.is_empty() {
        return Err("Select at least one Client File.".into());
    }
    if execute {
        request
            .plan_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "The Audio Prep plan is missing its plan ID.".to_owned())?;
    }
    Ok(())
}

fn reset_arguments(request: &AudioPrepResetRequest, execute: bool) -> Result<Vec<String>, String> {
    validate_reset_request(request, execute)?;
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
        let plan_id = request.plan_id.as_ref().expect("validated plan id");
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

fn reset_stdin_request(
    request: &AudioPrepResetRequest,
    execute: bool,
) -> Result<(Vec<String>, String), String> {
    validate_reset_request(request, execute)?;
    let mut arguments = vec![
        "audio-prep".into(),
        if execute {
            "reset-execute"
        } else {
            "reset-plan"
        }
        .into(),
        "--json".into(),
        "--request-stdin".into(),
    ];
    if execute {
        arguments.push("--plan-id".into());
        arguments.push(request.plan_id.clone().expect("validated plan id"));
    }
    let payload = if execute {
        json!({
            "relative_paths": request.relative_paths,
            "decisions": request.decisions,
        })
    } else {
        json!({
            "relative_paths": request.relative_paths,
        })
    };
    serde_json::to_string(&payload)
        .map(|payload| (arguments, payload))
        .map_err(|_| "Audio Prep request could not be encoded.".to_owned())
}

fn request_error(message: String) -> ManagedOperationResult {
    ManagedOperationResult {
        ok: false,
        status: "error".into(),
        message,
        data: Value::Object(Default::default()),
    }
}

pub fn plan_import_with_progress<F>(
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
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let progress = supports_import_progress(&home);
    if supports_managed_stdin(&home) {
        let (mut arguments, payload) = match import_stdin_request(&request, false) {
            Ok(value) => value,
            Err(message) => return request_error(message),
        };
        if progress {
            arguments.push("--progress=stderr-json".into());
        }
        let arguments = with_project_argument(&project, arguments);
        return match invoke_with_progress_input(
            &home,
            &arguments,
            IMPORT_PLAN_OPERATION,
            Some(&payload),
            on_progress,
        ) {
            Ok(response) => finish_streaming_response(response),
            Err(error) => request_error(error.message()),
        };
    }

    let mut arguments = match import_arguments(&request, false) {
        Ok(arguments) => arguments,
        Err(message) => return request_error(message),
    };
    if !progress {
        return call_api(app, &project, IMPORT_PLAN_OPERATION, arguments);
    }
    arguments.push("--progress=stderr-json".into());
    let arguments = with_project_argument(&project, arguments);
    match invoke_with_progress(&home, &arguments, IMPORT_PLAN_OPERATION, on_progress) {
        Ok(response) => finish_streaming_response(response),
        Err(error) => request_error(error.message()),
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
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let progress = supports_import_progress(&home);
    if supports_managed_stdin(&home) {
        let (mut arguments, payload) = match import_stdin_request(&request, true) {
            Ok(value) => value,
            Err(message) => return request_error(message),
        };
        if progress {
            arguments.push("--progress=stderr-json".into());
        }
        let arguments = with_project_argument(&project, arguments);
        return match invoke_with_progress_input(
            &home,
            &arguments,
            IMPORT_EXECUTE_OPERATION,
            Some(&payload),
            on_progress,
        ) {
            Ok(response) => finish_streaming_response(response),
            Err(error) => request_error(error.message()),
        };
    }

    let mut arguments = match import_arguments(&request, true) {
        Ok(arguments) => arguments,
        Err(message) => return request_error(message),
    };
    if !progress {
        return call_api(app, &project, IMPORT_EXECUTE_OPERATION, arguments);
    }
    arguments.push("--progress=stderr-json".into());
    let arguments = with_project_argument(&project, arguments);
    match invoke_with_progress(&home, &arguments, IMPORT_EXECUTE_OPERATION, on_progress) {
        Ok(response) => finish_streaming_response(response),
        Err(error) => request_error(error.message()),
    }
}

pub fn plan_reset(app: &AppHandle, request: AudioPrepResetRequest) -> ManagedOperationResult {
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    if supports_managed_stdin(&home) {
        match reset_stdin_request(&request, false) {
            Ok((arguments, payload)) => {
                call_api_with_stdin(app, &project, RESET_PLAN_OPERATION, arguments, &payload)
            }
            Err(message) => request_error(message),
        }
    } else {
        match reset_arguments(&request, false) {
            Ok(arguments) => call_api(app, &project, RESET_PLAN_OPERATION, arguments),
            Err(message) => request_error(message),
        }
    }
}

pub fn execute_reset(app: &AppHandle, request: AudioPrepResetRequest) -> ManagedOperationResult {
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    if supports_managed_stdin(&home) {
        match reset_stdin_request(&request, true) {
            Ok((arguments, payload)) => {
                call_api_with_stdin(app, &project, RESET_EXECUTE_OPERATION, arguments, &payload)
            }
            Err(message) => request_error(message),
        }
    } else {
        match reset_arguments(&request, true) {
            Ok(arguments) => call_api(app, &project, RESET_EXECUTE_OPERATION, arguments),
            Err(message) => request_error(message),
        }
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
    use super::{
        import_stdin_request, reset_stdin_request, with_project_argument, AudioPrepResetRequest,
        ManagedImportRequest,
    };
    use std::collections::HashMap;
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

    #[test]
    fn managed_stdin_keeps_argv_bounded_for_hundreds_of_files() {
        let sources = (0..500)
            .map(|index| format!(r"C:\delivery\{:04}-{}.wav", index, "long-name".repeat(12)))
            .collect::<Vec<_>>();
        let selected = (0..500)
            .map(|index| format!("{:04}-{}.wav", index, "long-name".repeat(12)))
            .collect::<Vec<_>>();
        let request = ManagedImportRequest {
            client_id: "client".into(),
            project_id: "project".into(),
            source_kind: "files".into(),
            sources,
            plan_id: Some("plan".into()),
            decisions: HashMap::new(),
            selected_relative_paths: Some(selected),
        };
        let (arguments, payload) = import_stdin_request(&request, true).expect("stdin request");
        assert!(arguments.len() < 12);
        assert!(arguments.iter().any(|value| value == "--request-stdin"));
        assert!(payload.len() > 50_000);

        let reset = AudioPrepResetRequest {
            client_id: "client".into(),
            project_id: "project".into(),
            relative_paths: (0..500)
                .map(|index| format!("track-{index:04}.wav"))
                .collect(),
            plan_id: Some("plan".into()),
            decisions: HashMap::new(),
        };
        let (reset_arguments, reset_payload) =
            reset_stdin_request(&reset, true).expect("reset stdin");
        assert!(reset_arguments.len() < 10);
        assert!(reset_payload.len() > 5_000);
    }
}

#[cfg(test)]
mod stdin_payload_contract_tests {
    use super::*;

    fn import_request() -> ManagedImportRequest {
        ManagedImportRequest {
            client_id: "client".into(),
            project_id: "project".into(),
            source_kind: "zip".into(),
            sources: vec!["mix.zip".into()],
            plan_id: Some("plan-1".into()),
            decisions: HashMap::from([("track.wav".into(), "replace".into())]),
            selected_relative_paths: Some(vec!["track.wav".into()]),
        }
    }

    fn reset_request() -> AudioPrepResetRequest {
        AudioPrepResetRequest {
            client_id: "client".into(),
            project_id: "project".into(),
            relative_paths: vec!["track.wav".into()],
            plan_id: Some("plan-2".into()),
            decisions: HashMap::from([("track.wav".into(), "replace".into())]),
        }
    }

    #[test]
    fn import_plan_stdin_payload_excludes_execute_only_fields() {
        let (arguments, payload) = import_stdin_request(&import_request(), false).unwrap();
        let payload: Value = serde_json::from_str(&payload).unwrap();

        assert!(arguments.contains(&"import-plan".to_owned()));
        assert_eq!(payload, json!({ "sources": ["mix.zip"] }));
        assert!(payload.get("selected_relative_paths").is_none());
        assert!(payload.get("decisions").is_none());
    }

    #[test]
    fn import_execute_stdin_payload_keeps_execute_fields() {
        let (arguments, payload) = import_stdin_request(&import_request(), true).unwrap();
        let payload: Value = serde_json::from_str(&payload).unwrap();

        assert!(arguments.contains(&"import-execute".to_owned()));
        assert_eq!(payload["sources"], json!(["mix.zip"]));
        assert_eq!(payload["selected_relative_paths"], json!(["track.wav"]));
        assert_eq!(payload["decisions"], json!({ "track.wav": "replace" }));
    }

    #[test]
    fn reset_plan_stdin_payload_excludes_execute_only_fields() {
        let (arguments, payload) = reset_stdin_request(&reset_request(), false).unwrap();
        let payload: Value = serde_json::from_str(&payload).unwrap();

        assert!(arguments.contains(&"reset-plan".to_owned()));
        assert_eq!(payload, json!({ "relative_paths": ["track.wav"] }));
        assert!(payload.get("decisions").is_none());
    }

    #[test]
    fn reset_execute_stdin_payload_keeps_execute_fields() {
        let (arguments, payload) = reset_stdin_request(&reset_request(), true).unwrap();
        let payload: Value = serde_json::from_str(&payload).unwrap();

        assert!(arguments.contains(&"reset-execute".to_owned()));
        assert_eq!(payload["relative_paths"], json!(["track.wav"]));
        assert_eq!(payload["decisions"], json!({ "track.wav": "replace" }));
    }
}
