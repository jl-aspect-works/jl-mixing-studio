//! Delivery domain contracts: persisted package metadata, workspace projection, and creation workflow.

use serde::{Deserialize, Serialize};

use super::shared_model::{serialize_display_path, serialize_optional_display_path, DeliveryMethod};

#[derive(Debug, Deserialize)]
pub struct DeliveryManifest {
    pub metadata: DeliveryMetadata,
    pub project: DeliveryProject,
    pub client: DeliveryClient,
    pub revision: DeliveryRevision,
    pub delivery: DeliveryMethod,
    pub files: Vec<DeliveryFile>,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryMetadata {
    pub document_id: String,
    pub created_with: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryProject {
    pub project_document_id: String,
    pub project_id: String,
    // Historical snapshot field validated by the delivery schema; current project names may change.
    #[allow(dead_code)]
    pub project_name: String,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryClient {
    pub client_document_id: String,
    pub client_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryRevision {
    pub number: u32,
    pub revision_id: String,
    pub description: String,
    pub approval: DeliveredApproval,
}

#[derive(Debug, Deserialize)]
pub struct DeliveredApproval {
    pub approved_at: String,
    pub approved_by: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct DeliveryFile {
    pub path: String,
    pub deliverable_type: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliverySummary {
    pub document_id: String,
    pub created_with: String,
    pub created_at: String,
    pub method: String,
    pub revision: u32,
    pub revision_id: String,
    pub description: String,
    pub approved_at: String,
    pub approved_by: String,
    pub files: Vec<DeliveryFile>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCreationRequest {
    pub client_id: String,
    pub project_id: String,
    pub replacement_mode: DeliveryReplacementMode,
    pub create_zip: bool,
    pub confirmed_deletions: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryReplacementMode {
    Default,
    Overwrite,
    Clean,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlannedDeliveryFile {
    pub source_name: String,
    pub deliverable_type: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExcludedDeliveryFile {
    pub name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCreationPreview {
    pub client_id: String,
    pub project_id: String,
    pub project_name: String,
    pub current_revision: u32,
    pub approved_revision: u32,
    pub delivered_revision: Option<u32>,
    pub delivery_method: String,
    pub replacement_mode: DeliveryReplacementMode,
    pub create_zip: bool,
    pub zip_name: Option<String>,
    pub selected: Vec<PlannedDeliveryFile>,
    pub excluded: Vec<ExcludedDeliveryFile>,
    pub deletions: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryOperationResult {
    pub ok: bool,
    pub code: DeliveryOperationCode,
    pub message: String,
    pub delivery: Option<DeliveryCreationPreview>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    WorkspaceBlocked,
    ProjectUnavailable,
    ApprovalRequired,
    AlreadyDelivered,
    Rejected,
    Uncertain,
    Failed,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryStatusRequest {
    pub client_id: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryPackageDeleteRequest {
    pub client_id: String,
    pub project_id: String,
    pub zip_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ManagedDeliveryIssue {
    pub code: String,
    pub message: String,
    #[serde(serialize_with = "serialize_optional_display_path")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ManagedDeliveryRevisions {
    pub current: u32,
    pub approved: Option<u32>,
    pub delivered: Option<u32>,
    pub source: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ManagedDeliverableStatus {
    #[serde(serialize_with = "serialize_display_path")]
    pub path: String,
    pub deliverable_type: Option<String>,
    pub size_bytes: Option<u64>,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ManagedDeliveryNotesStatus {
    #[serde(serialize_with = "serialize_display_path")]
    pub path: String,
    pub present: bool,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ManagedDeliveryPackageStatus {
    pub name: String,
    #[serde(serialize_with = "serialize_display_path")]
    pub path: String,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
    pub status: String,
    pub issues: Vec<ManagedDeliveryIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ManagedDeliveryStatus {
    #[serde(serialize_with = "serialize_display_path")]
    pub delivery_path: String,
    #[serde(serialize_with = "serialize_display_path")]
    pub delivery_manifest_path: String,
    pub state: String,
    pub revisions: ManagedDeliveryRevisions,
    pub deliverables: Vec<ManagedDeliverableStatus>,
    pub deliverable_count: usize,
    pub untracked: Vec<String>,
    pub issues: Vec<ManagedDeliveryIssue>,
    pub notes: ManagedDeliveryNotesStatus,
    pub packages: Vec<ManagedDeliveryPackageStatus>,
    pub package_state: String,
    pub current_package: Option<ManagedDeliveryPackageStatus>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryStatusResult {
    pub ok: bool,
    pub message: String,
    pub delivery: Option<ManagedDeliveryStatus>,
}
