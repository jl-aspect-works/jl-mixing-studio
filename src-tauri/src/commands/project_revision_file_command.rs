use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{
    ProjectFileMutationRequest, ProjectFileMutationResult, ProjectFileRenameRequest, WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::path::{Path, PathBuf};

const REVISION_NOTES: &str = "Revision_Notes.md";

#[tauri::command]
pub(crate) fn rename_revision_file(
    app: tauri::AppHandle,
    request: ProjectFileRenameRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let relative_path = rename_managed_revision_file(
        &project_directory,
        &request.relative_path,
        &request.new_name,
    )?;
    Ok(ProjectFileMutationResult { relative_path })
}

#[tauri::command]
pub(crate) fn delete_revision_file(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let relative_path = delete_managed_revision_file(&project_directory, &request.relative_path)?;
    Ok(ProjectFileMutationResult { relative_path })
}

fn resolve_project_directory(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
) -> Result<PathBuf, String> {
    let root = resolve_workspace_root(app)?;
    let snapshot = workspace::discover_workspace_at(&root);
    if !matches!(
        snapshot.status,
        WorkspaceStatus::Healthy | WorkspaceStatus::Empty | WorkspaceStatus::Partial
    ) {
        return Err("The configured workspace is unavailable; reconnect it and try again".into());
    }

    validated_project_directory(&root, &snapshot, client_id.trim(), project_id.trim())
        .ok_or_else(|| "The selected project could not be resolved safely".into())
}

fn normalize_revision_file_path(relative_path: &str) -> Result<String, String> {
    let value = relative_path.trim();
    if value.is_empty() || value.starts_with('/') || value.contains('\\') {
        return Err("A portable project-relative revision file path is required".into());
    }
    let components = value.split('/').collect::<Vec<_>>();
    if components.iter().any(|component| {
        component.is_empty() || *component == "." || *component == ".."
    }) {
        return Err("Unsafe revision file path segments are not allowed".into());
    }
    if components.len() < 3
        || components[0] != "04_Revisions"
        || !is_revision_directory_name(components[1])
    {
        return Err("Revision file changes are limited to managed Revision_NN folders".into());
    }
    if components.last().is_some_and(|name| *name == REVISION_NOTES) {
        return Err("Revision_Notes.md is managed revision content and cannot be renamed or deleted".into());
    }
    Ok(value.to_owned())
}

fn is_revision_directory_name(value: &str) -> bool {
    let Some(number) = value.strip_prefix("Revision_") else {
        return false;
    };
    number.len() >= 2 && number.chars().all(|character| character.is_ascii_digit())
}

fn resolve_revision_regular_file(
    project_directory: &Path,
    relative_path: &str,
) -> Result<(PathBuf, String), String> {
    let normalized = normalize_revision_file_path(relative_path)?;
    let project_metadata = fs::symlink_metadata(project_directory)
        .map_err(|error| filesystem_error("inspect the project root", error))?;
    if project_metadata.file_type().is_symlink() || !project_metadata.is_dir() {
        return Err("The selected project root is unavailable or unsafe".into());
    }
    let canonical_project = project_directory
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the project root", error))?;

    let mut current = project_directory.to_path_buf();
    for component in normalized.split('/') {
        current.push(component);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| filesystem_error("resolve the selected revision file", error))?;
        if metadata.file_type().is_symlink() {
            return Err("Symbolic-link revision paths are not allowed".into());
        }
    }

    let metadata = fs::symlink_metadata(&current)
        .map_err(|error| filesystem_error("inspect the selected revision file", error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Only regular files inside managed revision folders can be changed".into());
    }

    let canonical = current
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the selected revision file", error))?;
    if !canonical.starts_with(&canonical_project) {
        return Err("The selected revision file could not be resolved safely".into());
    }
    Ok((canonical, normalized))
}

fn rename_managed_revision_file(
    project_directory: &Path,
    relative_path: &str,
    new_stem: &str,
) -> Result<String, String> {
    let (source, normalized) = resolve_revision_regular_file(project_directory, relative_path)?;
    let stem = validate_rename_stem(new_stem)?;
    let extension = source
        .extension()
        .map(|value| value.to_string_lossy().into_owned());
    let target_name = match extension.as_deref() {
        Some(extension) if !extension.is_empty() => format!("{stem}.{extension}"),
        _ => stem,
    };
    if target_name == REVISION_NOTES {
        return Err("Revision_Notes.md is reserved for managed revision notes".into());
    }
    let source_name = source
        .file_name()
        .ok_or("The selected revision file has no usable name")?
        .to_string_lossy()
        .into_owned();
    if source_name == target_name {
        return Err("The new file name is unchanged".into());
    }

    let parent = source
        .parent()
        .ok_or("The selected revision file has no parent folder")?;
    reject_case_insensitive_collision(parent, &source_name, &target_name)?;
    let target = parent.join(&target_name);
    if target.exists() {
        return Err(format!(
            "A file named '{target_name}' already exists in this revision folder"
        ));
    }

    if source_name.eq_ignore_ascii_case(&target_name) {
        rename_case_only(&source, &target)?;
    } else {
        fs::rename(&source, &target)
            .map_err(|error| filesystem_error("rename the revision file", error))?;
    }

    let parent_relative = normalized
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .ok_or("The selected revision file has no managed parent path")?;
    Ok(format!("{parent_relative}/{target_name}"))
}

fn delete_managed_revision_file(
    project_directory: &Path,
    relative_path: &str,
) -> Result<String, String> {
    let (source, normalized) = resolve_revision_regular_file(project_directory, relative_path)?;
    fs::remove_file(&source)
        .map_err(|error| filesystem_error("delete the revision file", error))?;
    Ok(normalized)
}

fn validate_rename_stem(value: &str) -> Result<String, String> {
    let stem = value.trim();
    if stem.is_empty() || matches!(stem, "." | "..") {
        return Err("Enter a file name before renaming".into());
    }
    if stem.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err(
            "The file name contains characters that are not portable across macOS and Windows"
                .into(),
        );
    }
    if stem.ends_with('.') || stem.ends_with(' ') {
        return Err("File names cannot end with a period or space".into());
    }
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
        "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    let reserved_candidate = stem.split('.').next().unwrap_or(stem);
    if reserved
        .iter()
        .any(|reserved_name| reserved_candidate.eq_ignore_ascii_case(reserved_name))
    {
        return Err("That file name is reserved on Windows".into());
    }
    Ok(stem.to_owned())
}

