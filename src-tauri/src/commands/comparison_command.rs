use super::project_revision_files::select_listening_source;
use super::{find_project_summary, resolve_workspace_root, validated_project_directory};
use crate::models::comparison::{self, ComparisonDocument, ProjectRegion};
use crate::workspace;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonProjectRequest {
    client_id: String,
    project_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonRegionRequest {
    client_id: String,
    project_id: String,
    name: String,
    start_seconds: f64,
    end_seconds: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateComparisonRegionRequest {
    client_id: String,
    project_id: String,
    region_id: String,
    name: String,
    start_seconds: f64,
    end_seconds: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteComparisonRegionRequest {
    client_id: String,
    project_id: String,
    region_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonCandidateAvailability {
    revision_id: String,
    revision_number: u32,
    eligible: bool,
    reason: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonSetup {
    document: ComparisonDocument,
    candidates: Vec<ComparisonCandidateAvailability>,
}

fn project_context(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
) -> Result<(std::path::PathBuf, crate::models::ProjectSummary), String> {
    let root = resolve_workspace_root(app)?;
    let snapshot = workspace::discover_workspace_at(&root);
    let project = find_project_summary(&snapshot, client_id.trim(), project_id.trim())
        .cloned()
        .ok_or_else(|| "The selected project could not be resolved safely".to_owned())?;
    let directory =
        validated_project_directory(&root, &snapshot, client_id.trim(), project_id.trim())
            .ok_or_else(|| "The selected project could not be resolved safely".to_owned())?;
    Ok((directory, project))
}

fn candidate_availability(
    project_directory: &std::path::Path,
    project: &crate::models::ProjectSummary,
) -> Vec<ComparisonCandidateAvailability> {
    project
        .revisions
        .iter()
        .map(|revision| {
            let revision_directory = project_directory
                .join("04_Revisions")
                .join(format!("Revision_{:02}", revision.number));
            let selection =
                select_listening_source(&revision_directory, &project.file_format, None);
            let (eligible, reason) = match selection {
                Ok(Some(_)) => (true, None),
                Ok(None) => (
                    false,
                    Some(format!(
                        "No playable {} file was found in the normal revision folder.",
                        project.file_format.to_uppercase()
                    )),
                ),
                Err(error) => (false, Some(error)),
            };
            ComparisonCandidateAvailability {
                revision_id: revision.revision_id.clone(),
                revision_number: revision.number,
                eligible,
                reason,
            }
        })
        .collect()
}

#[tauri::command]
pub(crate) fn get_comparison_setup(
    app: tauri::AppHandle,
    request: ComparisonProjectRequest,
) -> Result<ComparisonSetup, String> {
    let (directory, project) = project_context(&app, &request.client_id, &request.project_id)?;
    Ok(ComparisonSetup {
        document: comparison::load(&directory)?,
        candidates: candidate_availability(&directory, &project),
    })
}

#[tauri::command]
pub(crate) fn add_comparison_region(
    app: tauri::AppHandle,
    request: ComparisonRegionRequest,
) -> Result<ProjectRegion, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let mut document = comparison::load(&directory)?;
    let region = comparison::add_custom_region(
        &mut document,
        request.name.trim().to_owned(),
        request.start_seconds,
        request.end_seconds,
    )?;
    comparison::save(&directory, &document)?;
    Ok(region)
}

#[tauri::command]
pub(crate) fn update_comparison_region(
    app: tauri::AppHandle,
    request: UpdateComparisonRegionRequest,
) -> Result<ProjectRegion, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let mut document = comparison::load(&directory)?;
    comparison::update_custom_region(
        &mut document,
        request.region_id.trim(),
        request.name.trim().to_owned(),
        request.start_seconds,
        request.end_seconds,
    )?;
    let region = document
        .regions
        .iter()
        .find(|region| region.region_id == request.region_id.trim())
        .cloned()
        .ok_or_else(|| "Comparison region was not found".to_owned())?;
    comparison::save(&directory, &document)?;
    Ok(region)
}

#[tauri::command]
pub(crate) fn delete_comparison_region(
    app: tauri::AppHandle,
    request: DeleteComparisonRegionRequest,
) -> Result<ComparisonDocument, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let mut document = comparison::load(&directory)?;
    if !comparison::delete_custom_region(&mut document, request.region_id.trim())? {
        return Err("Comparison region was not found".to_owned());
    }
    comparison::save(&directory, &document)?;
    Ok(document)
}
