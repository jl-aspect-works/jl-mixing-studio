use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::Manager;

use super::ListeningSourceSelection;
use crate::models::{
    ListeningConfiguration, ListeningDestination, ListeningPublishResult, ListeningPublishStatus,
};

const LISTENING_CONFIG_FILE: &str = "listening.json";
const LISTENING_CONFIG_VERSION: u32 = 1;

fn configuration_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(LISTENING_CONFIG_FILE))
        .map_err(|_| "Studio's local configuration directory could not be resolved".to_owned())
}

fn normalize_extension(value: &str) -> Result<String, String> {
    let extension = value.trim().trim_start_matches('.');
    if extension.is_empty()
        || extension.contains('/')
        || extension.contains('\\')
        || !extension
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        return Err(
            "Listening destination formats must be simple file extensions such as mp3 or wav"
                .into(),
        );
    }
    Ok(extension.to_ascii_lowercase())
}

fn normalize_destination(
    mut destination: ListeningDestination,
) -> Result<ListeningDestination, String> {
    destination.id = destination.id.trim().to_owned();
    if destination.id.is_empty() {
        return Err("Each listening destination requires a stable id".into());
    }
    if destination
        .id
        .chars()
        .any(|character| character.is_control())
    {
        return Err("Listening destination ids cannot contain control characters".into());
    }

    let path = PathBuf::from(destination.path.trim());
    if !path.is_absolute() {
        return Err(format!(
            "Listening destination '{}' must use an absolute filesystem path",
            destination.id
        ));
    }
    destination.path = path.to_string_lossy().into_owned();
    destination.required_extension = normalize_extension(&destination.required_extension)?;
    destination.name = destination.name.trim().to_owned();
    if destination.name.is_empty() {
        destination.name = format!(
            "{} Destination",
            destination.required_extension.to_ascii_uppercase()
        );
    }
    if destination
        .name
        .chars()
        .any(|character| character.is_control())
    {
        return Err("Listening destination names cannot contain control characters".into());
    }
    Ok(destination)
}

fn normalize_configuration(
    configuration: ListeningConfiguration,
) -> Result<ListeningConfiguration, String> {
    if configuration.version != LISTENING_CONFIG_VERSION {
        return Err(format!(
            "Unsupported listening configuration version {}",
            configuration.version
        ));
    }

    let mut seen = HashSet::new();
    let mut destinations = Vec::with_capacity(configuration.destinations.len());
    for destination in configuration.destinations {
        let destination = normalize_destination(destination)?;
        if !seen.insert(destination.id.clone()) {
            return Err(format!(
                "Listening destination id '{}' is duplicated",
                destination.id
            ));
        }
        destinations.push(destination);
    }

    Ok(ListeningConfiguration {
        version: LISTENING_CONFIG_VERSION,
        destinations,
    })
}

fn reserve_sibling(parent: &Path, target_name: &str, role: &str) -> Result<PathBuf, String> {
    for attempt in 1..=100_u32 {
        let candidate = parent.join(format!(
            ".{target_name}.jl-listening-{role}-{}-{attempt}",
            std::process::id()
        ));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!(
        "Unable to reserve a temporary file for '{target_name}'"
    ))
}

fn install_staged_file(
    stage: &Path,
    target: &Path,
    replace_existing: bool,
    description: &str,
) -> Result<(), String> {
    if !target.exists() {
        return fs::rename(stage, target)
            .map_err(|error| format!("Unable to install {description}: {error}"));
    }

    let metadata = fs::symlink_metadata(target)
        .map_err(|error| format!("Unable to inspect existing {description}: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "The {description} destination is occupied by a non-regular file"
        ));
    }
    if !replace_existing {
        return Err(format!("A {description} already exists at the destination"));
    }

    let parent = target
        .parent()
        .ok_or_else(|| format!("The {description} destination has no parent folder"))?;
    let target_name = target
        .file_name()
        .ok_or_else(|| format!("The {description} destination has no usable file name"))?
        .to_string_lossy()
        .into_owned();
    let backup = reserve_sibling(parent, &target_name, "backup")?;
    fs::rename(target, &backup)
        .map_err(|error| format!("Unable to stage the prior {description}: {error}"))?;

    match fs::rename(stage, target) {
        Ok(()) => {
            let _ = fs::remove_file(backup);
            Ok(())
        }
        Err(error) => {
            let _ = fs::rename(&backup, target);
            Err(format!("Unable to replace {description}: {error}"))
        }
    }
}

