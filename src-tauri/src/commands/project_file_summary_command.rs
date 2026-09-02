use super::os_metadata::is_ignored_os_metadata_path;
use super::resolve_workspace_root;
use crate::models::{ProjectFileFolderSummary, ProjectFileListRequest, ProjectFileSummary};
use crate::workspace;
use std::fs;
use std::path::Path;
use std::thread;

const CLIENT_FILES: &str = "01_Client_Files";
const REFERENCES: &str = "01_Client_Files/References";
const AUDIO_PREPARATION: &str = "02_Audio_Preparation";
const WORKING_AUDIO: &str = "02_Audio_Preparation/Working_Audio";
const DAW_PROJECT: &str = "03_DAW_Project";
const REVISIONS: &str = "04_Revisions";
const FINAL_DELIVERY: &str = "05_Final_Delivery";
const RECALL: &str = "06_Recall";
const SUMMARY_AREAS: [&str; 6] = [
    CLIENT_FILES,
    AUDIO_PREPARATION,
    DAW_PROJECT,
    REVISIONS,
    FINAL_DELIVERY,
    RECALL,
];

#[tauri::command]
pub(crate) async fn summarize_project_files(
    app: tauri::AppHandle,
    request: ProjectFileListRequest,
) -> Result<ProjectFileSummary, String> {
    tauri::async_runtime::spawn_blocking(move || summarize_project_files_blocking(&app, &request))
        .await
        .map_err(|error| format!("Project indexing task failed: {error}"))?
}

fn summarize_project_files_blocking(
    app: &tauri::AppHandle,
    request: &ProjectFileListRequest,
) -> Result<ProjectFileSummary, String> {
    let root = resolve_workspace_root(app)?;
    let project_directory = workspace::find_validated_project_path(
        &root,
        request.client_id.trim(),
        request.project_id.trim(),
    )
    .ok_or_else(|| "The selected project could not be resolved safely".to_owned())?;

    summarize_project_directory(&project_directory)
}

fn empty_summary() -> ProjectFileSummary {
    ProjectFileSummary {
        client_files: ProjectFileFolderSummary::default(),
        audio_preparation: ProjectFileFolderSummary::default(),
        daw_project: ProjectFileFolderSummary::default(),
        revisions: ProjectFileFolderSummary::default(),
        final_delivery: ProjectFileFolderSummary::default(),
        recall: ProjectFileFolderSummary::default(),
        references_count: 0,
        working_audio_count: 0,
        working_audio_area_present: false,
        failed_paths: Vec::new(),
    }
}

fn summarize_project_directory(project_directory: &Path) -> Result<ProjectFileSummary, String> {
    let canonical_project = project_directory
        .canonicalize()
        .map_err(|error| format!("The selected project root could not be resolved: {error}"))?;
    if !canonical_project.is_dir() {
        return Err("The selected project root is unavailable".to_owned());
    }

    let partials = thread::scope(|scope| {
        SUMMARY_AREAS
            .iter()
            .map(|relative_area| {
                let project_root = &canonical_project;
                scope.spawn(move || summarize_area(project_root, relative_area))
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(|handle| {
                handle.join().unwrap_or_else(|_| {
                    let mut failed = empty_summary();
                    failed
                        .failed_paths
                        .push("Project indexing worker failed".to_owned());
                    failed
                })
            })
            .collect::<Vec<_>>()
    });

    let mut summary = empty_summary();
    for partial in partials {
        merge_summary(&mut summary, partial);
    }
    Ok(summary)
}

fn summarize_area(project_root: &Path, relative_area: &str) -> ProjectFileSummary {
    let mut summary = empty_summary();
    let area_path = project_root.join(relative_area);
    let metadata = match fs::symlink_metadata(&area_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return summary,
        Err(_) => {
            summary.failed_paths.push(relative_area.to_owned());
            return summary;
        }
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return summary;
    }

    let _ = walk_project_directory(project_root, &area_path, relative_area, 1, &mut summary);
    summary
}

fn merge_folder(target: &mut ProjectFileFolderSummary, source: ProjectFileFolderSummary) {
    target.file_count = target.file_count.saturating_add(source.file_count);
    target.size_bytes = target.size_bytes.saturating_add(source.size_bytes);
}

fn merge_summary(target: &mut ProjectFileSummary, source: ProjectFileSummary) {
    merge_folder(&mut target.client_files, source.client_files);
    merge_folder(&mut target.audio_preparation, source.audio_preparation);
    merge_folder(&mut target.daw_project, source.daw_project);
    merge_folder(&mut target.revisions, source.revisions);
    merge_folder(&mut target.final_delivery, source.final_delivery);
    merge_folder(&mut target.recall, source.recall);
    target.references_count = target
        .references_count
        .saturating_add(source.references_count);
    target.working_audio_count = target
        .working_audio_count
        .saturating_add(source.working_audio_count);
    target.working_audio_area_present |= source.working_audio_area_present;
    target.failed_paths.extend(source.failed_paths);
}

fn walk_project_directory(
    project_root: &Path,
    directory: &Path,
    relative_directory: &str,
    depth: usize,
    summary: &mut ProjectFileSummary,
) -> Result<(), String> {
    if depth > 64 {
        summary.failed_paths.push(relative_directory.to_owned());
        return Ok(());
    }

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if relative_directory.is_empty() => {
            return Err(format!("The project root could not be read: {error}"));
        }
        Err(_) => {
            summary.failed_paths.push(relative_directory.to_owned());
            return Ok(());
        }
    };

    for result in entries {
        let entry = match result {
            Ok(entry) => entry,
            Err(_) => {
                summary.failed_paths.push(relative_directory.to_owned());
                continue;
            }
        };
        let path = entry.path();
        if is_ignored_os_metadata_path(&path) {
            continue;
        }
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => {
                summary
                    .failed_paths
                    .push(relative_path(project_root, &path));
                continue;
            }
        };
        if metadata.file_type().is_symlink() {
            continue;
        }

        let relative = relative_path(project_root, &path);
        if metadata.is_dir() {
            if relative == WORKING_AUDIO {
                summary.working_audio_area_present = true;
            }
            walk_project_directory(project_root, &path, &relative, depth + 1, summary)?;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }

        account_file(summary, &relative, metadata.len());
    }

    Ok(())
}

