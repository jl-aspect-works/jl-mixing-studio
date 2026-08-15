//! Intake domain contracts: validation request, report inventory, and operation result.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeRequest {
    pub client_id: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeInventoryItem {
    pub file: String,
    pub size_bytes: u64,
    pub technical_details: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeReport {
    pub client_id: String,
    pub project_id: String,
    pub source: String,
    pub files_discovered: usize,
    pub blocking_errors: usize,
    pub warnings: usize,
    pub expected_sample_rate: u32,
    pub expected_bit_depth: u16,
    pub enhanced_inspection_available: bool,
    pub critical_errors: Vec<String>,
    pub duplicate_filenames: Vec<String>,
    pub format_mismatches: Vec<String>,
    pub unsupported_files: Vec<String>,
    pub unavailable_checks: Vec<String>,
    pub inventory: Vec<IntakeInventoryItem>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeOperationResult {
    pub ok: bool,
    pub code: IntakeOperationCode,
    pub message: String,
    pub report: Option<IntakeReport>,
    /// Automation-authored structured Original Delivery validation records. Durable report-only
    /// reads leave this empty because Studio does not reverse-engineer Markdown into findings.
    pub files: Vec<serde_json::Value>,
    /// Automation-authored structured Working_Audio validation/provenance records. This remains
    /// empty for providers that predate the additive `data.audio_prep` response.
    pub audio_prep_files: Vec<serde_json::Value>,
    /// True only when Automation returned the additive `data.audio_prep` contract. An empty list
    /// with this flag set therefore means a valid empty Working_Audio area, not missing support.
    pub audio_prep_available: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IntakeOperationCode {
    NotRun,
    Ready,
    Validated,
    BlockingFindings,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    WorkspaceBlocked,
    ProjectUnavailable,
    ReportUnavailable,
    Rejected,
    Uncertain,
    Failed,
}
