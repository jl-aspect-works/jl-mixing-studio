use super::workspace_command_support::resolve_home;
use crate::cli;
use crate::models::{DiscoveryCode, SystemInfo, VersionCheck, WorkspaceSnapshot};
use crate::workspace;

const INVALID_SCHEMA_RECOVERY: &str =
    "Validate or recreate the metadata file with a compatible JL Mixing Automation release.";

#[tauri::command]
pub(crate) fn get_system_info() -> SystemInfo {
    SystemInfo {
        operating_system: std::env::consts::OS.to_owned(),
        architecture: std::env::consts::ARCH.to_owned(),
    }
}

/// Executes one fixed, allowlisted JL Mixing Automation operation.
/// The frontend cannot choose the executable or supply arguments.
#[tauri::command]
pub(crate) fn get_jl_mixing_version(app: tauri::AppHandle) -> VersionCheck {
    match resolve_home(&app) {
        Ok(home) => cli::check_jl_mixing_version(&home),
        Err(message) => VersionCheck {
            available: false,
            supported: false,
            studio_creation_supported: false,
            client_creation_supported: false,
            project_creation_supported: false,
            intake_validation_supported: false,
            revision_creation_supported: false,
            revision_approval_supported: false,
            delivery_creation_supported: false,
            version: None,
            message,
        },
    }
}

fn current_recovery_guidance(mut snapshot: WorkspaceSnapshot) -> WorkspaceSnapshot {
    for issue in &mut snapshot.issues {
        if issue.code == DiscoveryCode::InvalidSchema {
            issue.recovery = INVALID_SCHEMA_RECOVERY.to_owned();
        }
    }
    snapshot
}

#[tauri::command]
pub(crate) fn discover_default_workspace(
    app: tauri::AppHandle,
) -> Result<WorkspaceSnapshot, String> {
    let home = resolve_home(&app)?;
    Ok(current_recovery_guidance(workspace::discover_workspace_at(
        &home.join("Music").join("Mixes"),
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        DiscoveryIssue, DiscoveryScope, WorkspaceCounts, WorkspaceStatus,
    };

    #[test]
    fn invalid_schema_recovery_does_not_pin_an_automation_product_version() {
        let snapshot = WorkspaceSnapshot {
            workspace_path: "/tmp/Mixes".into(),
            status: WorkspaceStatus::Invalid,
            studio: None,
            counts: WorkspaceCounts {
                clients: 0,
                projects: 0,
                issues: 1,
            },
            clients: Vec::new(),
            issues: vec![DiscoveryIssue {
                scope: DiscoveryScope::Studio,
                code: DiscoveryCode::InvalidSchema,
                display_name: None,
                relative_path: Some("Studio/studio.json".into()),
                message: "A JL Mixing metadata file does not match its supported schema".into(),
                recovery: "Validate or recreate the metadata file with JL Mixing Automation v1.2.0."
                    .into(),
            }],
            tasks: Vec::new(),
            activity: Vec::new(),
        };

        let updated = current_recovery_guidance(snapshot);
        assert_eq!(updated.issues[0].recovery, INVALID_SCHEMA_RECOVERY);
        assert!(!updated.issues[0].recovery.contains("v1.2.0"));
    }
}
