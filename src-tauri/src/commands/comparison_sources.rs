use super::project_file_open::resolve_project_entry;
use super::resolve_workspace_root;
use crate::models::ProjectAudioPreviewResult;
use crate::workspace;
use serde::Deserialize;
use tauri::Manager;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceCandidate {
    blind_id: String,
    relative_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonSourcesRequest {
    client_id: String,
    project_id: String,
    candidates: Vec<SourceCandidate>,
}

#[tauri::command]
pub(crate) async fn prepare_comparison_sources(
    app: tauri::AppHandle,
    request: ComparisonSourcesRequest,
) -> Result<Vec<ProjectAudioPreviewResult>, String> {
    tauri::async_runtime::spawn_blocking(move || prepare_sources(&app, request))
        .await
        .map_err(|_| "Comparison sources could not be prepared".to_owned())?
}

fn prepare_sources(
    app: &tauri::AppHandle,
    request: ComparisonSourcesRequest,
) -> Result<Vec<ProjectAudioPreviewResult>, String> {
    if request.candidates.is_empty() || request.candidates.len() > 26 {
        return Err("Invalid comparison candidate count".into());
    }
    let root = resolve_workspace_root(app)?;
    let directory = workspace::find_validated_project_path(
        &root,
        request.client_id.trim(),
        request.project_id.trim(),
    )
    .ok_or_else(|| "Comparison project could not be resolved safely".to_owned())?;
    request
        .candidates
        .into_iter()
        .map(|candidate| {
            if candidate.blind_id.len() != 1
                || !candidate.blind_id.bytes().all(|c| c.is_ascii_uppercase())
            {
                return Err("Invalid blind candidate identity".into());
            }
            let failure = || format!("Candidate {} could not be prepared.", candidate.blind_id);
            let (path, relative_path) = resolve_project_entry(&directory, &candidate.relative_path)
                .map_err(|_| failure())?;
            if !path.is_file() {
                return Err(failure());
            }
            let supported = cfg!(target_os = "macos");
            if supported {
                app.asset_protocol_scope()
                    .allow_file(&path)
                    .map_err(|_| failure())?;
            }
            Ok(ProjectAudioPreviewResult {
                supported,
                relative_path,
                file_path: supported.then(|| path.to_string_lossy().into_owned()),
            })
        })
        .collect()
}