fn read_configuration(path: &Path) -> Result<ListeningConfiguration, String> {
    if !path.exists() {
        return Ok(ListeningConfiguration::default());
    }
    let content = fs::read_to_string(path)
        .map_err(|_| "Studio's saved listening configuration could not be read".to_owned())?;
    let configuration: ListeningConfiguration = serde_json::from_str(&content)
        .map_err(|_| "Studio's saved listening configuration is invalid".to_owned())?;
    normalize_configuration(configuration)
}

fn write_configuration(path: &Path, configuration: &ListeningConfiguration) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Studio's local listening configuration path is invalid")?;
    fs::create_dir_all(parent)
        .map_err(|_| "Studio's local configuration directory could not be created".to_owned())?;
    let content = serde_json::to_vec_pretty(configuration)
        .map_err(|_| "Studio's listening configuration could not be encoded".to_owned())?;
    let temporary = reserve_sibling(parent, LISTENING_CONFIG_FILE, "config-stage")?;
    fs::write(&temporary, content)
        .map_err(|_| "Studio's listening configuration could not be saved".to_owned())?;
    if let Err(error) = install_staged_file(&temporary, path, true, "listening configuration") {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }
    Ok(())
}

pub(crate) fn listening_configuration(
    app: &tauri::AppHandle,
) -> Result<ListeningConfiguration, String> {
    read_configuration(&configuration_path(app)?)
}

pub(crate) fn save_listening_configuration(
    app: &tauri::AppHandle,
    configuration: ListeningConfiguration,
) -> Result<ListeningConfiguration, String> {
    let normalized = normalize_configuration(configuration)?;
    write_configuration(&configuration_path(app)?, &normalized)?;
    Ok(normalized)
}

fn result(
    destination: &ListeningDestination,
    status: ListeningPublishStatus,
    message: impl Into<String>,
    source: Option<&Path>,
    target: Option<&Path>,
) -> ListeningPublishResult {
    ListeningPublishResult {
        destination_id: destination.id.clone(),
        status,
        message: message.into(),
        selected_source: source.map(|path| path.to_string_lossy().into_owned()),
        destination_path: target.map(|path| path.to_string_lossy().into_owned()),
    }
}

fn validate_destination_name(name: &str, required_extension: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Listening destination file names cannot be empty".into());
    }
    let path = Path::new(trimmed);
    if path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("Listening destination file names must be a single portable file name".into());
    }
    if trimmed.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) || trimmed.ends_with('.')
        || trimmed.ends_with(' ')
    {
        return Err(
            "The listening destination file name is not portable across macOS and Windows".into(),
        );
    }
    let extension = path
        .extension()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    if !extension.eq_ignore_ascii_case(required_extension) {
        return Err(format!(
            "Listening destination file names must keep the required .{required_extension} format"
        ));
    }
    Ok(trimmed.to_owned())
}

