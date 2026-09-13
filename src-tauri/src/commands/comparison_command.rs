use super::project_files::is_audio_extension;
use super::{find_project_summary, resolve_workspace_root, validated_project_directory};
use crate::comparison_loudness::{self, LoudnessAnalysisInput};
use crate::models::comparison::{
    self, CompletedCandidate, CompletedRegionResult, CompletedSession, ComparisonDocument,
    CumulativeStanding, ProjectRegion, RegionSnapshot, FULL_SONG_REGION_ID,
};
use crate::workspace;
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

fn comparison_source(revision_directory: &std::path::Path) -> Result<Option<PathBuf>, String> {
    let metadata = fs::symlink_metadata(revision_directory)
        .map_err(|error| format!("Could not inspect the revision folder: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Revision folder must be a regular directory".to_owned());
    }

    let mut candidates = Vec::new();
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
            let modified = entry.metadata().and_then(|value| value.modified()).ok();
            candidates.push((modified, entry.path()));
        }
    }
    candidates.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    Ok(candidates.pop().map(|(_, path)| path))
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonLoudnessCandidateRequest {
    revision_id: String,
    revision_number: u32,
    relative_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonLoudnessRequest {
    client_id: String,
    project_id: String,
    candidates: Vec<ComparisonLoudnessCandidateRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompleteComparisonCandidateRequest {
    revision_id: String,
    revision_number: u32,
    blind_id: String,
    integrated_lufs: Option<f64>,
    applied_gain_db: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompleteComparisonRegionSnapshotRequest {
    region_id: String,
    name: String,
    start_seconds: f64,
    end_seconds: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompleteComparisonRegionResultRequest {
    region: CompleteComparisonRegionSnapshotRequest,
    rank_rows: Vec<Vec<String>>,
    #[serde(default)]
    notes: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompleteComparisonSessionRequest {
    client_id: String,
    project_id: String,
    candidates: Vec<CompleteComparisonCandidateRequest>,
    regions: Vec<CompleteComparisonRegionResultRequest>,
    loudness_match: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteComparisonSessionRequest {
    client_id: String,
    project_id: String,
    session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonCandidateAvailability {
    revision_id: String,
    revision_number: u32,
    eligible: bool,
    reason: Option<String>,
    relative_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonSetup {
    document: ComparisonDocument,
    candidates: Vec<ComparisonCandidateAvailability>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonLoudnessResult {
    candidates: Vec<comparison_loudness::LoudnessAnalysisCandidate>,
}

#[derive(Debug, Serialize)]
pub(crate) struct RegionalCumulativeStandings {
    region: RegionSnapshot,
    standings: Vec<CumulativeStanding>,
}

#[derive(Debug, Serialize)]
pub(crate) struct ComparisonResults {
    document: ComparisonDocument,
    full_song_standings: Vec<CumulativeStanding>,
    regional_standings: Vec<RegionalCumulativeStandings>,
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

fn resolve_project_audio_entry(
    project_directory: &Path,
    relative_path: &str,
) -> Result<(PathBuf, String), String> {
    let normalized = normalize_relative_path(relative_path)?;
    let project_metadata = fs::symlink_metadata(project_directory)
        .map_err(|error| format!("Unable to inspect the project root: {error}"))?;
    if project_metadata.file_type().is_symlink() || !project_metadata.is_dir() {
        return Err("The selected project root is unavailable or unsafe".to_owned());
    }
    let canonical_project = project_directory
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the project root: {error}"))?;

    let mut current = project_directory.to_path_buf();
    for component in normalized.split('/') {
        current.push(component);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| format!("Unable to resolve the selected project path: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Symbolic-link project paths are not allowed".to_owned());
        }
    }

    let metadata = fs::symlink_metadata(&current)
        .map_err(|error| format!("Unable to inspect the selected project entry: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Only regular project audio files can be analyzed".to_owned());
    }
    let canonical = current
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the selected project entry: {error}"))?;
    if !canonical.starts_with(&canonical_project) {
        return Err("The selected project entry could not be resolved safely".to_owned());
    }
    Ok((canonical, normalized))
}

fn normalize_relative_path(relative_path: &str) -> Result<String, String> {
    let value = relative_path.trim();
    if value.is_empty() {
        return Err("A project file path is required".to_owned());
    }
    if value.starts_with('/') || value.contains('\\') {
        return Err("Project file paths must be portable project-relative paths".to_owned());
    }
    if value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return Err("Unsafe project file path segments are not allowed".to_owned());
    }
    Ok(value.to_owned())
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
            let (eligible, reason, relative_path) = match comparison_source(&revision_directory) {
                Ok(Some(path)) => (
                    true,
                    None,
                    path.strip_prefix(project_directory)
                        .ok()
                        .map(|value| value.to_string_lossy().replace('\\', "/")),
                ),
                Ok(None) => (
                    false,
                    Some(
                        "No supported audio file was found in the normal revision folder."
                            .to_owned(),
                    ),
                    None,
                ),
                Err(error) => (false, Some(error), None),
            };
            ComparisonCandidateAvailability {
                revision_id: revision.revision_id.clone(),
                revision_number: revision.number,
                eligible,
                reason,
                relative_path,
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

#[tauri::command]
pub(crate) fn analyze_comparison_loudness(
    app: tauri::AppHandle,
    request: ComparisonLoudnessRequest,
) -> Result<ComparisonLoudnessResult, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let inputs = request
        .candidates
        .into_iter()
        .map(|candidate| {
            let (path, relative_path) =
                resolve_project_audio_entry(&directory, &candidate.relative_path)?;
            Ok(LoudnessAnalysisInput {
                revision_id: candidate.revision_id,
                revision_number: candidate.revision_number,
                relative_path,
                path,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(ComparisonLoudnessResult {
        candidates: comparison_loudness::analyze_project_candidates(&directory, inputs)?,
    })
}

#[tauri::command]
pub(crate) fn get_comparison_results(
    app: tauri::AppHandle,
    request: ComparisonProjectRequest,
) -> Result<ComparisonResults, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let document = comparison::load(&directory)?;
    Ok(comparison_results(document))
}

#[tauri::command]
pub(crate) fn complete_comparison_session(
    app: tauri::AppHandle,
    request: CompleteComparisonSessionRequest,
) -> Result<CompletedSession, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let mut document = comparison::load(&directory)?;
    let session = completed_session_from_request(request)?;
    comparison::append_completed_session(&mut document, session.clone())?;
    comparison::save(&directory, &document)?;
    Ok(session)
}

#[tauri::command]
pub(crate) fn delete_comparison_session(
    app: tauri::AppHandle,
    request: DeleteComparisonSessionRequest,
) -> Result<ComparisonResults, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let mut document = comparison::load(&directory)?;
    if !comparison::delete_completed_session(&mut document, request.session_id.trim()) {
        return Err("Comparison session was not found".to_owned());
    }
    comparison::save(&directory, &document)?;
    Ok(comparison_results(document))
}

#[tauri::command]
pub(crate) fn clear_comparison_history(
    app: tauri::AppHandle,
    request: ComparisonProjectRequest,
) -> Result<ComparisonResults, String> {
    let (directory, _) = project_context(&app, &request.client_id, &request.project_id)?;
    let mut document = comparison::load(&directory)?;
    comparison::clear_ranking_history(&mut document);
    comparison::save(&directory, &document)?;
    Ok(comparison_results(document))
}

fn completed_session_from_request(
    request: CompleteComparisonSessionRequest,
) -> Result<CompletedSession, String> {
    let candidate_ids: BTreeSet<String> = request
        .candidates
        .iter()
        .map(|candidate| candidate.revision_id.trim().to_owned())
        .collect();
    if candidate_ids.len() != request.candidates.len() {
        return Err("Completed comparison candidates must be unique".to_owned());
    }
    let candidates = request
        .candidates
        .into_iter()
        .map(|candidate| CompletedCandidate {
            revision_id: candidate.revision_id.trim().to_owned(),
            revision_number: candidate.revision_number,
            blind_id: candidate.blind_id.trim().to_owned(),
            integrated_lufs: candidate.integrated_lufs,
            applied_gain_db: candidate.applied_gain_db,
        })
        .collect();
    let regions = request
        .regions
        .into_iter()
        .map(|result| CompletedRegionResult {
            region: RegionSnapshot {
                region_id: result.region.region_id.trim().to_owned(),
                name: result.region.name.trim().to_owned(),
                start_seconds: result.region.start_seconds,
                end_seconds: result.region.end_seconds,
            },
            rank_rows: result
                .rank_rows
                .into_iter()
                .map(|row| row.into_iter().map(|id| id.trim().to_owned()).collect())
                .filter(|row: &Vec<String>| !row.is_empty())
                .collect(),
            notes: result
                .notes
                .into_iter()
                .filter_map(|(revision_id, note)| {
                    let revision_id = revision_id.trim().to_owned();
                    let note = note.trim().to_owned();
                    if revision_id.is_empty() || note.is_empty() {
                        None
                    } else {
                        Some((revision_id, note))
                    }
                })
                .collect(),
        })
        .collect();
    Ok(CompletedSession {
        session_id: comparison::new_session_id(),
        completed_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
        candidates,
        regions,
        loudness_match: request.loudness_match,
    })
}

fn comparison_results(document: ComparisonDocument) -> ComparisonResults {
    let full_song_standings = comparison::cumulative_standings(&document, FULL_SONG_REGION_ID);
    let mut seen = BTreeSet::new();
    let mut regions = document
        .regions
        .iter()
        .map(|region| RegionSnapshot {
            region_id: region.region_id.clone(),
            name: region.name.clone(),
            start_seconds: region.start_seconds,
            end_seconds: region.end_seconds,
        })
        .collect::<Vec<_>>();
    for session in &document.completed_sessions {
        for result in &session.regions {
            if regions
                .iter()
                .all(|region| region.region_id != result.region.region_id)
            {
                regions.push(result.region.clone());
            }
        }
    }
    let regional_standings = regions
        .into_iter()
        .filter(|region| seen.insert(region.region_id.clone()))
        .map(|region| {
            let standings = comparison::cumulative_standings(&document, &region.region_id);
            RegionalCumulativeStandings { region, standings }
        })
        .filter(|region| !region.standings.is_empty())
        .collect();
    ComparisonResults {
        document,
        full_song_standings,
        regional_standings,
    }
}

#[cfg(test)]
mod tests {
    use super::{comparison_source, normalize_relative_path};
    use std::fs;

    #[test]
    fn comparison_source_accepts_mixed_supported_formats_in_revision_root() {
        let revision = tempfile::tempdir().unwrap();
        fs::write(revision.path().join("mix.flac"), b"audio").unwrap();

        assert!(comparison_source(revision.path()).unwrap().is_some());
    }

    #[test]
    fn comparison_source_excludes_variants_and_non_audio_files() {
        let revision = tempfile::tempdir().unwrap();
        let variants = revision.path().join("Variants");
        fs::create_dir(&variants).unwrap();
        fs::write(variants.join("alternate.wav"), b"audio").unwrap();
        fs::write(revision.path().join("Revision_Notes.md"), b"notes").unwrap();

        assert!(comparison_source(revision.path()).unwrap().is_none());
    }

    #[test]
    fn loudness_analysis_rejects_unsafe_relative_paths() {
        assert!(normalize_relative_path("../outside.wav").is_err());
        assert!(normalize_relative_path("/absolute.wav").is_err());
        assert!(normalize_relative_path("folder\\file.wav").is_err());
        assert_eq!(
            normalize_relative_path("04_Revisions/Revision_01/mix.wav").unwrap(),
            "04_Revisions/Revision_01/mix.wav"
        );
    }
}
