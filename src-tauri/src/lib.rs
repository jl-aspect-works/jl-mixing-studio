mod automation_api;
mod cli;
mod client_edit;
mod commands;
mod derived;
mod intake;
mod managed_client_files;
mod models;
mod project_edit;
mod studio_edit;
mod workflows;
mod workspace;

use commands::{
    add_project_reference, choose_workspace_folder, delete_project_file, delete_project_reference,
    delete_revision_file, discover_default_workspace, get_delivery_notes, get_jl_mixing_version,
    get_revision_notes, get_system_info, get_workspace_configuration, list_project_files,
    open_folder, open_project_file, prepare_project_audio_preview, rename_project_file,
    rename_revision_file, resolve_folder, reveal_project_file, set_workspace_root,
    summarize_project_files, summarize_workspace_storage, update_delivery_notes,
    update_revision_description, update_revision_notes, validate_workspace_root,
};
pub(crate) use commands::{
    find_project_summary, resolve_home, resolve_workspace_root, validated_project_directory,
};
#[cfg(test)]
use commands::{
    intake_directory, read_delivery_notes, write_delivery_notes, DELIVERY_NOTES_MAX_BYTES,
};
use managed_client_files::{AudioPrepResetRequest, ManagedImportRequest, ManagedOperationResult};
use models::{
    ApprovalOperationResult, ClientCreationRequest, ClientEditInfo, ClientOperationResult,
    ClientUpdateRequest, ClientUpdateResult, DeliveryCreationRequest, DeliveryOperationResult,
    DeliveryPackageDeleteRequest, DeliveryStatusRequest, DeliveryStatusResult,
    IntakeOperationResult, IntakeRequest, ProjectCreationRequest, ProjectEditInfo,
    ProjectOperationResult, ProjectUpdateRequest, ProjectUpdateResult, RevisionApprovalRequest,
    RevisionCreationRequest, RevisionOperationResult, StudioCreationRequest, StudioEditInfo,
    StudioOperationResult, StudioUpdateRequest, StudioUpdateResult,
};
#[cfg(test)]
use models::{
    DeliveryCreationPreview, DeliveryReplacementMode, ProjectSummary, RevisionApprovalSummary,
    RevisionCreationSummary, WorkspaceStatus,
};
#[cfg(test)]
use std::{fs, path::Path};
#[cfg(test)]
use workflows::{
    list_delivery_entries, verify_delivery_artifacts, verify_delivery_creation,
    verify_revision_approval, verify_revision_creation, workspace_allows_client_creation,
    workspace_allows_delivery_creation, workspace_allows_intake_report_read,
    workspace_allows_intake_validation, workspace_allows_project_creation,
    workspace_allows_revision_approval, workspace_allows_revision_creation,
};
use workflows::{
    read_intake_report, run_approval_operation, run_client_operation, run_delivery_operation,
    run_intake_operation, run_project_operation, run_revision_operation, run_studio_operation,
};

#[tauri::command]
fn preflight_studio_creation(
    app: tauri::AppHandle,
    request: StudioCreationRequest,
) -> StudioOperationResult {
    run_studio_operation(&app, request, cli::preflight_studio_creation, false)
}

#[tauri::command]
fn create_studio(app: tauri::AppHandle, request: StudioCreationRequest) -> StudioOperationResult {
    run_studio_operation(&app, request, cli::create_studio, true)
}

#[tauri::command]
fn get_studio_edit_info(app: tauri::AppHandle) -> Result<StudioEditInfo, String> {
    studio_edit::get_studio_edit_info(&app)
}

#[tauri::command]
fn update_studio(app: tauri::AppHandle, request: StudioUpdateRequest) -> StudioUpdateResult {
    studio_edit::update_studio(&app, request)
}

#[tauri::command]
fn preflight_client_creation(
    app: tauri::AppHandle,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(&app, request, cli::preflight_client_creation)
}

#[tauri::command]
fn create_client(app: tauri::AppHandle, request: ClientCreationRequest) -> ClientOperationResult {
    run_client_operation(&app, request, cli::create_client)
}

#[tauri::command]
fn get_client_edit_info(
    app: tauri::AppHandle,
    client_id: String,
) -> Result<ClientEditInfo, String> {
    client_edit::get_client_edit_info(&app, &client_id)
}

#[tauri::command]
fn update_client(app: tauri::AppHandle, request: ClientUpdateRequest) -> ClientUpdateResult {
    client_edit::update_client(&app, request)
}

#[tauri::command]
fn preflight_project_creation(
    app: tauri::AppHandle,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(&app, request, cli::preflight_project_creation)
}

#[tauri::command]
fn create_project(
    app: tauri::AppHandle,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(&app, request, cli::create_project)
}

#[tauri::command]
fn get_project_edit_info(
    app: tauri::AppHandle,
    client_id: String,
    project_id: String,
) -> Result<ProjectEditInfo, String> {
    project_edit::get_project_edit_info(&app, &client_id, &project_id)
}

