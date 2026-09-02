use std::fs;
use std::path::{Path, PathBuf};

use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::{ItemKey, Tag};
use serde::Deserialize;

use crate::models::ListeningMetadataPolicy;

const DEFAULT_LISTENING_GENRE: &str = "JL Mixing";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ListeningMetadata {
    pub artist: String,
    pub album_artist: String,
    pub album: String,
    pub title: String,
    pub genre: String,
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MetadataClientDocument {
    client_name: String,
}

#[derive(Debug, Deserialize)]
struct MetadataProjectDocument {
    project_name: String,
}

pub(crate) fn apply_listening_metadata(
    published_copy: &Path,
    authoritative_source: &Path,
    policy: ListeningMetadataPolicy,
) -> Option<String> {
    if policy == ListeningMetadataPolicy::Off {
        return None;
    }

    let metadata = match metadata_for_source(authoritative_source) {
        Ok(metadata) => metadata,
        Err(message) => return Some(format!("metadata not applied: {message}")),
    };
    match write_metadata(published_copy, policy, &metadata) {
        Ok(unsupported) if unsupported.is_empty() => Some("metadata applied".into()),
        Ok(unsupported) => Some(format!(
            "metadata applied with unsupported fields: {}",
            unsupported.join(", ")
        )),
        Err(message) => Some(format!("metadata not applied: {message}")),
    }
}

fn metadata_for_source(source: &Path) -> Result<ListeningMetadata, String> {
    let project_root = find_project_root(source)
        .ok_or_else(|| "the source project metadata could not be located".to_owned())?;
    let project_path = project_root.join("00_Admin").join("project-manifest.json");
    let project: MetadataProjectDocument = read_json(&project_path, "project")?;

    let projects_root = project_root.parent().ok_or_else(|| {
        "the source project folder is outside the expected workspace layout".to_owned()
    })?;
    if projects_root.file_name().and_then(|value| value.to_str()) != Some("Projects") {
        return Err("the source project folder is outside the expected workspace layout".into());
    }
    let client_root = projects_root
        .parent()
        .ok_or_else(|| "the source client folder could not be resolved".to_owned())?;
    let client: MetadataClientDocument = read_json(&client_root.join("client.json"), "client")?;

    let revision = revision_for_source(&project_root, source);
    let title = revision
        .map(|revision| format!("{} - Rev {revision:02}", project.project_name))
        .unwrap_or_else(|| project.project_name.clone());
    let comment = source
        .strip_prefix(&project_root)
        .ok()
        .and_then(|relative| relative.components().next())
        .and_then(|component| component.as_os_str().to_str())
        .filter(|component| *component == "05_Final_Delivery")
        .map(|_| "Current Listening Copy".to_owned());

    Ok(ListeningMetadata {
        artist: client.client_name.clone(),
        album_artist: client.client_name,
        album: project.project_name,
        title,
        genre: DEFAULT_LISTENING_GENRE.into(),
        comment,
    })
}

pub(crate) fn listening_metadata_is_current(
    published_copy: &Path,
    authoritative_source: &Path,
    policy: ListeningMetadataPolicy,
) -> Result<bool, String> {
    if policy == ListeningMetadataPolicy::Off {
        return Ok(true);
    }
    let expected = metadata_for_source(authoritative_source)?;
    let tagged_file = match lofty::read_from_path(published_copy) {
        Ok(tagged_file) => tagged_file,
        Err(_) => return Ok(false),
    };
    let Some(tag) = tagged_file.primary_tag() else {
        return Ok(false);
    };
    Ok(metadata_matches(tag, policy, &expected))
}

fn metadata_matches(
    tag: &Tag,
    policy: ListeningMetadataPolicy,
    expected: &ListeningMetadata,
) -> bool {
    let fields = [
        (ItemKey::TrackArtist, expected.artist.as_str()),
        (ItemKey::AlbumArtist, expected.album_artist.as_str()),
        (ItemKey::AlbumTitle, expected.album.as_str()),
        (ItemKey::TrackTitle, expected.title.as_str()),
        (ItemKey::Genre, expected.genre.as_str()),
    ];
    fields.into_iter().all(|(key, value)| {
        let current = tag.get_string(key).map(str::trim).filter(|value| !value.is_empty());
        match policy {
            ListeningMetadataPolicy::Off => true,
            ListeningMetadataPolicy::FillMissing => current.is_some(),
            ListeningMetadataPolicy::Replace => current == Some(value.trim()),
        }
    }) && expected.comment.as_deref().is_none_or(|comment| {
        let current = tag
            .get_string(ItemKey::Comment)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        match policy {
            ListeningMetadataPolicy::Off => true,
            ListeningMetadataPolicy::FillMissing => current.is_some(),
            ListeningMetadataPolicy::Replace => current == Some(comment.trim()),
        }
    })
}

fn find_project_root(source: &Path) -> Option<PathBuf> {
    source
        .ancestors()
        .find(|candidate| {
            candidate
                .join("00_Admin")
                .join("project-manifest.json")
                .is_file()
        })
        .map(Path::to_path_buf)
}

fn revision_for_source(project_root: &Path, source: &Path) -> Option<u32> {
    let relative = source.strip_prefix(project_root).ok()?;
    let mut components = relative.components();
    let section = components.next()?.as_os_str().to_str()?;
    if section != "04_Revisions" {
        return None;
    }
    components
        .next()?
        .as_os_str()
        .to_str()?
        .strip_prefix("Revision_")?
        .parse()
        .ok()
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path, description: &str) -> Result<T, String> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("the {description} metadata could not be read: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("the {description} metadata is invalid: {error}"))
}

fn write_metadata(
    path: &Path,
    policy: ListeningMetadataPolicy,
    metadata: &ListeningMetadata,
) -> Result<Vec<&'static str>, String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("the published copy could not be parsed: {error}"))?;
    if tagged_file.primary_tag().is_none() {
        tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
    }
    let tag = tagged_file
        .primary_tag_mut()
        .ok_or_else(|| "the published format does not expose a writable primary tag".to_owned())?;

    let mut unsupported = Vec::new();
    apply_field(
        tag,
        ItemKey::TrackArtist,
        "Artist",
        &metadata.artist,
        policy,
        &mut unsupported,
    );
    apply_field(
        tag,
        ItemKey::AlbumArtist,
        "Album Artist",
        &metadata.album_artist,
        policy,
        &mut unsupported,
    );
    apply_field(
        tag,
        ItemKey::AlbumTitle,
        "Album",
        &metadata.album,
        policy,
        &mut unsupported,
    );
    apply_field(
        tag,
        ItemKey::TrackTitle,
        "Title",
        &metadata.title,
        policy,
        &mut unsupported,
    );
    apply_field(
        tag,
        ItemKey::Genre,
        "Genre",
        &metadata.genre,
        policy,
        &mut unsupported,
    );
    if let Some(comment) = metadata.comment.as_deref() {
        apply_field(
            tag,
            ItemKey::Comment,
            "Comment",
            comment,
            policy,
            &mut unsupported,
        );
    }

    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("the published copy metadata could not be saved: {error}"))?;
    Ok(unsupported)
}

