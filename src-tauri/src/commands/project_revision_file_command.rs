use super::os_metadata::is_ignored_os_metadata_path;
use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{
    ProjectFileMutationRequest, ProjectFileMutationResult, ProjectFileRenameRequest,
    WorkspaceStatus,
};
use crate::workspace;
use serde::Serialize;
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const REVISION_NOTES: &str = "Revision_Notes.md";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListeningSourceSelection {
    pub path: PathBuf,
    pub file_name: String,
    pub modified_at_ms: u128,
    pub explicit_override: bool,
}

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
    if components
        .iter()
        .any(|component| component.is_empty() || *component == "." || *component == "..")
    {
        return Err("Unsafe revision file path segments are not allowed".into());
    }
    if components.len() < 3
        || components[0] != "04_Revisions"
        || !is_revision_directory_name(components[1])
    {
        return Err("Revision file changes are limited to managed Revision_NN folders".into());
    }
    if components
        .last()
        .is_some_and(|name| *name == REVISION_NOTES)
    {
        return Err(
            "Revision_Notes.md is managed revision content and cannot be renamed or deleted".into(),
        );
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
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
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

fn normalize_listening_extension(required_extension: &str) -> Result<String, String> {
    let extension = required_extension.trim().trim_start_matches('.');
    if extension.is_empty()
        || extension.contains('/')
        || extension.contains('\\')
        || extension.contains('.')
    {
        return Err("Listening format must be a single file extension".into());
    }
    Ok(extension.to_ascii_lowercase())
}

fn listening_extension_matches(path: &Path, extension: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

fn listening_selection_for_file(
    path: PathBuf,
    explicit_override: bool,
) -> Result<ListeningSourceSelection, String> {
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| filesystem_error("inspect the listening source", error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Listening source must be a regular file".into());
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("Listening source filename must be valid UTF-8")?
        .to_owned();
    let modified_at_ms = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    Ok(ListeningSourceSelection {
        path,
        file_name,
        modified_at_ms,
        explicit_override,
    })
}

/// Reusable Phase 1 listening selector.
///
/// Automatic selection inspects only regular files directly in the revision root. It never
/// traverses `Variants/` or any other subdirectory. Explicit overrides are authoritative and may
/// point into `Variants/`; a format mismatch returns no selection rather than silently falling back.
pub(crate) fn select_listening_source(
    revision_root: &Path,
    required_extension: &str,
    explicit_override: Option<&Path>,
) -> Result<Option<ListeningSourceSelection>, String> {
    let extension = normalize_listening_extension(required_extension)?;

    if let Some(override_path) = explicit_override {
        if is_ignored_os_metadata_path(override_path)
            || !listening_extension_matches(override_path, &extension)
        {
            return Ok(None);
        }
        return listening_selection_for_file(override_path.to_path_buf(), true).map(Some);
    }

    let metadata = fs::symlink_metadata(revision_root)
        .map_err(|error| filesystem_error("inspect the revision folder", error))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Revision folder must be a regular directory".into());
    }

    let mut candidates = Vec::new();
    for entry in fs::read_dir(revision_root)
        .map_err(|error| filesystem_error("read the revision folder", error))?
    {
        let entry =
            entry.map_err(|error| filesystem_error("read a revision folder entry", error))?;
        let path = entry.path();
        if is_ignored_os_metadata_path(&path) || !listening_extension_matches(&path, &extension) {
            continue;
        }
        let entry_type = entry
            .file_type()
            .map_err(|error| filesystem_error("inspect a revision folder entry", error))?;
        if entry_type.is_symlink() || !entry_type.is_file() {
            continue;
        }
        candidates.push(listening_selection_for_file(path, false)?);
    }

    candidates.sort_by(
        |left, right| match left.modified_at_ms.cmp(&right.modified_at_ms) {
            Ordering::Equal => left.file_name.cmp(&right.file_name),
            ordering => ordering,
        },
    );
    Ok(candidates.pop())
}

fn filesystem_error(action: &str, error: std::io::Error) -> String {
    format!("Unable to {action}: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

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
        assert!(
            normalize_revision_file_path("04_Revisions/Revision_01/Revision_Notes.md").is_err()
        );
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

        let deleted =
            delete_managed_revision_file(&project.0, &renamed).expect("delete revision file");
        assert_eq!(deleted, renamed);
        assert!(!revision.join("Mix Print.WAV").exists());
        assert!(revision.join("Revision_Notes.md").is_file());
    }

    #[test]
    fn listening_selection_ignores_variants_and_matches_extension_case_insensitively() {
        let revision = TestDirectory::new();
        fs::write(revision.0.join("Primary.MP3"), b"primary").expect("write primary");
        let variants = revision.0.join("Variants");
        fs::create_dir(&variants).expect("create variants");
        fs::write(variants.join("Instrumental.mp3"), b"variant").expect("write variant");

        let selected = select_listening_source(&revision.0, ".mp3", None)
            .expect("select")
            .expect("matching source");
        assert_eq!(selected.file_name, "Primary.MP3");
        assert!(!selected.explicit_override);
    }

    #[test]
    fn listening_selection_chooses_newest_root_level_candidate() {
        let revision = TestDirectory::new();
        fs::write(revision.0.join("Older.wav"), b"old").expect("write older");
        thread::sleep(Duration::from_millis(20));
        fs::write(revision.0.join("Newer.WAV"), b"new").expect("write newer");

        let selected = select_listening_source(&revision.0, "wav", None)
            .expect("select")
            .expect("matching source");
        assert_eq!(selected.file_name, "Newer.WAV");
    }

    #[test]
    fn listening_selection_ignores_appledouble_candidates() {
        let revision = TestDirectory::new();
        fs::write(revision.0.join("Primary.mp3"), b"primary").expect("write primary");
        thread::sleep(Duration::from_millis(20));
        fs::write(revision.0.join("._Primary.mp3"), b"metadata").expect("write AppleDouble");

        let selected = select_listening_source(&revision.0, "mp3", None)
            .expect("select")
            .expect("matching source");
        assert_eq!(selected.file_name, "Primary.mp3");
    }

    #[test]
    fn listening_selection_rejects_os_metadata_override() {
        let revision = TestDirectory::new();
        let override_path = revision.0.join("._Primary.mp3");
        fs::write(&override_path, b"metadata").expect("write AppleDouble");

        assert!(
            select_listening_source(&revision.0, "mp3", Some(&override_path))
                .expect("select")
                .is_none()
        );
    }

    #[test]
    fn listening_selection_returns_none_when_format_is_missing() {
        let revision = TestDirectory::new();
        fs::write(revision.0.join("Primary.wav"), b"primary").expect("write primary");
        assert!(select_listening_source(&revision.0, "mp3", None)
            .expect("select")
            .is_none());
    }

    #[test]
    fn listening_selection_honors_explicit_variant_override() {
        let revision = TestDirectory::new();
        fs::write(revision.0.join("Primary.mp3"), b"primary").expect("write primary");
        let variants = revision.0.join("Variants");
        fs::create_dir(&variants).expect("create variants");
        let override_path = variants.join("Instrumental.mp3");
        fs::write(&override_path, b"variant").expect("write variant");

        let selected = select_listening_source(&revision.0, "mp3", Some(&override_path))
            .expect("select")
            .expect("override source");
        assert_eq!(selected.path, override_path);
        assert!(selected.explicit_override);
    }

    #[test]
    fn listening_override_format_mismatch_never_falls_back() {
        let revision = TestDirectory::new();
        fs::write(revision.0.join("Primary.mp3"), b"primary").expect("write primary");
        let override_path = revision.0.join("Primary.wav");
        fs::write(&override_path, b"wave").expect("write override");

        assert!(
            select_listening_source(&revision.0, "mp3", Some(&override_path))
                .expect("select")
                .is_none()
        );
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
        symlink(outside.0.join("outside.wav"), revision.join("link.wav")).expect("create symlink");

        assert!(
            resolve_revision_regular_file(&project.0, "04_Revisions/Revision_01/link.wav",)
                .is_err()
        );
    }
}
