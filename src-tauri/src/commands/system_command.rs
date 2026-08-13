use super::workspace_command_support::resolve_home;
use super::workspace_configuration::workspace_configuration;
use crate::cli;
use crate::models::{DiscoveryCode, SystemInfo, VersionCheck, WorkspaceSnapshot, WorkspaceStatus};
use crate::workspace;
use std::path::PathBuf;

const INVALID_SCHEMA_RECOVERY: &str =
    "Validate or recreate the metadata file with a compatible JL Mixing Automation release.";
const CONFIGURED_WORKSPACE_UNAVAILABLE_MESSAGE: &str =
    "The configured JL Mixing workspace is unavailable";
const CONFIGURED_WORKSPACE_UNAVAILABLE_RECOVERY: &str =
    "Reconnect the configured workspace or choose another workspace in Settings. Studio will keep this path configured until you change it.";

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

fn current_recovery_guidance(
    mut snapshot: WorkspaceSnapshot,
    explicitly_configured: bool,
) -> WorkspaceSnapshot {
    for issue in &mut snapshot.issues {
        if issue.code == DiscoveryCode::InvalidSchema {
            issue.recovery = INVALID_SCHEMA_RECOVERY.to_owned();
        }
        if explicitly_configured
            && snapshot.status == WorkspaceStatus::Unavailable
            && issue.code == DiscoveryCode::NotFound
        {
            issue.message = CONFIGURED_WORKSPACE_UNAVAILABLE_MESSAGE.to_owned();
            issue.recovery = CONFIGURED_WORKSPACE_UNAVAILABLE_RECOVERY.to_owned();
        }
    }
    snapshot
}

/// Legacy command name retained for the existing frontend contract. Discovery now uses the
/// machine-local configured workspace root, falling back to ~/Music/Mixes only when no explicit
/// workspace preference has ever been saved.
#[tauri::command]
pub(crate) fn discover_default_workspace(
    app: tauri::AppHandle,
) -> Result<WorkspaceSnapshot, String> {
    let configuration = workspace_configuration(&app)?;
    let root = PathBuf::from(&configuration.workspace_path);
    Ok(current_recovery_guidance(
        workspace::discover_workspace_at(&root),
        configuration.configured,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DiscoveryIssue, DiscoveryScope, WorkspaceCounts};

    fn unavailable_snapshot() -> WorkspaceSnapshot {
        WorkspaceSnapshot {
            workspace_path: "/Volumes/Shared/Mixes".into(),
            status: WorkspaceStatus::Unavailable,
            studio: None,
            counts: WorkspaceCounts {
                clients: 0,
                projects: 0,
                issues: 1,
            },
            clients: Vec::new(),
            issues: vec![DiscoveryIssue {
                scope: DiscoveryScope::Workspace,
                code: DiscoveryCode::NotFound,
                display_name: None,
                relative_path: None,
                message: "The default JL Mixing workspace was not found".into(),
                recovery: "Create ~/Music/Mixes.".into(),
            }],
            tasks: Vec::new(),
            activity: Vec::new(),
        }
    }

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
                recovery:
                    "Validate or recreate the metadata file with JL Mixing Automation v1.2.0."
                        .into(),
            }],
            tasks: Vec::new(),
            activity: Vec::new(),
        };

        let updated = current_recovery_guidance(snapshot, false);
        assert_eq!(updated.issues[0].recovery, INVALID_SCHEMA_RECOVERY);
        assert!(!updated.issues[0].recovery.contains("v1.2.0"));
    }

    #[test]
    fn configured_unavailable_workspace_does_not_suggest_default_creation() {
        let updated = current_recovery_guidance(unavailable_snapshot(), true);
        assert_eq!(
            updated.issues[0].message,
            CONFIGURED_WORKSPACE_UNAVAILABLE_MESSAGE
        );
        assert_eq!(
            updated.issues[0].recovery,
            CONFIGURED_WORKSPACE_UNAVAILABLE_RECOVERY
        );
        assert!(!updated.issues[0].recovery.contains("~/Music/Mixes"));
    }

    #[test]
    fn unavailable_default_workspace_keeps_default_setup_guidance() {
        let updated = current_recovery_guidance(unavailable_snapshot(), false);
        assert_eq!(
            updated.issues[0].message,
            "The default JL Mixing workspace was not found"
        );
        assert_eq!(updated.issues[0].recovery, "Create ~/Music/Mixes.");
    }
}
