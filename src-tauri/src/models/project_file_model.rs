use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileListRequest {
    pub client_id: String,
    pub project_id: String,
    #[serde(default)]
    pub relative_path: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileMutationRequest {
    pub client_id: String,
    pub project_id: String,
    pub relative_path: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileRenameRequest {
    pub client_id: String,
    pub project_id: String,
    pub relative_path: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectFileArea {
    ProjectRoot,
    Admin,
    ClientOriginalDelivery,
    ClientReferences,
    ClientDocumentation,
    AudioPreparation,
    DawProject,
    Revisions,
    FinalDelivery,
    Recall,
    OtherManaged,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectFileEntryType {
    File,
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFilePermissions {
    pub can_open: bool,
    pub can_reveal: bool,
    pub can_rename: bool,
    pub can_delete: bool,
    pub can_copy: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileEntry {
    pub id: String,
    pub relative_path: String,
    pub display_name: String,
    pub extension: Option<String>,
    pub entry_type: ProjectFileEntryType,
    pub area: ProjectFileArea,
    pub size_bytes: Option<u64>,
    pub modified_epoch_ms: Option<u64>,
    pub is_audio: bool,
    pub playable: bool,
    pub permissions: ProjectFilePermissions,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileListing {
    pub relative_path: String,
    pub area: ProjectFileArea,
    pub permissions: ProjectFilePermissions,
    pub entries: Vec<ProjectFileEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileMutationResult {
    pub relative_path: String,
}
