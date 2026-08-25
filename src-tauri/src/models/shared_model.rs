//! Cross-domain serialized value objects shared by multiple model domains.

use serde::{Deserialize, Serialize, Serializer};

pub(crate) fn display_path(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    if let Some(rest) = path.strip_prefix(r"\\?\") {
        return rest.to_owned();
    }
    path.to_owned()
}

pub(crate) fn serialize_display_path<S>(path: &str, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&display_path(path))
}

pub(crate) fn serialize_optional_display_path<S>(
    path: &Option<String>,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match path {
        Some(path) => serializer.serialize_some(&display_path(path)),
        None => serializer.serialize_none(),
    }
}

pub(crate) fn serialize_display_paths<S>(
    paths: &[String],
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let paths = paths.iter().map(|path| display_path(path)).collect::<Vec<_>>();
    paths.serialize(serializer)
}

#[derive(Debug, Deserialize)]
pub struct Metadata {
    #[serde(rename = "schema")]
    pub _schema: String,
    pub schema_version: String,
    pub document_id: String,
    pub created_with: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct Audio {
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryMethod {
    pub method: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_path_removes_windows_verbatim_unc_prefix() {
        assert_eq!(
            display_path(r"\\?\UNC\NAS-LEV-02\media\Mixes"),
            r"\\NAS-LEV-02\media\Mixes"
        );
    }

    #[test]
    fn display_path_removes_windows_verbatim_drive_prefix() {
        assert_eq!(display_path(r"\\?\C:\Music\Mixes"), r"C:\Music\Mixes");
    }

    #[test]
    fn display_path_preserves_normal_paths() {
        assert_eq!(display_path(r"\\NAS\share\Mixes"), r"\\NAS\share\Mixes");
        assert_eq!(display_path("/Volumes/Mixes"), "/Volumes/Mixes");
    }
}
