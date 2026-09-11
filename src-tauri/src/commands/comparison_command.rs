use super::project_files::is_audio_extension;
use super::{find_project_summary, resolve_workspace_root, validated_project_directory};
use crate::models::comparison::{self, ComparisonDocument, ProjectRegion};
use crate::workspace;
use serde::{Deserialize, Serialize};
use std::fs;

fn has_playable_comparison_source(revision_directory: &std::path::Path) -> Result<bool, String> {
    let metadata = fs::symlink_metadata(revision_directory)
        .map_err(|error| format!("Could not inspect the revision folder: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Revision folder must be a regular directory".to_owned());
    }

    for entry in fs::read_dir(revision_directory)
        .map_err(|error| format!("Could not read the revision folder: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Could not inspect a revision file: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect a revision file: {error}"))?;
        if file_type.is_symlink() || !file_type.is_file() {
            continue;
        }
        let supported = entry
            .path()
            .extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .is_some_and(|extension| is_audio_extension(&extension));
        if supported {
            return Ok(true);
        }
    }
    Ok(false)
}

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
            let (eligible, reason) = match has_playable_comparison_source(&revision_directory) {
                Ok(true) => (true, None),
                Ok(false) => (
                    false,
                    Some(
                        "No supported audio file was found in the normal revision folder."
                            .to_owned(),
                    ),
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

#[cfg(test)]
mod tests {
    use super::has_playable_comparison_source;
    use std::fs;

    #[test]
    fn comparison_source_accepts_mixed_supported_formats_in_revision_root() {
        let revision = tempfile::tempdir().unwrap();
        fs::write(revision.path().join("mix.flac"), b"audio").unwrap();

        assert!(has_playable_comparison_source(revision.path()).unwrap());
    }

    #[test]
    fn comparison_source_excludes_variants_and_non_audio_files() {
        let revision = tempfile::tempdir().unwrap();
        let variants = revision.path().join("Variants");
        fs::create_dir(&variants).unwrap();
        fs::write(variants.join("alternate.wav"), b"audio").unwrap();
        fs::write(revision.path().join("Revision_Notes.md"), b"notes").unwrap();

        assert!(!has_playable_comparison_source(revision.path()).unwrap());
    }
}
