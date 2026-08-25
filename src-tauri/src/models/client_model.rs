//! Client domain contracts: persisted metadata, workspace projection, and creation/update workflows.

use serde::{Deserialize, Serialize};

use super::project_model::ProjectSummary;
use super::shared_model::{serialize_display_path, Metadata};

#[derive(Debug, Deserialize)]
pub struct ClientDocument {
    #[serde(rename = "metadata")]
    pub _metadata: Metadata,
    pub client_id: String,
    pub client_name: String,
    pub defaults: ClientDefaults,
}

#[derive(Debug, Deserialize)]
pub struct ClientDefaults {
    pub artist: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientSummary {
    pub client_id: String,
    pub client_name: String,
    pub created_at: String,
    pub default_artist: String,
    pub projects: Vec<ProjectSummary>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientCreationRequest {
    pub client_id: String,
    pub client_name: String,
    pub default_artist: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientCreationSummary {
    pub client_id: String,
    pub client_name: String,
    pub default_artist: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientOperationResult {
    pub ok: bool,
    pub code: ClientOperationCode,
    pub message: String,
    pub client: Option<ClientCreationSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ClientOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    WorkspaceBlocked,
    Collision,
    Rejected,
    Failed,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateRequest {
    pub client_id: String,
    pub expected_last_modified_at: String,
    pub client_name: String,
    pub artist: String,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
    pub delivery_method: String,
    pub requested_deliverables: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateResult {
    pub ok: bool,
    pub code: ClientUpdateCode,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ClientUpdateCode {
    Updated,
    Conflict,
    InvalidInput,
    ClientUnavailable,
    AutomationUnavailable,
    UnsupportedCapability,
    Rejected,
    Uncertain,
    Failed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientEditInfo {
    pub update_supported: bool,
    pub client_id: String,
    #[serde(serialize_with = "serialize_display_path")]
    pub client_path: String,
    pub document_id: String,
    pub schema_version: String,
    pub created_with: String,
    pub created_at: String,
    pub last_modified_at: String,
    pub client_name: String,
    pub artist: String,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
    pub delivery_method: String,
    pub requested_deliverables: Vec<String>,
    pub message: String,
}
