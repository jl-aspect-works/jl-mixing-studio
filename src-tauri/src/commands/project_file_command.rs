use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{
    ProjectFileArea, ProjectFileEntry, ProjectFileEntryType, ProjectFileListRequest,
    ProjectFileListing, ProjectFileMutationRequest, ProjectFileMutationResult,
    ProjectFilePermissions, ProjectFileRenameRequest, WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[tauri::command]
pub(crate) fn list_project_files(
    app: tauri::AppHandle,
    request: ProjectFileListRequest,
) -> Result<ProjectFileListing, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    list_project_directory(&project_directory, &request.relative_path)
}

#[tauri::command]
pub(crate) fn rename_project_file(
    app: tauri::AppHandle,
    request: ProjectFileRenameRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let relative_path = rename_audio_preparation_file(
        &project_directory,
        &request.relative_path,
        &request.new_name,
    )?;
    Ok(ProjectFileMutationResult { relative_path })
}

#[tauri::command]
pub(crate) fn delete_project_file(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let relative_path = delete_audio_preparation_file(&project_directory, &request.relative_path)?;
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

pub(crate) fn list_project_directory(
    project_directory: &Path,
    relative_path: &str,
) -> Result<ProjectFileListing, String> {
    let normalized = normalize_relative_path(relative_path)?;
    let directory = resolve_existing_directory(project_directory, &normalized)?;
    let area = project_file_area(&normalized);
    let permissions = permissions_for(area, ProjectFileEntryType::Directory, false);

    let entries = fs::read_dir(&directory)
        .map_err(|error| filesystem_error("read this project folder", error))?
        .map(|entry| {
            entry
                .map_err(|error| filesystem_error("read a project folder entry", error))
                .and_then(|entry| project_file_entry(&entry.path(), &normalized))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut entries = entries;
    entries.sort_by(|left, right| {
        let left_directory = matches!(left.entry_type, ProjectFileEntryType::Directory);
        let right_directory = matches!(right.entry_type, ProjectFileEntryType::Directory);
        right_directory
            .cmp(&left_directory)
            .then_with(|| {
                left.display_name
                    .to_lowercase()
                    .cmp(&right.display_name.to_lowercase())
            })
            .then_with(|| left.display_name.cmp(&right.display_name))
    });

    Ok(ProjectFileListing {
        relative_path: normalized,
        area,
        permissions,
        entries,
    })
}

fn project_file_entry(path: &Path, parent_relative: &str) -> Result<ProjectFileEntry, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| filesystem_error("inspect a project file", error))?;
    let file_type = metadata.file_type();
    let entry_type = if file_type.is_symlink() {
        ProjectFileEntryType::Symlink
    } else if file_type.is_file() {
        ProjectFileEntryType::File
    } else if file_type.is_dir() {
        ProjectFileEntryType::Directory
    } else {
        ProjectFileEntryType::Other
    };

    let display_name = path
        .file_name()
        .ok_or("A project file has no usable name")?
        .to_string_lossy()
        .into_owned();
    let relative_path = if parent_relative.is_empty() {
        display_name.clone()
    } else {
        format!("{parent_relative}/{display_name}")
    };
    let area = project_file_area(&relative_path);
    let extension = if matches!(entry_type, ProjectFileEntryType::File) {
        path.extension()
            .map(|extension| extension.to_string_lossy().to_lowercase())
    } else {
        None
    };
    let is_audio = extension.as_deref().is_some_and(is_audio_extension);
    let playable = cfg!(target_os = "macos")
        && extension
            .as_deref()
            .is_some_and(|extension| matches!(extension, "wav" | "wave" | "aif" | "aiff" | "mp3"));
    let modified_epoch_ms = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok());
    let symlink = matches!(entry_type, ProjectFileEntryType::Symlink);

    Ok(ProjectFileEntry {
        id: relative_path.clone(),
        relative_path,
        display_name,
        extension,
        entry_type,
        area,
        size_bytes: matches!(entry_type, ProjectFileEntryType::File).then_some(metadata.len()),
        modified_epoch_ms,
        is_audio,
        playable,
        permissions: permissions_for(area, entry_type, symlink),
    })
}

