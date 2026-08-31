use std::fs;
use std::path::{Path, PathBuf};

use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::tag::Tag;

use crate::models::ListeningArtworkPolicy;

const STUDIO_ARTWORK_FILE_NAME: &str = "cover.png";
pub(crate) const STUDIO_ARTWORK_BYTES: &[u8] =
    include_bytes!("../../../vendor/jl-brand/listening-cover-dark-1200.png");

pub(crate) fn apply_listening_artwork(
    published_copy: &Path,
    policy: ListeningArtworkPolicy,
) -> Option<String> {
    match policy {
        ListeningArtworkPolicy::Off => None,
        ListeningArtworkPolicy::PreserveExisting => Some("existing artwork preserved".to_owned()),
        ListeningArtworkPolicy::ReplaceWithStudioArtwork => {
            Some(replace_with_studio_artwork(published_copy))
        }
    }
}

fn replace_with_studio_artwork(published_copy: &Path) -> String {
    if is_wav(published_copy) {
        return match write_companion_artwork(published_copy) {
            Ok(path) => format!(
                "Studio artwork written as {} for WAV compatibility",
                path.file_name()
                    .map(|name| name.to_string_lossy())
                    .unwrap_or_default()
            ),
            Err(message) => format!("artwork not applied: {message}"),
        };
    }

    match write_embedded_artwork(published_copy) {
        Ok(()) => "Studio artwork applied".to_owned(),
        Err(embed_error) => match write_companion_artwork(published_copy) {
            Ok(path) => format!(
                "embedded artwork not applied: {embed_error}; Studio artwork written as {}",
                path.file_name()
                    .map(|name| name.to_string_lossy())
                    .unwrap_or_default()
            ),
            Err(companion_error) => format!(
                "artwork not applied: {embed_error}; companion artwork failed: {companion_error}"
            ),
        },
    }
}

fn write_embedded_artwork(path: &Path) -> Result<(), String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("the published copy could not be parsed: {error}"))?;
    if tagged_file.primary_tag().is_none() {
        tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
    }
    let tag = tagged_file
        .primary_tag_mut()
        .ok_or_else(|| "the published format does not expose a writable primary tag".to_owned())?;
    replace_tag_artwork(tag);
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("the published copy artwork could not be saved: {error}"))
}

fn replace_tag_artwork(tag: &mut Tag) {
    tag.remove_pictures();
    tag.push_picture(studio_picture());
}

fn studio_picture() -> Picture {
    Picture::unchecked(STUDIO_ARTWORK_BYTES.to_vec())
        .pic_type(PictureType::CoverFront)
        .mime_type(MimeType::Png)
        .description("JL Mixing Studio Listening")
        .build()
}

fn write_companion_artwork(published_copy: &Path) -> Result<PathBuf, String> {
    let parent = published_copy
        .parent()
        .ok_or_else(|| "the published copy has no destination folder".to_owned())?;
    let cover_path = parent.join(STUDIO_ARTWORK_FILE_NAME);
    fs::write(&cover_path, STUDIO_ARTWORK_BYTES)
        .map_err(|error| format!("the Studio companion artwork could not be written: {error}"))?;
    Ok(cover_path)
}

fn is_wav(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use lofty::tag::TagType;

    fn existing_picture(data: &[u8]) -> Picture {
        Picture::unchecked(data.to_vec())
            .pic_type(PictureType::CoverFront)
            .mime_type(MimeType::Jpeg)
            .build()
    }

    #[test]
    fn studio_artwork_is_the_approved_png() {
        assert!(STUDIO_ARTWORK_BYTES.starts_with(b"\x89PNG\r\n\x1a\n"));
        assert!(STUDIO_ARTWORK_BYTES.len() > 100_000);
    }

    #[test]
    fn replace_removes_existing_pictures_and_installs_studio_cover() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.push_picture(existing_picture(b"existing-image"));

        replace_tag_artwork(&mut tag);

        assert_eq!(tag.pictures().len(), 1);
        let picture = &tag.pictures()[0];
        assert_eq!(picture.pic_type(), PictureType::CoverFront);
        assert_eq!(picture.mime_type(), Some(&MimeType::Png));
        assert_eq!(picture.data(), STUDIO_ARTWORK_BYTES);
    }

    #[test]
    fn preserve_existing_policy_does_not_change_tag_artwork() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.push_picture(existing_picture(b"existing-image"));
        let before = tag.pictures()[0].data().to_vec();

        let message = apply_tag_policy(&mut tag, ListeningArtworkPolicy::PreserveExisting);

        assert_eq!(message.as_deref(), Some("existing artwork preserved"));
        assert_eq!(tag.pictures().len(), 1);
        assert_eq!(tag.pictures()[0].data(), before);
    }

    #[test]
    fn off_policy_does_not_change_tag_artwork() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.push_picture(existing_picture(b"existing-image"));
        let before = tag.pictures()[0].data().to_vec();

        let message = apply_tag_policy(&mut tag, ListeningArtworkPolicy::Off);

        assert_eq!(message, None);
        assert_eq!(tag.pictures().len(), 1);
        assert_eq!(tag.pictures()[0].data(), before);
    }

    fn apply_tag_policy(tag: &mut Tag, policy: ListeningArtworkPolicy) -> Option<String> {
        match policy {
            ListeningArtworkPolicy::Off => None,
            ListeningArtworkPolicy::PreserveExisting => {
                Some("existing artwork preserved".to_owned())
            }
            ListeningArtworkPolicy::ReplaceWithStudioArtwork => {
                replace_tag_artwork(tag);
                Some("Studio artwork applied".to_owned())
            }
        }
    }
}
