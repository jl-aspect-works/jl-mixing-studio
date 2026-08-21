use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::automation_api::{
    invoke_api, resolve_command, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
    AUTOMATION_EXECUTABLE,
};
use crate::models::WorkspaceStatus;
use crate::workspace;
use crate::{
    find_project_summary, resolve_home, resolve_workspace_root, validated_project_directory,
};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionLifecycleSupport {
    pub available: bool,
    pub lifecycle_supported: bool,
    pub unapprove_supported: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionLifecycleRequest {
    pub client_id: String,
    pub project_id: String,
    pub revision: u32,
    pub action: RevisionLifecycleAction,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RevisionLifecycleAction {
    Close,
    Reopen,
    Unapprove,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionLifecycleResult {
    pub ok: bool,
    pub code: RevisionLifecycleCode,
    pub message: String,
    pub current_revision: Option<u32>,
    pub approved_revision: Option<u32>,
    pub delivered_revision: Option<u32>,
    pub lifecycle: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RevisionLifecycleCode {
    Updated,
    InvalidInput,
    AutomationUnavailable,
    CapabilityUnavailable,
    WorkspaceBlocked,
    ProjectUnavailable,
    RevisionUnavailable,
    Delivered,
    Rejected,
    Uncertain,
    Failed,
}

#[derive(Debug, Deserialize)]
struct DiscoveryDocument {
    api_version: Option<String>,
    application: Option<DiscoveryApplication>,
    capabilities: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct DiscoveryApplication {
    name: String,
    version: String,
}

fn blocked(code: RevisionLifecycleCode, message: impl Into<String>) -> RevisionLifecycleResult {
    RevisionLifecycleResult {
        ok: false,
        code,
        message: message.into(),
        current_revision: None,
        approved_revision: None,
        delivered_revision: None,
        lifecycle: None,
    }
}

pub fn support(app: &tauri::AppHandle) -> RevisionLifecycleSupport {
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return RevisionLifecycleSupport {
                available: false,
                lifecycle_supported: false,
                unapprove_supported: false,
                message,
            }
        }
    };
    let runner = SystemProcessRunner;
    let Some(executable) = resolve_command(&home, AUTOMATION_EXECUTABLE) else {
        return RevisionLifecycleSupport {
            available: false,
            lifecycle_supported: false,
            unapprove_supported: false,
            message:
                "JL Mixing Automation was not found in its default install location or on PATH"
                    .into(),
        };
    };
    let args = vec!["system-info".to_owned(), "--json".to_owned()];
    let output = match runner.run(&executable, &args, None) {
        Ok(output) if output.success => output,
        Ok(_) => {
            return RevisionLifecycleSupport {
                available: false,
                lifecycle_supported: false,
                unapprove_supported: false,
                message: "JL Mixing Automation capability discovery failed.".into(),
            }
        }
        Err(_) => {
            return RevisionLifecycleSupport {
                available: false,
                lifecycle_supported: false,
                unapprove_supported: false,
                message: "JL Mixing Automation capability discovery could not be started.".into(),
            }
        }
    };
    let Ok(discovery) = serde_json::from_str::<DiscoveryDocument>(output.stdout.trim()) else {
        return RevisionLifecycleSupport {
            available: false,
            lifecycle_supported: false,
            unapprove_supported: false,
            message: "JL Mixing Automation returned malformed capability discovery data.".into(),
        };
    };
    let Some(application) = discovery.application else {
        return RevisionLifecycleSupport {
            available: false,
            lifecycle_supported: false,
            unapprove_supported: false,
            message: "JL Mixing Automation capability discovery did not identify the provider."
                .into(),
        };
    };
    if discovery.api_version.as_deref() != Some("1.0") || application.name != AUTOMATION_EXECUTABLE
    {
        return RevisionLifecycleSupport {
            available: false,
            lifecycle_supported: false,
            unapprove_supported: false,
            message: format!(
                "JL Mixing Automation {} does not expose the required Automation API 1.0 contract.",
                application.version
            ),
        };
    }
    let capabilities = discovery.capabilities.unwrap_or_default();
    let has = |name: &str| capabilities.iter().any(|item| item == name);
    let lifecycle_supported = has("revision.close") && has("revision.reopen");
    let unapprove_supported = has("revision.unapprove");
    RevisionLifecycleSupport {
        available: true,
        lifecycle_supported,
        unapprove_supported,
        message: if lifecycle_supported && unapprove_supported {
            "Revision lifecycle controls are available.".into()
        } else {
            "Installed JL Mixing Automation does not advertise all revision lifecycle capabilities required by Studio.".into()
        },
    }
}

pub fn mutate(
    app: &tauri::AppHandle,
    request: RevisionLifecycleRequest,
) -> RevisionLifecycleResult {
    if request.client_id.trim().is_empty()
        || request.project_id.trim().is_empty()
        || request.revision == 0
    {
        return blocked(
            RevisionLifecycleCode::InvalidInput,
            "Select a valid revision before changing its state.",
        );
    }

    let support = support(app);
    if !support.available {
        return blocked(
            RevisionLifecycleCode::AutomationUnavailable,
            support.message,
        );
    }
    match request.action {
        RevisionLifecycleAction::Close | RevisionLifecycleAction::Reopen
            if !support.lifecycle_supported =>
        {
            return blocked(
                RevisionLifecycleCode::CapabilityUnavailable,
                "Installed JL Mixing Automation does not advertise revision close/reopen support.",
            )
        }
        RevisionLifecycleAction::Unapprove if !support.unapprove_supported => {
            return blocked(
                RevisionLifecycleCode::CapabilityUnavailable,
                "Installed JL Mixing Automation does not advertise revision unapprove support.",
            )
        }
        _ => {}
    }

    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => return blocked(RevisionLifecycleCode::Failed, message),
    };
    let workspace_path = match resolve_workspace_root(app) {
        Ok(path) => path,
        Err(message) => return blocked(RevisionLifecycleCode::Failed, message),
    };
    let before_snapshot = workspace::discover_workspace_at(&workspace_path);
    if before_snapshot.status != WorkspaceStatus::Healthy {
        return blocked(
            RevisionLifecycleCode::WorkspaceBlocked,
            "Resolve workspace issues before changing revision state.",
        );
    }
    let Some(before) = find_project_summary(
        &before_snapshot,
        request.client_id.trim(),
        request.project_id.trim(),
    )
    .cloned() else {
        return blocked(
            RevisionLifecycleCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace.",
        );
    };
    let Some(before_revision) = before
        .revisions
        .iter()
        .find(|item| item.number == request.revision)
    else {
        return blocked(
            RevisionLifecycleCode::RevisionUnavailable,
            "The selected revision is no longer available in the validated project.",
        );
    };
    match request.action {
        RevisionLifecycleAction::Close if before_revision.lifecycle == "closed" => {
            return blocked(
                RevisionLifecycleCode::Rejected,
                "The selected revision is already closed.",
            )
        }
        RevisionLifecycleAction::Reopen if before_revision.lifecycle == "open" => {
            return blocked(
                RevisionLifecycleCode::Rejected,
                "The selected revision is already open.",
            )
        }
        RevisionLifecycleAction::Unapprove
            if before.approved_revision != Some(request.revision) =>
        {
            return blocked(
                RevisionLifecycleCode::Rejected,
                "The selected revision is no longer the approved revision.",
            )
        }
        RevisionLifecycleAction::Unapprove
            if before.delivered_revision == Some(request.revision) =>
        {
            return blocked(
                RevisionLifecycleCode::Delivered,
                "This revision has been delivered. Resolve delivery state before unapproving it.",
            )
        }
        _ => {}
    }

    let Some(project_directory) = validated_project_directory(
        &workspace_path,
        &before_snapshot,
        request.client_id.trim(),
        request.project_id.trim(),
    ) else {
        return blocked(
            RevisionLifecycleCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely.",
        );
    };

    let (operation, command) = match request.action {
        RevisionLifecycleAction::Close => ("revision.close", "close"),
        RevisionLifecycleAction::Reopen => ("revision.reopen", "reopen"),
        RevisionLifecycleAction::Unapprove => ("revision.unapprove", "unapprove"),
    };
    let args = vec![
        "revision".to_owned(),
        command.to_owned(),
        "--json".to_owned(),
        "--project".to_owned(),
        project_directory.to_string_lossy().into_owned(),
        "--revision".to_owned(),
        request.revision.to_string(),
    ];
    let runner = SystemProcessRunner;
    let response =
        match invoke_api(&home, operation, &args, Some(&project_directory), &runner) {
            Ok(response) if response.status == ApiStatus::Success => response,
            Ok(response) => {
                let message = response
                    .errors
                    .first()
                    .map(|error| error.message.clone())
                    .unwrap_or_else(|| {
                        "JL Mixing Automation rejected the revision state change.".into()
                    });
                let code = if response
                    .errors
                    .first()
                    .is_some_and(|error| error.code == "REVISION_DELIVERED")
                {
                    RevisionLifecycleCode::Delivered
                } else {
                    RevisionLifecycleCode::Rejected
                };
                return blocked(code, message);
            }
            Err(ApiCallError::Unavailable) => return blocked(
                RevisionLifecycleCode::AutomationUnavailable,
                "JL Mixing Automation was not found in its default install location or on PATH.",
            ),
            Err(error) => return blocked(RevisionLifecycleCode::Uncertain, error.message()),
        };

    let Some(returned_revision) = response
        .data
        .get("revision")
        .and_then(|value| value.get("number"))
        .and_then(Value::as_u64)
    else {
        return blocked(
            RevisionLifecycleCode::Uncertain,
            "Automation reported success, but Studio could not verify the affected revision.",
        );
    };
    if returned_revision != u64::from(request.revision) {
        return blocked(
            RevisionLifecycleCode::Uncertain,
            "Automation reported success for a different revision than the one selected.",
        );
    }

    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(
        &refreshed,
        request.client_id.trim(),
        request.project_id.trim(),
    ) else {
        return blocked(RevisionLifecycleCode::Uncertain, "The revision state may have changed, but the refreshed project could not be verified. Do not retry automatically.");
    };
    let Some(after_revision) = after
        .revisions
        .iter()
        .find(|item| item.number == request.revision)
    else {
        return blocked(RevisionLifecycleCode::Uncertain, "The revision state may have changed, but the refreshed revision could not be verified. Do not retry automatically.");
    };
    let verified = match request.action {
        RevisionLifecycleAction::Close => after_revision.lifecycle == "closed",
        RevisionLifecycleAction::Reopen => after_revision.lifecycle == "open",
        RevisionLifecycleAction::Unapprove => {
            after.approved_revision.is_none()
                && after_revision.approved_at.is_none()
                && after_revision.approved_by.is_none()
        }
    };
    if !verified {
        return blocked(RevisionLifecycleCode::Uncertain, "Automation reported success, but the refreshed revision state did not match the requested change. Do not retry automatically.");
    }

    RevisionLifecycleResult {
        ok: true,
        code: RevisionLifecycleCode::Updated,
        message: match request.action {
            RevisionLifecycleAction::Close => {
                format!("Revision {} was closed and verified.", request.revision)
            }
            RevisionLifecycleAction::Reopen => {
                format!("Revision {} was reopened and verified.", request.revision)
            }
            RevisionLifecycleAction::Unapprove => {
                format!("Revision {} was unapproved and verified.", request.revision)
            }
        },
        current_revision: Some(after.current_revision),
        approved_revision: after.approved_revision,
        delivered_revision: after.delivered_revision,
        lifecycle: Some(after_revision.lifecycle.clone()),
    }
}
