use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ListeningPublishClass {
    RevisionListening,
    DeliveredListening,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ListeningMetadataPolicy {
    Off,
    FillMissing,
    Replace,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ListeningArtworkPolicy {
    Off,
    PreserveExisting,
    ReplaceWithStudioArtwork,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListeningDestination {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub enabled: bool,
    pub publish_class: ListeningPublishClass,
    pub path: String,
    pub required_extension: String,
    pub metadata_policy: ListeningMetadataPolicy,
    pub artwork_policy: ListeningArtworkPolicy,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListeningConfiguration {
    pub version: u32,
    pub destinations: Vec<ListeningDestination>,
}

impl Default for ListeningConfiguration {
    fn default() -> Self {
        Self {
            version: 1,
            destinations: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ListeningPublishStatus {
    Published,
    Skipped,
    Failed,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPublishResult {
    pub destination_id: String,
    pub status: ListeningPublishStatus,
    pub message: String,
    pub selected_source: Option<String>,
    pub destination_path: Option<String>,
}