#[tauri::command]
fn update_project(app: tauri::AppHandle, request: ProjectUpdateRequest) -> ProjectUpdateResult {
    project_edit::update_project(&app, request)
}

#[tauri::command]
fn choose_managed_import_sources(source_kind: String) -> Result<Vec<String>, String> {
    managed_client_files::choose_import_sources(&source_kind)
}

#[tauri::command]
fn plan_managed_client_import(
    app: tauri::AppHandle,
    request: ManagedImportRequest,
) -> ManagedOperationResult {
    managed_client_files::plan_import(&app, request)
}

#[tauri::command]
fn execute_managed_client_import(
    app: tauri::AppHandle,
    request: ManagedImportRequest,
) -> ManagedOperationResult {
    managed_client_files::execute_import(&app, request)
}

#[tauri::command]
fn plan_audio_prep_reset(
    app: tauri::AppHandle,
    request: AudioPrepResetRequest,
) -> ManagedOperationResult {
    managed_client_files::plan_reset(&app, request)
}

#[tauri::command]
fn execute_audio_prep_reset(
    app: tauri::AppHandle,
    request: AudioPrepResetRequest,
) -> ManagedOperationResult {
    managed_client_files::execute_reset(&app, request)
}

#[tauri::command]
fn get_intake_report(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {
    read_intake_report(app, request)
}

#[tauri::command]
fn preflight_intake_validation(
    app: tauri::AppHandle,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::preflight_intake_validation)
}

#[tauri::command]
fn run_intake_validation(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::run_intake_validation)
}

#[tauri::command]
fn refresh_client_files_validation(
    app: tauri::AppHandle,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::refresh_client_files_validation)
}

#[tauri::command]
fn preflight_revision_creation(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::preflight_revision_creation, false)
}

#[tauri::command]
fn create_revision(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::create_revision, true)
}

#[tauri::command]
fn preflight_revision_approval(
    app: tauri::AppHandle,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(&app, request, cli::preflight_revision_approval, false)
}

#[tauri::command]
fn approve_revision(
    app: tauri::AppHandle,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(&app, request, cli::approve_revision, true)
}

#[tauri::command]
fn preflight_delivery_creation(
    app: tauri::AppHandle,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(&app, request, cli::preflight_delivery_creation, false)
}

#[tauri::command]
fn create_delivery(
    app: tauri::AppHandle,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(&app, request, cli::create_delivery, true)
}

fn resolve_delivery_project(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let home = resolve_home(app)?;
    let workspace_path = resolve_workspace_root(app)?;
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    let project_directory = validated_project_directory(
        &workspace_path,
        &snapshot,
        client_id.trim(),
        project_id.trim(),
    )
    .ok_or_else(|| "The selected project directory could not be resolved safely".to_owned())?;
    Ok((home, project_directory))
}

#[tauri::command]
fn get_delivery_status(
    app: tauri::AppHandle,
    request: DeliveryStatusRequest,
) -> DeliveryStatusResult {
    match resolve_delivery_project(&app, &request.client_id, &request.project_id) {
        Ok((home, project_directory)) => cli::get_delivery_status(&home, &project_directory),
        Err(message) => DeliveryStatusResult {
            ok: false,
            message,
            delivery: None,
        },
    }
}

#[tauri::command]
fn delete_delivery_package(
    app: tauri::AppHandle,
    request: DeliveryPackageDeleteRequest,
) -> DeliveryStatusResult {
    match resolve_delivery_project(&app, &request.client_id, &request.project_id) {
        Ok((home, project_directory)) => {
            cli::delete_delivery_package(&home, &project_directory, &request.zip_name)
        }
        Err(message) => DeliveryStatusResult {
            ok: false,
            message,
            delivery: None,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            get_workspace_configuration,
            choose_workspace_folder,
            validate_workspace_root,
            set_workspace_root,
            discover_default_workspace,
            resolve_folder,
            open_folder,
            list_project_files,
            summarize_project_files,
            summarize_workspace_storage,
            open_project_file,
            reveal_project_file,
            prepare_project_audio_preview,
            rename_project_file,
            delete_project_file,
            add_project_reference,
            delete_project_reference,
            rename_revision_file,
            delete_revision_file,
            get_revision_notes,
            update_revision_notes,
            update_revision_description,
            get_delivery_notes,
            update_delivery_notes,
            preflight_studio_creation,
            create_studio,
            get_studio_edit_info,
            update_studio,
            preflight_client_creation,
            create_client,
            get_client_edit_info,
            update_client,
            preflight_project_creation,
            create_project,
            get_project_edit_info,
            update_project,
            choose_managed_import_sources,
            plan_managed_client_import,
            execute_managed_client_import,
            plan_audio_prep_reset,
            execute_audio_prep_reset,
            get_intake_report,
            preflight_intake_validation,
            run_intake_validation,
            refresh_client_files_validation,
            preflight_revision_creation,
            create_revision,
            preflight_revision_approval,
            approve_revision,
            preflight_delivery_creation,
            create_delivery,
            get_delivery_status,
            delete_delivery_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