fn apply_field(
    tag: &mut Tag,
    key: ItemKey,
    label: &'static str,
    value: &str,
    policy: ListeningMetadataPolicy,
    unsupported: &mut Vec<&'static str>,
) {
    let value = value.trim();
    if value.is_empty() {
        return;
    }
    let should_write = match policy {
        ListeningMetadataPolicy::Off => false,
        ListeningMetadataPolicy::FillMissing => tag
            .get_string(key)
            .is_none_or(|existing| existing.trim().is_empty()),
        ListeningMetadataPolicy::Replace => true,
    };
    if should_write && !tag.insert_text(key, value.to_owned()) {
        unsupported.push(label);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lofty::tag::TagType;
    use tempfile::tempdir;

    fn metadata() -> ListeningMetadata {
        ListeningMetadata {
            artist: "Client Name".into(),
            album_artist: "Client Name".into(),
            album: "Song Name".into(),
            title: "Song Name - Rev 05".into(),
            genre: "Mix Review".into(),
            comment: Some("Current Listening Copy".into()),
        }
    }

    #[test]
    fn replace_overwrites_managed_fields() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.insert_text(ItemKey::TrackArtist, "Existing Artist".into());
        tag.insert_text(ItemKey::AlbumTitle, "Existing Album".into());
        let mut unsupported = Vec::new();
        let values = metadata();
        apply_field(
            &mut tag,
            ItemKey::TrackArtist,
            "Artist",
            &values.artist,
            ListeningMetadataPolicy::Replace,
            &mut unsupported,
        );
        apply_field(
            &mut tag,
            ItemKey::AlbumTitle,
            "Album",
            &values.album,
            ListeningMetadataPolicy::Replace,
            &mut unsupported,
        );
        assert_eq!(tag.get_string(ItemKey::TrackArtist), Some("Client Name"));
        assert_eq!(tag.get_string(ItemKey::AlbumTitle), Some("Song Name"));
        assert!(unsupported.is_empty());
    }

    #[test]
    fn fill_missing_preserves_existing_fields_and_fills_empty_ones() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.insert_text(ItemKey::TrackArtist, "Existing Artist".into());
        let mut unsupported = Vec::new();
        let values = metadata();
        apply_field(
            &mut tag,
            ItemKey::TrackArtist,
            "Artist",
            &values.artist,
            ListeningMetadataPolicy::FillMissing,
            &mut unsupported,
        );
        apply_field(
            &mut tag,
            ItemKey::AlbumTitle,
            "Album",
            &values.album,
            ListeningMetadataPolicy::FillMissing,
            &mut unsupported,
        );
        assert_eq!(
            tag.get_string(ItemKey::TrackArtist),
            Some("Existing Artist")
        );
        assert_eq!(tag.get_string(ItemKey::AlbumTitle), Some("Song Name"));
        assert!(unsupported.is_empty());
    }

    #[test]
    fn source_context_maps_client_project_and_revision() {
        let temp = tempdir().expect("tempdir");
        let client = temp.path().join("Clients").join("client-a");
        let project = client.join("Projects").join("song-a");
        let revision = project.join("04_Revisions").join("Revision_05");
        fs::create_dir_all(project.join("00_Admin")).expect("admin");
        fs::create_dir_all(&revision).expect("revision");
        fs::write(
            client.join("client.json"),
            r#"{"client_name":"Client Name"}"#,
        )
        .expect("client");
        fs::write(
            project.join("00_Admin").join("project-manifest.json"),
            r#"{"project_name":"Song Name","state":{"delivered_revision":4}}"#,
        )
        .expect("project");
        let source = revision.join("Song Name - R05.mp3");
        fs::write(&source, b"source").expect("source");

        let values = metadata_for_source(&source).expect("metadata");
        assert_eq!(values.artist, "Client Name");
        assert_eq!(values.album_artist, "Client Name");
        assert_eq!(values.album, "Song Name");
        assert_eq!(values.title, "Song Name - Rev 05");
        assert_eq!(values.genre, DEFAULT_LISTENING_GENRE);
        assert_eq!(values.comment, None);
    }

    #[test]
    fn delivered_source_uses_project_title_and_current_copy_comment() {
        let temp = tempdir().expect("tempdir");
        let client = temp.path().join("Clients").join("client-a");
        let project = client.join("Projects").join("song-a");
        let delivery = project.join("05_Final_Delivery");
        fs::create_dir_all(project.join("00_Admin")).expect("admin");
        fs::create_dir_all(&delivery).expect("delivery");
        fs::write(
            client.join("client.json"),
            r#"{"client_name":"Client Name"}"#,
        )
        .expect("client");
        fs::write(
            project.join("00_Admin").join("project-manifest.json"),
            r#"{"project_name":"Song Name","state":{"delivered_revision":5}}"#,
        )
        .expect("project");
        let source = delivery.join("song-a.mp3");
        fs::write(&source, b"source").expect("source");

        let values = metadata_for_source(&source).expect("metadata");
        assert_eq!(values.title, "Song Name");
        assert_eq!(values.comment.as_deref(), Some("Current Listening Copy"));
    }

    #[test]
    fn delivered_replace_metadata_rejects_revision_title_as_stale() {
        let mut tag = Tag::new(TagType::Id3v2);
        let mut values = metadata();
        values.title = "Song Name".into();
        for (key, value) in [
            (ItemKey::TrackArtist, values.artist.as_str()),
            (ItemKey::AlbumArtist, values.album_artist.as_str()),
            (ItemKey::AlbumTitle, values.album.as_str()),
            (ItemKey::TrackTitle, "Song Name - Rev 05"),
            (ItemKey::Genre, values.genre.as_str()),
            (ItemKey::Comment, values.comment.as_deref().unwrap()),
        ] {
            tag.insert_text(key, value.to_owned());
        }

        assert!(!metadata_matches(
            &tag,
            ListeningMetadataPolicy::Replace,
            &values
        ));
        tag.insert_text(ItemKey::TrackTitle, values.title.clone());
        assert!(metadata_matches(
            &tag,
            ListeningMetadataPolicy::Replace,
            &values
        ));
    }
}
