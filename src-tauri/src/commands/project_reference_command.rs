use super::resolve_workspace_root;
use super::workspace_command_support::validated_project_directory;
use crate::models::{
    ProjectFileListRequest, ProjectFileMutationRequest, ProjectFileMutationResult, WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;

const REFERENCES_PATH: &str = "01_Client_Files/References";

#[tauri::command]
pub(crate) fn add_project_reference(
    app: tauri::AppHandle,
    request: ProjectFileListRequest,
) -> Result<Option<ProjectFileMutationResult>, String> {
    let Some(source) = choose_reference_file()? else {
        return Ok(None);
    };
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let relative_path = copy_reference_into_project(&project_directory, &source)?;
    Ok(Some(ProjectFileMutationResult { relative_path }))
}

#[tauri::command]
pub(crate) fn delete_project_reference(
    app: tauri::AppHandle,
    request: ProjectFileMutationRequest,
) -> Result<ProjectFileMutationResult, String> {
    let project_directory =
        resolve_project_directory(&app, &request.client_id, &request.project_id)?;
    let relative_path = delete_reference_from_project(&project_directory, &request.relative_path)?;
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

fn copy_reference_into_project(project_directory: &Path, source: &Path) -> Result<String, String> {
    let source_metadata = fs::symlink_metadata(source)
        .map_err(|error| filesystem_error("inspect the selected reference", error))?;
    if source_metadata.file_type().is_symlink() || !source_metadata.is_file() {
        return Err("Only regular audio files can be added as references".into());
    }

    let extension = source
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .ok_or("Choose an audio reference file with a supported extension")?;
    if !is_audio_extension(&extension) {
        return Err("Choose a WAV, AIFF, MP3, FLAC, M4A, AAC, or MP4 reference".into());
    }

    let file_name = source
        .file_name()
        .ok_or("The selected reference has no usable file name")?
        .to_string_lossy()
        .into_owned();
    let references = validated_references_directory(project_directory)?;
    reject_case_insensitive_collision(&references, &file_name)?;
    let target = references.join(&file_name);
    if target.exists() {
        return Err(format!("A reference named '{file_name}' already exists"));
    }

    fs::copy(source, &target)
        .map_err(|error| filesystem_error("copy the reference into the project", error))?;
    Ok(format!("{REFERENCES_PATH}/{file_name}"))
}

fn delete_reference_from_project(
    project_directory: &Path,
    relative_path: &str,
) -> Result<String, String> {
    let normalized = normalize_reference_path(relative_path)?;
    let references = validated_references_directory(project_directory)?;
    let file_name = normalized
        .strip_prefix(&format!("{REFERENCES_PATH}/"))
        .ok_or("Delete is only available for project reference files")?;
    if file_name.contains('/') || file_name.is_empty() {
        return Err(
            "Delete is only available for reference files in the managed References folder".into(),
        );
    }
    let source = references.join(file_name);
    let metadata = fs::symlink_metadata(&source)
        .map_err(|error| filesystem_error("inspect the selected reference", error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Only regular project reference files can be deleted".into());
    }
    let canonical_source = source
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the selected reference", error))?;
    if !canonical_source.starts_with(&references) {
        return Err("The selected reference could not be resolved safely".into());
    }
    fs::remove_file(&canonical_source)
        .map_err(|error| filesystem_error("delete the project reference", error))?;
    Ok(normalized)
}

fn validated_references_directory(project_directory: &Path) -> Result<PathBuf, String> {
    let project_metadata = fs::symlink_metadata(project_directory)
        .map_err(|error| filesystem_error("inspect the project root", error))?;
    if project_metadata.file_type().is_symlink() || !project_metadata.is_dir() {
        return Err("The selected project root is unavailable or unsafe".into());
    }
    let canonical_project = project_directory
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the project root", error))?;
    let references = project_directory.join(REFERENCES_PATH);
    let metadata = fs::symlink_metadata(&references)
        .map_err(|error| filesystem_error("find the project References folder", error))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("The project References folder is unavailable or unsafe".into());
    }
    let canonical_references = references
        .canonicalize()
        .map_err(|error| filesystem_error("resolve the project References folder", error))?;
    if !canonical_references.starts_with(&canonical_project) {
        return Err("The project References folder could not be resolved safely".into());
    }
    Ok(canonical_references)
}

fn normalize_reference_path(relative_path: &str) -> Result<String, String> {
    let value = relative_path.trim();
    if value.starts_with('/') || value.contains('\\') {
        return Err("Reference paths must be portable project-relative paths".into());
    }
    if value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return Err("Unsafe project reference path segments are not allowed".into());
    }
    Ok(value.to_owned())
}

fn reject_case_insensitive_collision(directory: &Path, target_name: &str) -> Result<(), String> {
    for entry in fs::read_dir(directory)
        .map_err(|error| filesystem_error("check existing project references", error))?
    {
        let entry = entry.map_err(|error| filesystem_error("check a project reference", error))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.eq_ignore_ascii_case(target_name) {
            return Err(format!("A reference named '{name}' already exists"));
        }
    }
    Ok(())
}

fn is_audio_extension(extension: &str) -> bool {
    matches!(
        extension,
        "wav" | "wave" | "aif" | "aiff" | "mp3" | "flac" | "m4a" | "aac" | "mp4"
    )
}

#[cfg(target_os = "macos")]
fn choose_reference_file() -> Result<Option<PathBuf>, String> {
    let output = Command::new("/usr/bin/osascript")
        .args([
            "-e",
            "try",
            "-e",
            "POSIX path of (choose file with prompt \"Choose an audio reference\")",
            "-e",
            "on error number -128",
            "-e",
            "return \"\"",
            "-e",
            "end try",
        ])
        .output()
        .map_err(|error| filesystem_error("open the reference file picker", error))?;
    if !output.status.success() {
        return Err("Unable to open the reference file picker".into());
    }
    let selected = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    Ok((!selected.is_empty()).then(|| PathBuf::from(selected)))
}

#[cfg(target_os = "windows")]
fn choose_reference_file() -> Result<Option<PathBuf>, String> {
    let script = r#"Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Choose an audio reference'; $d.Filter = 'Audio files|*.wav;*.wave;*.aif;*.aiff;*.mp3;*.flac;*.m4a;*.aac;*.mp4|All files|*.*'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) }"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|error| filesystem_error("open the reference file picker", error))?;
    if !output.status.success() {
        return Err("Unable to open the reference file picker".into());
    }
    let selected = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    Ok((!selected.is_empty()).then(|| PathBuf::from(selected)))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn choose_reference_file() -> Result<Option<PathBuf>, String> {
    Err("Adding project references is currently supported on macOS and Windows".into())
}

fn filesystem_error(action: &str, error: std::io::Error) -> String {
    format!("Unable to {action}: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(tempfile::TempDir);

    impl TestDirectory {
        fn new() -> Self {
            let directory = tempfile::tempdir().expect("create test directory");
            fs::create_dir_all(directory.path().join(REFERENCES_PATH)).expect("create references");
            Self(directory)
        }

        fn path(&self) -> &Path {
            self.0.path()
        }
    }

    #[test]
    fn copies_supported_reference_without_touching_source() {
        let project = TestDirectory::new();
        let source_root = TestDirectory::new();
        let source = source_root.path().join("Reference.mp4");
        fs::write(&source, b"audio").expect("write source");

        let result = copy_reference_into_project(project.path(), &source).expect("copy reference");
        assert_eq!(result, "01_Client_Files/References/Reference.mp4");
        assert_eq!(fs::read(&source).expect("read source"), b"audio");
        assert_eq!(
            fs::read(project.path().join(&result)).expect("read copied reference"),
            b"audio"
        );
    }

    #[test]
    fn rejects_duplicate_and_non_audio_reference_imports() {
        let project = TestDirectory::new();
        let source_root = TestDirectory::new();
        let source = source_root.path().join("Reference.wav");
        fs::write(&source, b"audio").expect("write source");
        fs::write(
            project.path().join(REFERENCES_PATH).join("reference.WAV"),
            b"old",
        )
        .expect("write existing reference");
        assert!(copy_reference_into_project(project.path(), &source).is_err());

        let text = source_root.path().join("notes.txt");
        fs::write(&text, b"notes").expect("write text");
        assert!(copy_reference_into_project(project.path(), &text).is_err());
    }

    #[test]
    fn deletes_only_managed_reference_files() {
        let project = TestDirectory::new();
        let reference = project.path().join(REFERENCES_PATH).join("Reference.wav");
        fs::write(&reference, b"audio").expect("write reference");
        let result = delete_reference_from_project(
            project.path(),
            "01_Client_Files/References/Reference.wav",
        )
        .expect("delete reference");
        assert_eq!(result, "01_Client_Files/References/Reference.wav");
        assert!(!reference.exists());
        assert!(delete_reference_from_project(
            project.path(),
            "01_Client_Files/Original_Delivery/source.wav",
        )
        .is_err());
    }
}
