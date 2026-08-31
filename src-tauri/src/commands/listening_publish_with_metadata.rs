use std::path::Path;

use crate::models::{
    ListeningConfiguration, ListeningDestination, ListeningPublishResult, ListeningPublishStatus,
};

use super::listening_metadata::apply_listening_metadata;
use super::{listening_publish_base as base, ListeningSourceSelection};

pub(crate) fn listening_configuration(
    app: &tauri::AppHandle,
) -> Result<ListeningConfiguration, String> {
    base::listening_configuration(app)
}

pub(crate) fn save_listening_configuration(
    app: &tauri::AppHandle,
    configuration: ListeningConfiguration,
) -> Result<ListeningConfiguration, String> {
    base::save_listening_configuration(app, configuration)
}

pub(crate) fn publish_listening_copy(
    selection: Option<&ListeningSourceSelection>,
    destination: &ListeningDestination,
    destination_file_name: Option<&str>,
    replace_existing: bool,
) -> ListeningPublishResult {
    let mut result = base::publish_listening_copy(
        selection,
        destination,
        destination_file_name,
        replace_existing,
    );
    if result.status != ListeningPublishStatus::Published {
        return result;
    }

    let (Some(source), Some(target)) = (
        result.selected_source.as_deref(),
        result.destination_path.as_deref(),
    ) else {
        return result;
    };
    if let Some(metadata_message) = apply_listening_metadata(
        Path::new(target),
        Path::new(source),
        destination.metadata_policy,
    ) {
        result.message = format!("{}; {metadata_message}", result.message);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        ListeningArtworkPolicy, ListeningMetadataPolicy, ListeningPublishClass,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::time::UNIX_EPOCH;
    use tempfile::tempdir;

    fn destination(path: &Path, policy: ListeningMetadataPolicy) -> ListeningDestination {
        ListeningDestination {
            id: "revision-wav".into(),
            enabled: true,
            publish_class: ListeningPublishClass::RevisionListening,
            path: path.to_string_lossy().into_owned(),
            required_extension: "wav".into(),
            metadata_policy: policy,
            artwork_policy: ListeningArtworkPolicy::Off,
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
    fn metadata_failure_is_observable_without_blocking_published_copy_or_touching_source() {
        let temp = tempdir().expect("tempdir");
        let client = temp.path().join("Clients").join("client-a");
        let project = client.join("Projects").join("song-a");
        let revision = project.join("04_Revisions").join("Revision_05");
        let destination_root = temp.path().join("listening");
        fs::create_dir_all(project.join("00_Admin")).expect("admin");
        fs::create_dir_all(&revision).expect("revision");
        fs::create_dir_all(&destination_root).expect("destination");
        fs::write(
            client.join("client.json"),
            r#"{"client_name":"Client Name"}"#,
        )
        .expect("client");
        fs::write(
            project.join("00_Admin").join("project-manifest.json"),
            r#"{"project_name":"Song Name","state":{"delivered_revision":null}}"#,
        )
        .expect("project");
        let source = revision.join("Song Name - R05.wav");
        let original = b"not-a-real-wave-but-copyable";
        fs::write(&source, original).expect("source");

        let result = publish_listening_copy(
            Some(&selection(source.clone())),
            &destination(&destination_root, ListeningMetadataPolicy::Replace),
            None,
            true,
        );

        assert_eq!(result.status, ListeningPublishStatus::Published);
        assert!(result.message.contains("metadata not applied"));
        assert_eq!(fs::read(&source).expect("source read"), original);
        let target = PathBuf::from(result.destination_path.expect("target"));
        assert_eq!(fs::read(target).expect("target read"), original);
    }

    #[test]
    fn metadata_off_preserves_exact_copy_without_metadata_message() {
        let temp = tempdir().expect("tempdir");
        let destination_root = temp.path().join("listening");
        fs::create_dir_all(&destination_root).expect("destination");
        let source = temp.path().join("mix.wav");
        fs::write(&source, b"copy-only").expect("source");

        let result = publish_listening_copy(
            Some(&selection(source.clone())),
            &destination(&destination_root, ListeningMetadataPolicy::Off),
            None,
            true,
        );

        assert_eq!(result.status, ListeningPublishStatus::Published);
        assert_eq!(result.message, "Listening copy published");
        assert_eq!(fs::read(&source).expect("source read"), b"copy-only");
        let target = PathBuf::from(result.destination_path.expect("target"));
        assert_eq!(fs::read(target).expect("target read"), b"copy-only");
    }
}