fn reject_case_insensitive_collision(
    parent: &Path,
    source_name: &str,
    target_name: &str,
) -> Result<(), String> {
    for entry in fs::read_dir(parent)
        .map_err(|error| filesystem_error("check for file name conflicts", error))?
    {
        let entry = entry.map_err(|error| filesystem_error("check a file name conflict", error))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name != source_name && name.eq_ignore_ascii_case(target_name) {
            return Err(format!(
                "A file named '{name}' already conflicts with the requested name"
            ));
        }
    }
    Ok(())
}

fn rename_case_only(source: &Path, target: &Path) -> Result<(), String> {
    let parent = source
        .parent()
        .ok_or("The selected revision file has no parent folder")?;
    let mut attempt = 0_u32;
    let temporary = loop {
        attempt += 1;
        let candidate = parent.join(format!(
            ".jl-mixing-revision-rename-{}-{attempt}",
            std::process::id()
        ));
        if !candidate.exists() {
            break candidate;
        }
        if attempt >= 100 {
            return Err("Unable to reserve a temporary name for the rename".into());
        }
    };

    fs::rename(source, &temporary)
        .map_err(|error| filesystem_error("prepare the case-only revision rename", error))?;
    if let Err(error) = fs::rename(&temporary, target) {
        let _ = fs::rename(&temporary, source);
        return Err(filesystem_error(
            "finish the case-only revision rename",
            error,
        ));
    }
    Ok(())
}

fn filesystem_error(action: &str, error: std::io::Error) -> String {
    format!("Unable to {action}: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "jl-mixing-studio-revision-files-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn revision_path_policy_protects_structure_and_notes() {
        assert!(normalize_revision_file_path("04_Revisions/Revision_01/Mix.wav").is_ok());
        assert!(normalize_revision_file_path("04_Revisions/Revision_01/Stems/Vocal.wav").is_ok());
        assert!(normalize_revision_file_path("04_Revisions/Revision_01/Revision_Notes.md").is_err());
        assert!(normalize_revision_file_path("04_Revisions/Revision_01").is_err());
        assert!(normalize_revision_file_path("04_Revisions/not-a-revision/Mix.wav").is_err());
        assert!(normalize_revision_file_path("../Revision_01/Mix.wav").is_err());
    }

    #[test]
    fn renames_and_deletes_regular_revision_files_without_touching_notes() {
        let project = TestDirectory::new();
        let revision = project.0.join("04_Revisions/Revision_01");
        fs::create_dir_all(&revision).expect("create revision");
        fs::write(revision.join("Revision_Notes.md"), b"notes").expect("write notes");
        fs::write(revision.join("Mix.WAV"), b"audio").expect("write mix");

        let renamed = rename_managed_revision_file(
            &project.0,
            "04_Revisions/Revision_01/Mix.WAV",
            "Mix Print",
        )
        .expect("rename revision file");
        assert_eq!(renamed, "04_Revisions/Revision_01/Mix Print.WAV");
        assert!(revision.join("Mix Print.WAV").is_file());

        let deleted = delete_managed_revision_file(&project.0, &renamed)
            .expect("delete revision file");
        assert_eq!(deleted, renamed);
        assert!(!revision.join("Mix Print.WAV").exists());
        assert!(revision.join("Revision_Notes.md").is_file());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_revision_files() {
        use std::os::unix::fs::symlink;

        let project = TestDirectory::new();
        let outside = TestDirectory::new();
        let revision = project.0.join("04_Revisions/Revision_01");
        fs::create_dir_all(&revision).expect("create revision");
        fs::write(outside.0.join("outside.wav"), b"audio").expect("write outside");
        symlink(outside.0.join("outside.wav"), revision.join("link.wav"))
            .expect("create symlink");

        assert!(resolve_revision_regular_file(
            &project.0,
            "04_Revisions/Revision_01/link.wav",
        )
        .is_err());
    }
}
