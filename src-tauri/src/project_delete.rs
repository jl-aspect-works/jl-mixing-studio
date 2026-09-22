use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::automation_api::{invoke_api, ApiStatus, SystemProcessRunner};
use crate::cli::advertised_capabilities;
use crate::commands::revision_listening::stop_project_and_wait;
use crate::{resolve_home, resolve_workspace_root};

const PLAN_CAPABILITY: &str = "project.delete.plan";
const EXECUTE_CAPABILITY: &str = "project.delete.execute";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDeleteRequest {
    pub client_id: String,
    pub project_id: String,
    pub fingerprint: Option<String>,
    pub confirmed_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDeleteResult {
    pub ok: bool,
    pub status: String,
    pub message: String,
    pub data: Value,
}

pub fn supported(app: &AppHandle) -> bool {
    resolve_home(app)
        .ok()
        .and_then(|home| advertised_capabilities(&home, &SystemProcessRunner))
        .is_some_and(|capabilities| {
            capabilities.iter().any(|value| value == PLAN_CAPABILITY)
                && capabilities
                    .iter()
                    .any(|value| value == EXECUTE_CAPABILITY)
        })
}

fn result(app: &AppHandle, request: &ProjectDeleteRequest, execute: bool) -> ProjectDeleteResult {
    let operation = if execute {
        EXECUTE_CAPABILITY
    } else {
        PLAN_CAPABILITY
    };
    let action = if execute {
        "delete-execute"
    } else {
        "delete-plan"
    };
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return failure(message),
    };
    let workspace = match resolve_workspace_root(app) {
        Ok(value) => value,
        Err(message) => return failure(message),
    };
    let capabilities = advertised_capabilities(&home, &SystemProcessRunner).unwrap_or_default();
    if !capabilities.iter().any(|value| value == operation) {
        return failure(
            "Installed JL Mixing Automation does not support safe project deletion.".into(),
        );
    }
    let mut arguments = vec![
        "project".into(),
        action.into(),
        "--json".into(),
        "--workspace".into(),
        workspace.to_string_lossy().into_owned(),
        "--client-id".into(),
        request.client_id.trim().into(),
        "--project-id".into(),
        request.project_id.trim().into(),
    ];
    if execute {
        arguments.extend([
            "--fingerprint".into(),
            request.fingerprint.clone().unwrap_or_default(),
            "--confirm-name".into(),
            request.confirmed_name.clone().unwrap_or_default(),
        ]);
    }
    match invoke_api(&home, operation, &arguments, None, &SystemProcessRunner) {
        Ok(response) => ProjectDeleteResult {
            ok: matches!(response.status, ApiStatus::Success | ApiStatus::Planned),
            status: match response.status {
                ApiStatus::Success => "success",
                ApiStatus::Planned => "planned",
                ApiStatus::Blocked => "blocked",
                ApiStatus::Error => "error",
            }
            .into(),
            message: response
                .errors
                .first()
                .map(|error| error.message.clone())
                .unwrap_or_default(),
            data: response.data,
        },
        Err(error) => failure(error.message()),
    }
}

pub fn plan(app: &AppHandle, request: ProjectDeleteRequest) -> ProjectDeleteResult {
    result(app, &request, false)
}

pub fn execute(app: &AppHandle, request: ProjectDeleteRequest) -> ProjectDeleteResult {
    if request.fingerprint.as_deref().unwrap_or("").is_empty()
        || request.confirmed_name.as_deref().unwrap_or("").is_empty()
    {
        return failure("Review the deletion summary and type the exact Project Name.".into());
    }
    if let Err(message) =
        stop_project_and_wait(app, request.client_id.trim(), request.project_id.trim())
    {
        return failure(message);
    }
    result(app, &request, true)
}

fn failure(message: String) -> ProjectDeleteResult {
    ProjectDeleteResult {
        ok: false,
        status: "error".into(),
        message,
        data: Value::Object(Default::default()),
    }
}
