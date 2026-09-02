use super::os_metadata::is_ignored_os_metadata_path;
use super::resolve_workspace_root;
use crate::models::WorkspaceStorageSummary;
use std::fs;
use std::path::Path;

#[tauri::command]
pub(crate) async fn summarize_workspace_storage(
    app: tauri::AppHandle,
) -> Result<WorkspaceStorageSummary, String> {
    tauri::async_runtime::spawn_blocking(move || summarize_workspace_storage_blocking(&app))
        .await
        .map_err(|error| format!("Workspace indexing task failed: {error}"))?
}

fn summarize_workspace_storage_blocking(
    app: &tauri::AppHandle,
) -> Result<WorkspaceStorageSummary, String> {
    let root = resolve_workspace_root(app)?;
    summarize_workspace_directory(&root)
}

fn summarize_workspace_directory(root: &Path) -> Result<WorkspaceStorageSummary, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("The workspace root could not be resolved: {error}"))?;
    if !canonical_root.is_dir() {
        return Err("The workspace root is unavailable".to_owned());
    }

    let mut summary = WorkspaceStorageSummary::default();
    walk_workspace_directory(&canonical_root, &canonical_root, "", 0, &mut summary)?;
    Ok(summary)
}

fn walk_workspace_directory(
    workspace_root: &Path,
    directory: &Path,
    relative_directory: &str,
    depth: usize,
    summary: &mut WorkspaceStorageSummary,
) -> Result<(), String> {
    if depth > 64 {
        summary.failed_paths.push(relative_directory.to_owned());
        return Ok(());
    }

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if relative_directory.is_empty() => {
            return Err(format!("The workspace root could not be read: {error}"));
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
                    .push(relative_path(workspace_root, &path));
                continue;
            }
        };

        // Storage indexing never follows symlinks, so a link inside the workspace cannot
        // cause traversal or count data outside the configured workspace root.
        if metadata.file_type().is_symlink() {
            continue;
        }

        let relative = relative_path(workspace_root, &path);
        if metadata.is_dir() {
            walk_workspace_directory(workspace_root, &path, &relative, depth + 1, summary)?;
            continue;
        }
        if metadata.is_file() {
            summary.file_count = summary.file_count.saturating_add(1);
            summary.size_bytes = summary.size_bytes.saturating_add(metadata.len());
        }
    }

    Ok(())
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

    #[test]
    fn summary_counts_workspace_files_recursively() {
        let root = std::env::temp_dir().join(format!(
            "jl-studio-workspace-storage-summary-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("Clients/Client/Projects/Project")).unwrap();
        fs::write(root.join("studio.json"), b"1234").unwrap();
        fs::write(
            root.join("Clients/Client/Projects/Project/mix.wav"),
            b"123456",
        )
        .unwrap();

        let summary = summarize_workspace_directory(&root).unwrap();
        assert_eq!(summary.file_count, 2);
        assert_eq!(summary.size_bytes, 10);
        assert!(summary.failed_paths.is_empty());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn summary_ignores_os_metadata_but_keeps_legitimate_dotfiles() {
        let root = std::env::temp_dir().join(format!(
            "jl-studio-workspace-storage-os-metadata-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("mix.wav"), b"1234").unwrap();
        fs::write(root.join(".DS_Store"), b"ignored").unwrap();
        fs::write(root.join("._mix.wav"), b"ignored").unwrap();
        fs::write(root.join("Thumbs.db"), b"ignored").unwrap();
        fs::write(root.join("desktop.ini"), b"ignored").unwrap();
        fs::write(root.join(".studio-note"), b"12").unwrap();

        let summary = summarize_workspace_directory(&root).unwrap();
        assert_eq!(summary.file_count, 2);
        assert_eq!(summary.size_bytes, 6);

        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn summary_does_not_follow_symlinks_outside_workspace() {
        use std::os::unix::fs::symlink;

        let root = std::env::temp_dir().join(format!(
            "jl-studio-workspace-storage-symlink-{}",
            std::process::id()
        ));
        let outside = std::env::temp_dir().join(format!(
            "jl-studio-workspace-storage-outside-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(root.join("inside.txt"), b"12").unwrap();
        fs::write(outside.join("outside.txt"), b"123456").unwrap();
        symlink(&outside, root.join("external")).unwrap();

        let summary = summarize_workspace_directory(&root).unwrap();
        assert_eq!(summary.file_count, 1);
        assert_eq!(summary.size_bytes, 2);

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }
}