pub(crate) fn publish_listening_copy(
    selection: Option<&ListeningSourceSelection>,
    destination: &ListeningDestination,
    destination_file_name: Option<&str>,
    replace_existing: bool,
) -> ListeningPublishResult {
    let normalized = match normalize_destination(destination.clone()) {
        Ok(destination) => destination,
        Err(message) => {
            return result(
                destination,
                ListeningPublishStatus::Failed,
                message,
                selection.map(|selection| selection.path.as_path()),
                None,
            )
        }
    };
    if !normalized.enabled {
        return result(
            &normalized,
            ListeningPublishStatus::Skipped,
            "Listening destination is disabled",
            selection.map(|selection| selection.path.as_path()),
            None,
        );
    }
    let Some(selection) = selection else {
        return result(
            &normalized,
            ListeningPublishStatus::Skipped,
            format!("No .{} source is available", normalized.required_extension),
            None,
            None,
        );
    };

    let source = selection.path.as_path();
    if !fs::symlink_metadata(source)
        .is_ok_and(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
    {
        return result(
            &normalized,
            ListeningPublishStatus::Failed,
            "The selected listening source is unavailable or unsafe",
            Some(source),
            None,
        );
    }
    let source_extension = source
        .extension()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    if !source_extension.eq_ignore_ascii_case(&normalized.required_extension) {
        return result(
            &normalized,
            ListeningPublishStatus::Skipped,
            format!("No .{} source is available", normalized.required_extension),
            Some(source),
            None,
        );
    }

    let destination_root = PathBuf::from(&normalized.path);
    if !fs::metadata(&destination_root).is_ok_and(|metadata| metadata.is_dir()) {
        return result(
            &normalized,
            ListeningPublishStatus::Failed,
            "The listening destination folder is unavailable or inaccessible",
            Some(source),
            None,
        );
    }
    let canonical_destination = match destination_root.canonicalize() {
        Ok(path) => path,
        Err(error) => {
            return result(
                &normalized,
                ListeningPublishStatus::Failed,
                format!("The listening destination folder could not be resolved: {error}"),
                Some(source),
                None,
            )
        }
    };

    let default_name = source
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    let target_name = match validate_destination_name(
        destination_file_name.unwrap_or(&default_name),
        &normalized.required_extension,
    ) {
        Ok(name) => name,
        Err(message) => {
            return result(
                &normalized,
                ListeningPublishStatus::Failed,
                message,
                Some(source),
                None,
            )
        }
    };
    let target = canonical_destination.join(&target_name);
    let canonical_source = match source.canonicalize() {
        Ok(path) => path,
        Err(error) => {
            return result(
                &normalized,
                ListeningPublishStatus::Failed,
                format!("The selected listening source could not be resolved: {error}"),
                Some(source),
                Some(&target),
            )
        }
    };
    if canonical_source == target
        || (target.exists()
            && target
                .canonicalize()
                .is_ok_and(|canonical_target| canonical_target == canonical_source))
    {
        return result(
            &normalized,
            ListeningPublishStatus::Failed,
            "The listening destination cannot replace the authoritative source artifact",
            Some(source),
            Some(&target),
        );
    }

    if target.exists() && !replace_existing {
        return result(
            &normalized,
            ListeningPublishStatus::Failed,
            "A listening copy already exists at the destination",
            Some(source),
            Some(&target),
        );
    }

    let stage = match reserve_sibling(&canonical_destination, &target_name, "stage") {
        Ok(path) => path,
        Err(message) => {
            return result(
                &normalized,
                ListeningPublishStatus::Failed,
                message,
                Some(source),
                Some(&target),
            )
        }
    };
    if let Err(error) = fs::copy(&canonical_source, &stage) {
        return result(
            &normalized,
            ListeningPublishStatus::Failed,
            format!("Unable to copy the listening source: {error}"),
            Some(source),
            Some(&target),
        );
    }
    if let Err(message) = install_staged_file(&stage, &target, replace_existing, "listening copy") {
        let _ = fs::remove_file(&stage);
        return result(
            &normalized,
            ListeningPublishStatus::Failed,
            message,
            Some(source),
            Some(&target),
        );
    }

    result(
        &normalized,
        ListeningPublishStatus::Published,
        "Listening copy published",
        Some(source),
        Some(&target),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ListeningArtworkPolicy, ListeningMetadataPolicy, ListeningPublishClass};
    use std::time::UNIX_EPOCH;
    use tempfile::tempdir;

    fn destination(path: &Path, extension: &str) -> ListeningDestination {
        ListeningDestination {
            id: "revision-mp3".into(),
            name: "Test Destination".into(),
            enabled: true,
            publish_class: ListeningPublishClass::RevisionListening,
            path: path.to_string_lossy().into_owned(),
            required_extension: extension.into(),
            metadata_policy: ListeningMetadataPolicy::Replace,
            artwork_policy: ListeningArtworkPolicy::ReplaceWithStudioArtwork,
        }
    }

    fn selection(path: PathBuf) -> ListeningSourceSelection {
        let modified_at_ms = fs::metadata(&path)
            .expect("metadata")
            .modified()
            .expect("modified")
            .duration_since(UNIX_EPOCH)
            .expect("epoch")
            .as_millis();
        let file_name = path
            .file_name()
            .expect("name")
            .to_string_lossy()
            .into_owned();
        ListeningSourceSelection {
            path,
            file_name,
            modified_at_ms,
            explicit_override: false,
        }
    }

    #[test]
    fn configuration_round_trip_normalizes_extensions_and_preserves_independent_classes() {
        let temp = tempdir().expect("tempdir");
        let config_path = temp.path().join(LISTENING_CONFIG_FILE);
        let revision_path = temp.path().join("revision");
        let delivered_path = temp.path().join("delivered");
        let configuration = ListeningConfiguration {
            version: 1,
            destinations: vec![
                destination(&revision_path, ".MP3"),
                ListeningDestination {
                    id: "delivered-wav".into(),
                    publish_class: ListeningPublishClass::DeliveredListening,
                    path: delivered_path.to_string_lossy().into_owned(),
                    required_extension: "WAV".into(),
                    ..destination(&revision_path, "mp3")
                },
            ],
        };
        let normalized = normalize_configuration(configuration).expect("normalize");
        write_configuration(&config_path, &normalized).expect("write");
        let loaded = read_configuration(&config_path).expect("read");
        assert_eq!(loaded.destinations[0].required_extension, "mp3");
        assert_eq!(loaded.destinations[1].required_extension, "wav");
        assert_ne!(
            loaded.destinations[0].publish_class,
            loaded.destinations[1].publish_class
        );
    }

    #[test]
    fn missing_configuration_defaults_to_disabled_listening_for_existing_studios() {
        let temp = tempdir().expect("tempdir");
        let loaded = read_configuration(&temp.path().join(LISTENING_CONFIG_FILE))
            .expect("missing configuration");
        assert_eq!(loaded, ListeningConfiguration::default());
        assert!(loaded.destinations.is_empty());
    }

    #[test]
    fn configuration_without_destination_names_remains_compatible() {
        let temp = tempdir().expect("tempdir");
        let config_path = temp.path().join(LISTENING_CONFIG_FILE);
        let destination_path = temp.path().join("listening");
        fs::write(
            &config_path,
            format!(
                r#"{{"version":1,"destinations":[{{"id":"legacy","enabled":true,"publishClass":"revisionListening","path":{},"requiredExtension":"MP3","metadataPolicy":"off","artworkPolicy":"off"}}]}}"#,
                serde_json::to_string(&destination_path.to_string_lossy()).expect("path")
            ),
        )
        .expect("legacy configuration");

        let loaded = read_configuration(&config_path).expect("compatible configuration");
        assert_eq!(loaded.destinations[0].name, "MP3 Destination");
        assert_eq!(loaded.destinations[0].required_extension, "mp3");
    }

    #[test]
    fn configuration_defaults_missing_destination_name() {
        let temp = tempdir().expect("tempdir");
        let mut unnamed = destination(temp.path(), "mp3");
        unnamed.name.clear();
        let normalized = normalize_destination(unnamed).expect("normalize");
        assert_eq!(normalized.name, "MP3 Destination");
    }

    #[test]
    fn configuration_can_replace_existing_saved_settings() {
        let temp = tempdir().expect("tempdir");
        let config_path = temp.path().join(LISTENING_CONFIG_FILE);
        let first = normalize_configuration(ListeningConfiguration {
            version: 1,
            destinations: vec![destination(temp.path(), "mp3")],
        })
        .expect("first normalize");
        write_configuration(&config_path, &first).expect("first write");

        let second = normalize_configuration(ListeningConfiguration {
            version: 1,
            destinations: vec![destination(temp.path(), "wav")],
        })
        .expect("second normalize");
        write_configuration(&config_path, &second).expect("second write");

        let loaded = read_configuration(&config_path).expect("read replacement");
        assert_eq!(loaded.destinations[0].required_extension, "wav");
    }

    #[test]
    fn configuration_rejects_relative_paths_and_duplicate_ids() {
        let temp = tempdir().expect("tempdir");
        let mut invalid = destination(temp.path(), "mp3");
        invalid.path = "relative/listening".into();
        assert!(normalize_destination(invalid).is_err());

        let one = destination(temp.path(), "mp3");
        let two = destination(temp.path(), "wav");
        assert!(normalize_configuration(ListeningConfiguration {
            version: 1,
            destinations: vec![one, two],
        })
        .is_err());
    }

    #[test]
    fn publish_copies_bytes_without_mutating_source_and_supports_renaming() {
        let source_dir = tempdir().expect("source");
        let destination_dir = tempdir().expect("destination");
        let source = source_dir.path().join("Song - R04.MP3");
        let bytes = b"authoritative source bytes";
        fs::write(&source, bytes).expect("write source");
        let source_before = fs::read(&source).expect("read before");

        let result = publish_listening_copy(
            Some(&selection(source.clone())),
            &destination(destination_dir.path(), "mp3"),
            Some("Artist - Song - R04.mp3"),
            false,
        );
        assert_eq!(result.status, ListeningPublishStatus::Published);
        assert_eq!(
            fs::read(destination_dir.path().join("Artist - Song - R04.mp3")).expect("published"),
            bytes
        );
        assert_eq!(fs::read(source).expect("read after"), source_before);
    }

    #[test]
    fn missing_required_format_is_skipped_without_fallback() {
        let source_dir = tempdir().expect("source");
        let destination_dir = tempdir().expect("destination");
        let source = source_dir.path().join("Song.mp3");
        fs::write(&source, b"mp3").expect("write");

        let result = publish_listening_copy(
            Some(&selection(source)),
            &destination(destination_dir.path(), "wav"),
            None,
            false,
        );
        assert_eq!(result.status, ListeningPublishStatus::Skipped);
        assert!(fs::read_dir(destination_dir.path())
            .expect("read destination")
            .next()
            .is_none());
    }

    #[test]
    fn delivered_style_replacement_replaces_prior_copy() {
        let source_dir = tempdir().expect("source");
        let destination_dir = tempdir().expect("destination");
        let source = source_dir.path().join("Song.mp3");
        let target = destination_dir.path().join("Artist - Song.mp3");
        fs::write(&source, b"new").expect("write source");
        fs::write(&target, b"old").expect("write old");

        let result = publish_listening_copy(
            Some(&selection(source)),
            &destination(destination_dir.path(), "mp3"),
            Some("Artist - Song.mp3"),
            true,
        );
        assert_eq!(result.status, ListeningPublishStatus::Published);
        assert_eq!(fs::read(target).expect("read target"), b"new");
    }

    #[test]
    fn existing_copy_without_replacement_is_failed_and_preserved() {
        let source_dir = tempdir().expect("source");
        let destination_dir = tempdir().expect("destination");
        let source = source_dir.path().join("Song.mp3");
        let target = destination_dir.path().join("Song.mp3");
        fs::write(&source, b"new").expect("write source");
        fs::write(&target, b"old").expect("write old");

        let result = publish_listening_copy(
            Some(&selection(source)),
            &destination(destination_dir.path(), "mp3"),
            None,
            false,
        );
        assert_eq!(result.status, ListeningPublishStatus::Failed);
        assert_eq!(fs::read(target).expect("read target"), b"old");
    }

    #[test]
    fn unavailable_destination_is_failed() {
        let source_dir = tempdir().expect("source");
        let source = source_dir.path().join("Song.mp3");
        fs::write(&source, b"source").expect("write source");
        let unavailable = source_dir.path().join("not-mounted");

        let result = publish_listening_copy(
            Some(&selection(source)),
            &destination(&unavailable, "mp3"),
            None,
            false,
        );
        assert_eq!(result.status, ListeningPublishStatus::Failed);
    }

    #[test]
    fn publisher_refuses_to_replace_authoritative_source() {
        let source_dir = tempdir().expect("source");
        let source = source_dir.path().join("Song.mp3");
        fs::write(&source, b"source").expect("write source");

        let result = publish_listening_copy(
            Some(&selection(source.clone())),
            &destination(source_dir.path(), "mp3"),
            None,
            true,
        );
        assert_eq!(result.status, ListeningPublishStatus::Failed);
        assert_eq!(fs::read(source).expect("source remains"), b"source");
    }
}
