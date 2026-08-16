use super::resolve_home;
use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::cli;
use crate::models::{
    RevisionDescriptionUpdateRequest, RevisionDescriptionUpdateResult, WorkspaceStatus,
};
use crate::workspace;

#[tauri::command]
pub(crate) fn update_revision_description(
    app: tauri::AppHandle,
    request: RevisionDescriptionUpdateRequest,
) -> RevisionDescriptionUpdateResult {
    let home = match resolve_home(&app) {
        Ok(home) => home,
        Err(message) => return failed(&message),
    };
    let root = match resolve_workspace_root(&app) {
        Ok(root) => root,
        Err(message) => return failed(&message),
    };
    let snapshot = workspace::discover_workspace_at(&root);
    if snapshot.status != WorkspaceStatus::Healthy {
        return failed("Resolve workspace issues before editing a revision description.");
    }
    let Some(project_directory) = validated_project_directory(
        &root,
        &snapshot,
        request.client_id.trim(),
        request.project_id.trim(),
    ) else {
        return failed("The selected project could not be resolved safely.");
    };
    cli::update_revision_description(&home, &project_directory, request)
}

fn failed(message: &str) -> RevisionDescriptionUpdateResult {
    RevisionDescriptionUpdateResult {
        ok: false,
        message: message.to_owned(),
        revision: None,
    }
}