fn normalize_relative_path(relative_path: &str) -> Result<String, String> {
    let value = relative_path.trim();
    if value.is_empty() {
        return Ok(String::new());
    }
    if value.starts_with('/') || value.contains('\\') {
        return Err("Project file paths must be portable project-relative paths".into());
    }
    if value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return Err("Unsafe project file path segments are not allowed".into());
    }
    Ok(value.to_owned())
}

fn resolve_existing_directory(
    project_directory: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let canonical_project = canonical_project_root(project_directory)?;
    let current = walk_existing_path_without_symlinks(project_directory, relative_path)?;
    let canonical = current
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the selected project folder", error))?;
    if !canonical.starts_with(&canonical_project) || !canonical.is_dir() {
        return Err("The selected project folder could not be resolved safely".into());
    }
    Ok(canonical)
}

fn resolve_existing_regular_file(
    project_directory: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let normalized = normalize_relative_path(relative_path)?;
    if normalized.is_empty() {
        return Err("A project file path is required".into());
    }
    let canonical_project = canonical_project_root(project_directory)?;
    let current = walk_existing_path_without_symlinks(project_directory, &normalized)?;
    let metadata = fs::symlink_metadata(&current)
        .map_err(|error| filesystem_error("inspect the selected project file", error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Only regular project files can be changed".into());
    }
    let canonical = current
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the selected project file", error))?;
    if !canonical.starts_with(&canonical_project) {
        return Err("The selected project file could not be resolved safely".into());
    }
    Ok(canonical)
}

fn canonical_project_root(project_directory: &Path) -> Result<PathBuf, String> {
    let project_metadata = fs::symlink_metadata(project_directory)
        .map_err(|error| filesystem_error("inspect the project root", error))?;
    if project_metadata.file_type().is_symlink() || !project_metadata.is_dir() {
        return Err("The selected project root is unavailable or unsafe".into());
    }
    project_directory
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the project root", error))
}

fn walk_existing_path_without_symlinks(
    project_directory: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let mut current = project_directory.to_path_buf();
    if !relative_path.is_empty() {
        for component in relative_path.split('/') {
            current.push(component);
            let metadata = fs::symlink_metadata(&current)
                .map_err(|error| filesystem_error("resolve the selected project path", error))?;
            if metadata.file_type().is_symlink() {
                return Err("Symbolic-link project paths are not allowed".into());
            }
        }
    }
    Ok(current)
}

fn rename_audio_preparation_file(
    project_directory: &Path,
    relative_path: &str,
    new_stem: &str,
) -> Result<String, String> {
    let normalized = normalize_relative_path(relative_path)?;
    if project_file_area(&normalized) != ProjectFileArea::AudioPreparation {
        return Err("Rename is only available for files in Audio Preparation".into());
    }
    let source = resolve_existing_regular_file(project_directory, &normalized)?;
    let stem = validate_rename_stem(new_stem)?;
    let extension = source
        .extension()
        .map(|value| value.to_string_lossy().into_owned());
    let target_name = match extension.as_deref() {
        Some(extension) if !extension.is_empty() => format!("{stem}.{extension}"),
        _ => stem,
    };
    let source_name = source
        .file_name()
        .ok_or("The selected project file has no usable name")?
        .to_string_lossy()
        .into_owned();
    if source_name == target_name {
        return Err("The new file name is unchanged".into());
    }

    let parent = source
        .parent()
        .ok_or("The selected project file has no parent folder")?;
    reject_case_insensitive_collision(parent, &source_name, &target_name)?;
    let target = parent.join(&target_name);
    if target.exists() {
        return Err(format!(
            "A file named '{target_name}' already exists in this folder"
        ));
    }

    if source_name.eq_ignore_ascii_case(&target_name) {
        rename_case_only(&source, &target)?;
    } else {
        fs::rename(&source, &target)
            .map_err(|error| filesystem_error("rename the Audio Prep file", error))?;
    }

    let parent_relative = normalized
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    Ok(if parent_relative.is_empty() {
        target_name
    } else {
        format!("{parent_relative}/{target_name}")
    })
}

fn delete_audio_preparation_file(
    project_directory: &Path,
    relative_path: &str,
) -> Result<String, String> {
    let normalized = normalize_relative_path(relative_path)?;
    if project_file_area(&normalized) != ProjectFileArea::AudioPreparation {
        return Err("Delete is only available for files in Audio Preparation".into());
    }
    let source = resolve_existing_regular_file(project_directory, &normalized)?;
    fs::remove_file(&source)
        .map_err(|error| filesystem_error("delete the Audio Prep file", error))?;
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
        .ok_or("The selected project file has no parent folder")?;
    let mut attempt = 0_u32;
    let temporary = loop {
        attempt += 1;
        let candidate = parent.join(format!(
            ".jl-mixing-rename-{}-{attempt}",
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
        .map_err(|error| filesystem_error("prepare the case-only Audio Prep rename", error))?;
    if let Err(error) = fs::rename(&temporary, target) {
        let _ = fs::rename(&temporary, source);
        return Err(filesystem_error(
            "finish the case-only Audio Prep rename",
            error,
        ));
    }
    Ok(())
}

fn project_file_area(relative_path: &str) -> ProjectFileArea {
    let components = relative_path.split('/').collect::<Vec<_>>();
    match components.as_slice() {
        [""] => ProjectFileArea::ProjectRoot,
        ["00_Admin", ..] => ProjectFileArea::Admin,
        ["01_Client_Files", "Original_Delivery", ..] => ProjectFileArea::ClientOriginalDelivery,
        ["01_Client_Files", "References", ..] => ProjectFileArea::ClientReferences,
        ["01_Client_Files", "Documentation", ..] => ProjectFileArea::ClientDocumentation,
        ["01_Client_Files", ..] => ProjectFileArea::OtherManaged,
        ["02_Audio_Preparation", ..] => ProjectFileArea::AudioPreparation,
        ["03_DAW_Project", ..] => ProjectFileArea::DawProject,
        ["04_Revisions", ..] => ProjectFileArea::Revisions,
        ["05_Final_Delivery", ..] => ProjectFileArea::FinalDelivery,
        ["06_Recall", ..] => ProjectFileArea::Recall,
        _ => ProjectFileArea::OtherManaged,
    }
}

fn permissions_for(
    area: ProjectFileArea,
    entry_type: ProjectFileEntryType,
    symlink: bool,
) -> ProjectFilePermissions {
    if symlink || matches!(entry_type, ProjectFileEntryType::Other) {
        return ProjectFilePermissions {
            can_open: false,
            can_reveal: false,
            can_rename: false,
            can_delete: false,
            can_copy: false,
        };
    }

    let regular_file = matches!(entry_type, ProjectFileEntryType::File);
    let mutable_audio_prep_file = area == ProjectFileArea::AudioPreparation && regular_file;
    ProjectFilePermissions {
        can_open: true,
        can_reveal: true,
        can_rename: mutable_audio_prep_file,
        can_delete: mutable_audio_prep_file,
        can_copy: false,
    }
}

fn is_audio_extension(extension: &str) -> bool {
    matches!(
        extension,
        "wav" | "wave" | "aif" | "aiff" | "mp3" | "flac" | "m4a" | "aac"
    )
}

fn filesystem_error(action: &str, error: std::io::Error) -> String {
    format!("Unable to {action}: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "jl-mixing-studio-project-files-{}-{unique}",
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
    fn rejects_non_portable_and_traversal_paths() {
        assert!(normalize_relative_path("../outside").is_err());
        assert!(normalize_relative_path("01_Client_Files//Original_Delivery").is_err());
        assert!(normalize_relative_path("01_Client_Files\\Original_Delivery").is_err());
        assert!(normalize_relative_path("/absolute").is_err());
    }

    #[test]
    fn derives_permissions_from_authoritative_project_area() {
        let original = permissions_for(
            ProjectFileArea::ClientOriginalDelivery,
            ProjectFileEntryType::File,
            false,
        );
        assert!(!original.can_rename);
        assert!(!original.can_delete);

        let prep = permissions_for(
            ProjectFileArea::AudioPreparation,
            ProjectFileEntryType::File,
            false,
        );
        assert!(prep.can_rename);
        assert!(prep.can_delete);
        assert!(!prep.can_copy);

        let delivery = permissions_for(
            ProjectFileArea::FinalDelivery,
            ProjectFileEntryType::File,
            false,
        );
        assert!(!delivery.can_rename);
        assert!(!delivery.can_delete);
    }

    #[test]
    fn lists_normalized_entries_without_mutating_the_project() {
        let project = TestDirectory::new();
        let original = project.0.join("01_Client_Files/Original_Delivery");
        fs::create_dir_all(&original).expect("create original delivery");
        let mut file = fs::File::create(original.join("Lead Vocal.WAV")).expect("create audio");
        file.write_all(b"audio").expect("write audio");
        fs::create_dir(original.join("Session Notes")).expect("create folder");

        let listing = list_project_directory(&project.0, "01_Client_Files/Original_Delivery")
            .expect("list project files");

        assert_eq!(listing.area, ProjectFileArea::ClientOriginalDelivery);
        assert_eq!(listing.entries.len(), 2);
        assert_eq!(listing.entries[0].display_name, "Session Notes");
        let audio = listing
            .entries
            .iter()
            .find(|entry| entry.display_name == "Lead Vocal.WAV")
            .expect("audio entry");
        assert_eq!(audio.extension.as_deref(), Some("wav"));
        assert!(audio.is_audio);
        assert_eq!(audio.size_bytes, Some(5));
        assert!(!audio.permissions.can_rename);
        assert!(!audio.permissions.can_delete);
    }

    #[test]
    fn renames_only_audio_preparation_regular_files_and_preserves_extension() {
        let project = TestDirectory::new();
        let prep = project.0.join("02_Audio_Preparation/Working_Audio");
        fs::create_dir_all(&prep).expect("create prep");
        fs::write(prep.join("Lead Vocal.WAV"), b"audio").expect("write prep audio");

        let result = rename_audio_preparation_file(
            &project.0,
            "02_Audio_Preparation/Working_Audio/Lead Vocal.WAV",
            "Lead Vocal Clean",
        )
        .expect("rename prep file");

        assert_eq!(
            result,
            "02_Audio_Preparation/Working_Audio/Lead Vocal Clean.WAV"
        );
        assert!(!prep.join("Lead Vocal.WAV").exists());
        assert!(prep.join("Lead Vocal Clean.WAV").is_file());
        assert!(rename_audio_preparation_file(
            &project.0,
            "01_Client_Files/Original_Delivery/Lead Vocal.WAV",
            "Unsafe",
        )
        .is_err());
    }

    #[test]
    fn refuses_rename_collisions_and_nonportable_names() {
        let project = TestDirectory::new();
        let prep = project.0.join("02_Audio_Preparation/Working_Audio");
        fs::create_dir_all(&prep).expect("create prep");
        fs::write(prep.join("Lead.wav"), b"lead").expect("write lead");
        fs::write(prep.join("Vocal.wav"), b"vocal").expect("write vocal");

        assert!(rename_audio_preparation_file(
            &project.0,
            "02_Audio_Preparation/Working_Audio/Lead.wav",
            "vOcAl",
        )
        .is_err());
        assert!(rename_audio_preparation_file(
            &project.0,
            "02_Audio_Preparation/Working_Audio/Lead.wav",
            "bad:name",
        )
        .is_err());
    }

    #[test]
    fn deletes_only_audio_preparation_regular_files() {
        let project = TestDirectory::new();
        let prep = project.0.join("02_Audio_Preparation/Rejected_Files");
        fs::create_dir_all(&prep).expect("create rejected files");
        fs::write(prep.join("bad.wav"), b"bad").expect("write rejected file");

        let result = delete_audio_preparation_file(
            &project.0,
            "02_Audio_Preparation/Rejected_Files/bad.wav",
        )
        .expect("delete prep file");
        assert_eq!(result, "02_Audio_Preparation/Rejected_Files/bad.wav");
        assert!(!prep.join("bad.wav").exists());

        let original = project.0.join("01_Client_Files/Original_Delivery");
        fs::create_dir_all(&original).expect("create original delivery");
        fs::write(original.join("source.wav"), b"source").expect("write source");
        assert!(delete_audio_preparation_file(
            &project.0,
            "01_Client_Files/Original_Delivery/source.wav",
        )
        .is_err());
        assert!(original.join("source.wav").is_file());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_directory_traversal() {
        use std::os::unix::fs::symlink;

        let project = TestDirectory::new();
        let outside = TestDirectory::new();
        fs::create_dir_all(project.0.join("02_Audio_Preparation")).expect("create prep");
        symlink(&outside.0, project.0.join("02_Audio_Preparation/Outside"))
            .expect("create symlink");

        let error = list_project_directory(&project.0, "02_Audio_Preparation/Outside")
            .expect_err("symlink traversal must fail");
        assert!(error.contains("Symbolic-link"));
    }
}