fn account_file(summary: &mut ProjectFileSummary, relative_path: &str, size_bytes: u64) {
    if path_matches(relative_path, CLIENT_FILES) {
        add_file(&mut summary.client_files, size_bytes);
    } else if path_matches(relative_path, AUDIO_PREPARATION) {
        add_file(&mut summary.audio_preparation, size_bytes);
    } else if path_matches(relative_path, DAW_PROJECT) {
        add_file(&mut summary.daw_project, size_bytes);
    } else if path_matches(relative_path, REVISIONS) {
        add_file(&mut summary.revisions, size_bytes);
    } else if path_matches(relative_path, FINAL_DELIVERY) {
        add_file(&mut summary.final_delivery, size_bytes);
    } else if path_matches(relative_path, RECALL) {
        add_file(&mut summary.recall, size_bytes);
    }

    if path_matches(relative_path, REFERENCES) {
        summary.references_count += 1;
    }
    if path_matches(relative_path, WORKING_AUDIO) {
        summary.working_audio_count += 1;
    }
}

fn add_file(summary: &mut ProjectFileFolderSummary, size_bytes: u64) {
    summary.file_count += 1;
    summary.size_bytes = summary.size_bytes.saturating_add(size_bytes);
}

fn path_matches(path: &str, prefix: &str) -> bool {
    path == prefix
        || path
            .strip_prefix(prefix)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn summary_counts_only_the_selected_project_tree() {
        let root =
            std::env::temp_dir().join(format!("jl-studio-project-summary-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("01_Client_Files/References")).unwrap();
        fs::create_dir_all(root.join("02_Audio_Preparation/Working_Audio")).unwrap();
        fs::create_dir_all(root.join("03_DAW_Project")).unwrap();
        fs::write(root.join("01_Client_Files/References/ref.wav"), b"1234").unwrap();
        fs::write(
            root.join("02_Audio_Preparation/Working_Audio/track.wav"),
            b"123456",
        )
        .unwrap();
        fs::write(root.join("03_DAW_Project/session.logicx"), b"12").unwrap();

        let summary = summarize_project_directory(&root).unwrap();
        assert_eq!(summary.client_files.file_count, 1);
        assert_eq!(summary.audio_preparation.file_count, 1);
        assert_eq!(summary.daw_project.file_count, 1);
        assert_eq!(summary.references_count, 1);
        assert_eq!(summary.working_audio_count, 1);
        assert!(summary.working_audio_area_present);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn summary_combines_independent_managed_areas() {
        let root = std::env::temp_dir().join(format!(
            "jl-studio-project-summary-parallel-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("04_Revisions/Revision_01")).unwrap();
        fs::create_dir_all(root.join("05_Final_Delivery")).unwrap();
        fs::write(root.join("04_Revisions/Revision_01/mix.wav"), b"123").unwrap();
        fs::write(root.join("05_Final_Delivery/mix.wav"), b"12345").unwrap();

        let summary = summarize_project_directory(&root).unwrap();
        assert_eq!(summary.revisions.file_count, 1);
        assert_eq!(summary.revisions.size_bytes, 3);
        assert_eq!(summary.final_delivery.file_count, 1);
        assert_eq!(summary.final_delivery.size_bytes, 5);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn summary_ignores_os_metadata_but_preserves_other_dotfiles() {
        let root = std::env::temp_dir().join(format!(
            "jl-studio-project-summary-os-metadata-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let revision = root.join("04_Revisions/Revision_01");
        fs::create_dir_all(&revision).unwrap();
        fs::write(revision.join("mix.wav"), b"1234").unwrap();
        fs::write(revision.join(".DS_Store"), b"ignored").unwrap();
        fs::write(revision.join("._mix.wav"), b"ignored").unwrap();
        fs::write(revision.join("Thumbs.db"), b"ignored").unwrap();
        fs::write(revision.join("desktop.ini"), b"ignored").unwrap();
        fs::write(revision.join(".mix-notes"), b"12").unwrap();

        let summary = summarize_project_directory(&root).unwrap();
        assert_eq!(summary.revisions.file_count, 2);
        assert_eq!(summary.revisions.size_bytes, 6);

        let _ = fs::remove_dir_all(&root);
    }
}
