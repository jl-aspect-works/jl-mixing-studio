//! Studio creation workflow policy and authoritative post-create reconciliation.
//!
//! Studio creation is non-idempotent. A successful Automation response is reconciled against the
//! selected workspace before Studio reports completion; reconciliation failure is `Uncertain` so
//! callers do not blindly retry an operation that may already have completed.

use crate::cli;
use crate::models::{
    StudioCreationRequest, StudioOperationCode, StudioOperationResult, WorkspaceStatus,
};
use crate::workspace;

use super::super::resolve_home;

pub(crate) fn run_studio_operation(
    app: &tauri::AppHandle,
    request: StudioCreationRequest,
    operation: fn(&std::path::Path, StudioCreationRequest) -> StudioOperationResult,
    verify_after_creation: bool,
) -> StudioOperationResult {
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_studio_operation(StudioOperationCode::Failed, &message)
        }
    };
    let workspace_path = std::path::PathBuf::from(request.workspace_root.trim());
    if !workspace_path.is_absolute() {
        return cli::blocked_studio_operation(
            StudioOperationCode::InvalidInput,
            "Workspace paths must be absolute",
        );
    }
    let before = workspace::discover_workspace_at(&workspace_path);
    if before.status != WorkspaceStatus::Unavailable {
        return cli::blocked_studio_operation(
            StudioOperationCode::WorkspaceBlocked,
            "Choose a location where the new workspace does not already exist",
        );
    }
    let expected = request.clone();
    let result = operation(&home, request);
    if !verify_after_creation || !result.ok || result.code != StudioOperationCode::Created {
        return result;
    }
    let after = workspace::discover_workspace_at(&workspace_path);
    let Some(studio) = after.studio else {
        return uncertain_studio_result();
    };
    let engineer = expected.mix_engineer.unwrap_or_default().trim().to_owned();
    if after.status != WorkspaceStatus::Empty
        || studio.root_path != expected.workspace_root.trim()
        || studio.studio_name != expected.studio_name.trim()
        || studio.mix_engineer != engineer
        || studio.sample_rate != expected.sample_rate
        || studio.bit_depth != expected.bit_depth
        || studio.file_format != expected.file_format.trim().to_ascii_uppercase()
        || studio.change_directory_after_create
    {
        return uncertain_studio_result();
    }
    result
}

fn uncertain_studio_result() -> StudioOperationResult {
    cli::blocked_studio_operation(
        StudioOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the created studio could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}
