//! Explicit plan/execute deletion for user content in managed project folders.
//! Reserved roots and Original Delivery files with recorded Audio Prep lineage are protected.

use super::project_file_diagnostics::record_mutation;
use super::project_files::{
    normalize_relative_path, resolve_existing_directory, resolve_existing_regular_file,
    resolve_project_directory,
};
use crate::models::ProjectFileMutationRequest;
use crate::managed_client_files;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const ORIGINAL: &str = "01_Client_Files/Original_Delivery/";
const WORKING: &str = "02_Audio_Preparation/Working_Audio/";
const REJECTED: &str = "02_Audio_Preparation/Rejected_Files/";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContentDeletePlan {
    pub relative_path: String,
    pub display_name: String,
    pub is_directory: bool,
    pub file_count: u64,
    pub directory_count: u64,
    pub total_bytes: u64,
    pub fingerprint: String,
    pub working_copies_retained: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContentDeleteExecuteRequest {
    pub client_id: String,
    pub project_id: String,
    pub relative_path: String,
    pub fingerprint: String,
    pub confirm_name: String,
}

#[tauri::command]
pub(crate) fn plan_project_content_delete(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ContentDeletePlan, String> {
    let root = resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    if request.relative_path.starts_with(ORIGINAL) {
        return automation_original_delete(&app, &root, &request.relative_path, None);
    }
    plan_at(&root, &request.relative_path)
}

#[tauri::command]
pub(crate) fn execute_project_content_delete(
    app: tauri::AppHandle,
    request: ContentDeleteExecuteRequest,
) -> Result<ContentDeletePlan, String> {
    record_mutation("delete", "protectedContent", &request.relative_path, "attempted", None);
    let result = (|| {
        let root = resolve_project_directory(&app, &request.client_id, &request.project_id)?;
        if request.relative_path.starts_with(ORIGINAL) {
            return automation_original_delete(&app, &root, &request.relative_path,
                Some((&request.fingerprint, &request.confirm_name)));
        }
        execute_at(&root, &request)
    })();
    record_mutation(
        "delete", "protectedContent", &request.relative_path,
        if result.is_ok() { "succeeded" } else { "failed" },
        result.as_ref().err().map(|_| "validation_or_filesystem"),
    );
    result
}

fn automation_original_delete(
    app: &tauri::AppHandle,
    project: &Path,
    relative_path: &str,
    confirmation: Option<(&str, &str)>,
) -> Result<ContentDeletePlan, String> {
    let execute = confirmation.is_some();
    let mut args = vec!["client-files".into(),
        if execute { "delete-execute" } else { "delete-plan" }.into(),
        "--json".into(), "--relative-path".into(), relative_path.into()];
    if let Some((fingerprint, name)) = confirmation {
        args.extend(["--fingerprint".into(), fingerprint.into(), "--confirm-name".into(), name.into()]);
    }
    let operation = if execute { "client.files.delete.execute" } else { "client.files.delete.plan" };
    let result = managed_client_files::call_api(app, project, operation, args);
    if !result.ok {
        return Err(if result.message.is_empty() {
            "Original Delivery deletion requires an installed Automation release with managed delete support".into()
        } else { result.message });
    }
    let summary = result.data.get("summary")
        .ok_or("Automation returned no deletion summary")?;
    Ok(ContentDeletePlan {
        relative_path: summary.get("relative_path").and_then(serde_json::Value::as_str)
            .ok_or("Automation returned an invalid deletion path")?.into(),
        display_name: summary.get("display_name").and_then(serde_json::Value::as_str)
            .ok_or("Automation returned an invalid deletion name")?.into(),
        is_directory: summary.get("is_directory").and_then(serde_json::Value::as_bool)
            .ok_or("Automation returned an invalid deletion type")?,
        file_count: summary.get("file_count").and_then(serde_json::Value::as_u64)
            .ok_or("Automation returned an invalid file count")?,
        directory_count: summary.get("directory_count").and_then(serde_json::Value::as_u64)
            .ok_or("Automation returned an invalid folder count")?,
        total_bytes: summary.get("total_bytes").and_then(serde_json::Value::as_u64)
            .ok_or("Automation returned an invalid byte count")?,
        fingerprint: summary.get("fingerprint").and_then(serde_json::Value::as_str)
            .ok_or("Automation returned an invalid deletion fingerprint")?.into(),
        working_copies_retained: summary.get("working_copies_retained")
            .and_then(serde_json::Value::as_array)
            .ok_or("Automation returned an invalid Working Audio summary")?
            .iter().map(|value| value.as_str().map(str::to_owned)
                .ok_or("Automation returned an invalid Working Audio path"))
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn allowed_path(relative: &str) -> bool {
    [WORKING, REJECTED].iter().any(|root| {
        relative.starts_with(root)
            && relative.len() > root.len()
            && !relative.split('/').any(|part| part.starts_with(".jl-mixing-deleting-"))
    })
}

pub(super) fn is_deletable_content_path(relative: &str) -> bool {
    allowed_path(relative) || (relative.starts_with(ORIGINAL)
        && relative.len() > ORIGINAL.len()
        && !relative.split('/').any(|part| part.starts_with(".jl-mixing-deleting-")))
}

fn target_at(project: &Path, relative: &str) -> Result<(PathBuf, bool), String> {
    let candidate = project.join(relative);
    let metadata = fs::symlink_metadata(&candidate)
        .map_err(|error| format!("The selected content is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Symbolic links cannot be deleted from Studio".into());
    }
    if metadata.is_file() {
        Ok((resolve_existing_regular_file(project, relative)?, false))
    } else if metadata.is_dir() {
        Ok((resolve_existing_directory(project, relative)?, true))
    } else {
        Err("Only regular files and folders can be deleted".into())
    }
}

fn plan_at(project: &Path, relative_path: &str) -> Result<ContentDeletePlan, String> {
    let relative = normalize_relative_path(relative_path)?;
    if !allowed_path(&relative) {
        return Err("Deletion is limited to content inside Working Audio and Rejected Files; managed roots are protected".into());
    }
    let (target, is_directory) = target_at(project, &relative)?;
    let display_name = target.file_name().ok_or("The selected content has no name")?
        .to_string_lossy().into_owned();
    let mut plan = ContentDeletePlan {
        relative_path: relative.clone(), display_name, is_directory,
        file_count: 0, directory_count: 0, total_bytes: 0, fingerprint: String::new(),
        working_copies_retained: Vec::new(),
    };
    let mut hash = 0xcbf29ce484222325_u64;
    visit(&target, &target, &mut plan, &mut hash)?;
    plan.fingerprint = format!("{hash:016x}");
    Ok(plan)
}

fn hash_bytes(hash: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *hash = (*hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3);
    }
}

fn visit(path: &Path, root: &Path, plan: &mut ContentDeletePlan, hash: &mut u64) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Cannot inspect deletion contents: {error}"))?;
    if metadata.file_type().is_symlink() || !(metadata.is_file() || metadata.is_dir()) {
        return Err("The selected folder contains a symbolic link or unsupported item; deletion is blocked".into());
    }
    hash_bytes(hash, path.strip_prefix(root).unwrap_or(path).to_string_lossy().as_bytes());
    hash_bytes(hash, &[u8::from(metadata.is_dir())]);
    hash_bytes(hash, &metadata.len().to_le_bytes());
    let modified = metadata.modified().ok().and_then(|time| time.duration_since(UNIX_EPOCH).ok());
    hash_bytes(hash, &modified.map_or(0, |time| time.as_nanos()).to_le_bytes());
    if metadata.is_file() {
        plan.file_count += 1;
        plan.total_bytes = plan.total_bytes.saturating_add(metadata.len());
    } else {
        plan.directory_count += 1;
        let mut children = fs::read_dir(path)
            .map_err(|error| format!("Cannot inspect deletion folder: {error}"))?
            .map(|entry| entry.map(|entry| entry.path()))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Cannot inspect deletion folder: {error}"))?;
        children.sort();
        for child in children { visit(&child, root, plan, hash)?; }
    }
    Ok(())
}

fn execute_at(project: &Path, request: &ContentDeleteExecuteRequest) -> Result<ContentDeletePlan, String> {
    let plan = plan_at(project, &request.relative_path)?;
    if plan.fingerprint != request.fingerprint {
        return Err("The folder contents changed since confirmation; review a new deletion summary".into());
    }
    if plan.display_name != request.confirm_name {
        return Err("Confirmation must match the selected file or folder name exactly".into());
    }
    let (target, _) = target_at(project, &plan.relative_path)?;
    let parent = target.parent().ok_or("The selected content has no parent folder")?;
    let staged = (0..100).map(|index| parent.join(format!(
        ".jl-mixing-deleting-{}-{index}", std::process::id()
    ))).find(|path| !path.exists()).ok_or("Could not reserve a safe deletion name")?;
    fs::rename(&target, &staged)
        .map_err(|error| format!("Could not stage deletion; the original item remains: {error}"))?;
    let cleanup = if plan.is_directory { fs::remove_dir_all(&staged) } else { fs::remove_file(&staged) };
    cleanup.map_err(|error| format!(
        "Deletion cleanup is incomplete at {}; do not retry automatically: {error}", staged.display()
    ))?;
    Ok(plan)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(path: &str, plan: &ContentDeletePlan) -> ContentDeleteExecuteRequest {
        ContentDeleteExecuteRequest {
            client_id: String::new(), project_id: String::new(),
            relative_path: path.into(), fingerprint: plan.fingerprint.clone(),
            confirm_name: plan.display_name.clone(),
        }
    }

    #[test]
    fn removes_nested_folder_only_after_matching_summary() {
        let root = tempfile::tempdir().unwrap();
        let folder = root.path().join("02_Audio_Preparation/Working_Audio/Stems");
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join("lead.wav"), b"lead").unwrap();
        let path = "02_Audio_Preparation/Working_Audio/Stems";
        let plan = plan_at(root.path(), path).unwrap();
        assert_eq!((plan.file_count, plan.directory_count, plan.total_bytes), (1, 1, 4));
        fs::write(folder.join("new.wav"), b"new").unwrap();
        assert!(execute_at(root.path(), &request(path, &plan)).is_err());
        assert!(folder.exists());
        let updated = plan_at(root.path(), path).unwrap();
        execute_at(root.path(), &request(path, &updated)).unwrap();
        assert!(!folder.exists());
    }

    #[test]
    fn protects_roots_and_symlinks() {
        let root = tempfile::tempdir().unwrap();
        let working = root.path().join("02_Audio_Preparation/Working_Audio");
        fs::create_dir_all(&working).unwrap();
        assert!(plan_at(root.path(), "02_Audio_Preparation/Working_Audio").is_err());
        assert!(plan_at(root.path(), "02_Audio_Preparation/Working_Audio/../00_Admin").is_err());
        #[cfg(unix)] {
            let outside = root.path().join("outside.wav");
            fs::write(&outside, b"outside").unwrap();
            std::os::unix::fs::symlink(&outside, working.join("link.wav")).unwrap();
            assert!(plan_at(root.path(), "02_Audio_Preparation/Working_Audio/link.wav").is_err());
        }
    }
}
