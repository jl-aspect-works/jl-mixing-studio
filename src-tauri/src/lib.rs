mod audio_preview;
mod automation_api;
mod cli;
mod client_edit;
mod commands;
mod comparison_loudness;
mod derived;
mod diagnostic_log;
mod intake;
mod managed_client_files;
mod models;
mod project_edit;
mod revision_lifecycle;
mod studio_edit;
mod workflows;
mod workspace;

use commands::prepare_comparison_sources;
use commands::{
    add_comparison_region, add_project_reference, analyze_comparison_loudness,
    choose_workspace_folder, clear_comparison_history, complete_comparison_session,
    delete_comparison_region, delete_comparison_session, delete_project_file,
    delete_project_reference, delete_revision_file, discover_default_workspace,
    get_comparison_results, get_comparison_setup, get_delivery_notes, get_jl_mixing_version,
    get_native_comparison_audio_status, get_native_project_audio_preview_status,
    get_project_audio_waveform, get_revision_notes, get_system_info, get_workspace_configuration,
    list_project_files, load_native_project_audio_preview, open_folder, open_project_file,
    pause_native_comparison_audio, pause_native_project_audio_preview,
    play_native_comparison_audio, play_native_project_audio_preview,
    prepare_native_comparison_audio, prepare_project_audio_preview, rename_project_file,
    rename_revision_file, resolve_folder, reveal_project_file, seek_native_comparison_audio,
    seek_native_project_audio_preview, set_native_comparison_audio_volume,
    set_native_project_audio_preview_volume, set_workspace_root, stop_native_comparison_audio,
    stop_native_project_audio_preview, summarize_project_files, summarize_workspace_storage,
    switch_native_comparison_candidate, update_comparison_region, update_delivery_notes,
    update_revision_description, update_revision_notes, validate_workspace_root,
};
pub(crate) use commands::{
    find_project_summary, resolve_home, resolve_workspace_root, validated_project_directory,
};
#[cfg(test)]
use commands::{
    intake_directory, read_delivery_notes, write_delivery_notes, DELIVERY_NOTES_MAX_BYTES,
};
use commands::{log_comparison_performance, log_comparison_playback};
use managed_client_files::{AudioPrepResetRequest, ManagedImportRequest, ManagedOperationResult};
use models::{
    ApprovalOperationResult, ClientCreationRequest, ClientEditInfo, ClientOperationResult,
    ClientUpdateRequest, ClientUpdateResult, DeliveryCreationRequest, DeliveryOperationResult,
    DeliveryPackageDeleteRequest, DeliveryStatusRequest, DeliveryStatusResult,
    IntakeOperationResult, IntakeRequest, ListeningConfiguration, ProjectCreationRequest,
    ProjectEditInfo, ProjectOperationResult, ProjectUpdateRequest, ProjectUpdateResult,
    RevisionApprovalRequest, RevisionCreationRequest, RevisionOperationResult,
    StudioCreationRequest, StudioEditInfo, StudioOperationResult, StudioUpdateRequest,
    StudioUpdateResult,
};
#[cfg(test)]
use models::{
    DeliveryCreationPreview, DeliveryReplacementMode, ProjectSummary, RevisionApprovalSummary,
    RevisionCreationSummary, WorkspaceStatus,
};
use revision_lifecycle::{
    RevisionLifecycleRequest, RevisionLifecycleResult, RevisionLifecycleSupport,
};
#[cfg(test)]
use std::{fs, path::Path};
use tauri::Emitter;
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
fn get_listening_configuration(app: tauri::AppHandle) -> Result<ListeningConfiguration, String> {
    commands::listening_configuration(&app)
}

#[tauri::command]
fn save_listening_configuration(
    app: tauri::AppHandle,
    configuration: ListeningConfiguration,
) -> Result<ListeningConfiguration, String> {
    commands::save_listening_configuration(&app, configuration)
}

#[tauri::command]
fn choose_managed_import_sources(source_kind: String) -> Result<Vec<String>, String> {
    managed_client_files::choose_import_sources(&source_kind)
}

#[tauri::command]
async fn plan_managed_client_import(
    app: tauri::AppHandle,
    request: ManagedImportRequest,
    progress: tauri::ipc::Channel<serde_json::Value>,
) -> Result<ManagedOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client_id = request.client_id.clone();
        let project_id = request.project_id.clone();
        managed_client_files::plan_import_with_progress(&app, request, move |event| {
            let _ = progress.send(serde_json::json!({
                "clientId": &client_id,
                "projectId": &project_id,
                "phase": event.phase,
                "completed": event.completed,
                "total": event.total,
                "overallCompleted": event.overall_completed,
                "overallTotal": event.overall_total,
                "active": event.active,
            }));
        })
    })
    .await
    .map_err(|error| format!("Managed import planning task failed: {error}"))
}

#[tauri::command]
async fn execute_managed_client_import(
    app: tauri::AppHandle,
    request: ManagedImportRequest,
    progress: tauri::ipc::Channel<serde_json::Value>,
) -> Result<ManagedOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client_id = request.client_id.clone();
        let project_id = request.project_id.clone();
        managed_client_files::execute_import_with_progress(&app, request, move |event| {
            let _ = progress.send(serde_json::json!({
                "clientId": &client_id,
                "projectId": &project_id,
                "phase": event.phase,
                "completed": event.completed,
                "total": event.total,
                "overallCompleted": event.overall_completed,
                "overallTotal": event.overall_total,
                "active": event.active,
            }));
        })
    })
    .await
    .map_err(|error| format!("Managed import task failed: {error}"))
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

fn intake_progress_callback(
    app: &tauri::AppHandle,
