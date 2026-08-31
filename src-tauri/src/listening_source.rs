use serde::Serialize;
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListeningSourceSelection {
    pub path: PathBuf,
    pub file_name: String,
    pub modified_at_ms: u128,
    pub explicit_override: bool,
}

fn normalized_extension(required_extension: &str) -> Result<String, String> {
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

fn file_extension_matches(path: &Path, extension: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

fn modified_at_ms(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn selection_for_file(path: PathBuf, explicit_override: bool) -> Result<ListeningSourceSelection, String> {
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Listening source could not be inspected: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Listening source must be a regular file".into());
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("Listening source filename must be valid UTF-8")?
        .to_owned();
    Ok(ListeningSourceSelection {
        path,
        file_name,
        modified_at_ms: modified_at_ms(&metadata),
        explicit_override,
    })
}

/// Select the primary listening source for one required format.
///
/// Automatic selection considers only regular files directly inside `revision_root`.
/// Subdirectories (including `Variants/`) and symlinks are never traversed or selected.
/// An explicit override is authoritative: if it does not match the required extension,
/// selection returns `None` rather than silently falling back to another file.
pub(crate) fn select_listening_source(
    revision_root: &Path,
    required_extension: &str,
    explicit_override: Option<&Path>,
) -> Result<Option<ListeningSourceSelection>, String> {
    let extension = normalized_extension(required_extension)?;

    if let Some(override_path) = explicit_override {
        if !file_extension_matches(override_path, &extension) {
            return Ok(None);
        }
        return selection_for_file(override_path.to_path_buf(), true).map(Some);
    }

    let metadata = fs::symlink_metadata(revision_root)
        .map_err(|error| format!("Revision folder could not be inspected: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Revision folder must be a regular directory".into());
    }

    let mut candidates = Vec::new();
    for entry in fs::read_dir(revision_root)
        .map_err(|error| format!("Revision folder could not be read: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Revision folder entry could not be read: {error}"))?;
        let path = entry.path();
        if !file_extension_matches(&path, &extension) {
            continue;
        }
        let entry_type = entry
            .file_type()
            .map_err(|error| format!("Revision folder entry could not be inspected: {error}"))?;
        if entry_type.is_symlink() || !entry_type.is_file() {
            continue;
        }
        candidates.push(selection_for_file(path, false)?);
    }

    candidates.sort_by(|left, right| {
        match left.modified_at_ms.cmp(&right.modified_at_ms) {
            Ordering::Equal => left.file_name.cmp(&right.file_name),
            ordering => ordering,
        }
    });
    Ok(candidates.pop())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::thread;
    use std::time::Duration;
    use tempfile::tempdir;

    #[test]
    fn selects_only_root_level_matching_files_case_insensitively() {
        let directory = tempdir().unwrap();
        File::create(directory.path().join("Mix.MP3")).unwrap();
        let variants = directory.path().join("Variants");
        fs::create_dir(&variants).unwrap();
        File::create(variants.join("Newer.mp3")).unwrap();

        let selected = select_listening_source(directory.path(), ".mp3", None)
            .unwrap()
            .unwrap();
        assert_eq!(selected.file_name, "Mix.MP3");
        assert!(!selected.explicit_override);
    }

    #[test]
    fn chooses_newest_matching_root_level_file() {
        let directory = tempdir().unwrap();
        File::create(directory.path().join("Older.wav")).unwrap();
        thread::sleep(Duration::from_millis(20));
        File::create(directory.path().join("Newer.WAV")).unwrap();

        let selected = select_listening_source(directory.path(), "wav", None)
            .unwrap()
            .unwrap();
        assert_eq!(selected.file_name, "Newer.WAV");
    }

    #[test]
    fn uses_filename_as_deterministic_tie_break() {
        let directory = tempdir().unwrap();
        File::create(directory.path().join("A.mp3")).unwrap();
        File::create(directory.path().join("B.mp3")).unwrap();

        let a = directory.path().join("A.mp3");
        let b = directory.path().join("B.mp3");
        let a_time = fs::metadata(&a).unwrap().modified().unwrap();
        let b_time = fs::metadata(&b).unwrap().modified().unwrap();
        if a_time == b_time {
            let selected = select_listening_source(directory.path(), "mp3", None)
                .unwrap()
                .unwrap();
            assert_eq!(selected.file_name, "B.mp3");
        }
    }

    #[test]
    fn returns_none_when_required_format_is_missing() {
        let directory = tempdir().unwrap();
        File::create(directory.path().join("Mix.wav")).unwrap();
        assert!(select_listening_source(directory.path(), "mp3", None)
            .unwrap()
            .is_none());
    }

    #[test]
    fn explicit_variant_override_takes_precedence_when_format_matches() {
        let directory = tempdir().unwrap();
        File::create(directory.path().join("Primary.mp3")).unwrap();
        let variants = directory.path().join("Variants");
        fs::create_dir(&variants).unwrap();
        let variant = variants.join("Instrumental.mp3");
        File::create(&variant).unwrap();

        let selected = select_listening_source(directory.path(), "mp3", Some(&variant))
            .unwrap()
            .unwrap();
        assert_eq!(selected.path, variant);
        assert!(selected.explicit_override);
    }

    #[test]
    fn explicit_override_format_mismatch_does_not_fall_back() {
        let directory = tempdir().unwrap();
        File::create(directory.path().join("Primary.mp3")).unwrap();
        let override_path = directory.path().join("Primary.wav");
        File::create(&override_path).unwrap();

        assert!(select_listening_source(directory.path(), "mp3", Some(&override_path))
            .unwrap()
            .is_none());
    }
}
