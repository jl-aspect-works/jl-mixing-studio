use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::AppHandle;

use crate::automation_api::{
    invoke_api, resolve_command, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
    AUTOMATION_EXECUTABLE,
};
use crate::models::{
    ProjectEditInfo, ProjectUpdateCode, ProjectUpdateRequest, ProjectUpdateResult,
};
use crate::workspace::find_validated_project_path;
use crate::{resolve_home, resolve_workspace_root};

const UTF8_HEX_CAPABILITY: &str = "project.update.creativedirection.utf8hex";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ProjectUpdateSupport {
    update: bool,
    creative_direction_utf8_hex: bool,
}

fn manifest_file(project_path: &Path) -> PathBuf {
    project_path.join("00_Admin").join("project-manifest.json")
}

fn required_string(document: &Value, pointer: &str, message: &str) -> Result<String, String> {
    document
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| message.to_owned())
}

fn required_u64(document: &Value, pointer: &str, message: &str) -> Result<u64, String> {
    document
        .pointer(pointer)
        .and_then(Value::as_u64)
        .ok_or_else(|| message.to_owned())
}

fn read_edit_info(
    workspace: &Path,
    client_id: &str,
    project_id: &str,
) -> Result<ProjectEditInfo, String> {
    let project_path = find_validated_project_path(workspace, client_id, project_id)
        .ok_or_else(|| "The selected project is unavailable or ambiguous.".to_owned())?;
    let path = manifest_file(&project_path);
    if path.is_symlink() || !path.is_file() {
        return Err("Project configuration is unavailable or unsafe.".into());
    }
    let text = fs::read_to_string(&path)
        .map_err(|_| "Project configuration could not be read.".to_owned())?;
    let document: Value = serde_json::from_str(&text)
        .map_err(|_| "Project configuration is not valid JSON.".to_owned())?;

    let requested_deliverables = document
        .pointer("/delivery/requested_deliverables")
        .and_then(Value::as_array)
        .ok_or_else(|| "Project delivery requirements are incomplete.".to_owned())?
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| "Project delivery requirements are invalid.".to_owned())
        })
        .collect::<Result<Vec<_>, _>>()?;

    let manifest_client_id = required_string(
        &document,
        "/client/client_id",
        "Project client relationship is incomplete.",
    )?;
    if manifest_client_id != client_id {
        return Err("Project client relationship does not match the selected client.".into());
    }

    Ok(ProjectEditInfo {
        update_supported: false,
        client_id: manifest_client_id,
        project_id: required_string(&document, "/project_id", "Project identity is incomplete.")?,
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: required_string(
            &document,
            "/metadata/document_id",
            "Project conflict metadata is incomplete.",
        )?,
        schema_version: required_string(
            &document,
            "/metadata/schema_version",
            "Project schema metadata is incomplete.",
        )?,
        created_with: required_string(
            &document,
            "/metadata/created_with",
            "Project creation metadata is incomplete.",
        )?,
        created_at: required_string(
            &document,
            "/metadata/created_at",
            "Project creation metadata is incomplete.",
        )?,
        last_modified_at: required_string(
            &document,
            "/metadata/last_modified_at",
            "Project conflict metadata is incomplete.",
        )?,
        project_name: required_string(&document, "/project_name", "Project name is unavailable.")?,
        artist: required_string(&document, "/artist", "Project artist is unavailable.")?,
        album: required_string(
            &document,
            "/album",
            "Project album metadata is unavailable.",
        )?,
        producer: required_string(
            &document,
            "/producer",
            "Project producer metadata is unavailable.",
        )?,
        mix_engineer: required_string(
            &document,
            "/mix_engineer",
            "Project engineer metadata is unavailable.",
        )?,
        bpm: document.pointer("/music/bpm").and_then(Value::as_f64),
        musical_key: required_string(
            &document,
            "/music/key",
            "Project key metadata is unavailable.",
        )?,
        time_signature: required_string(
            &document,
            "/music/time_signature",
            "Project time-signature metadata is unavailable.",
        )?,
        sample_rate: u32::try_from(required_u64(
            &document,
            "/audio/sample_rate",
            "Project audio requirements are incomplete.",
        )?)
        .map_err(|_| "Project sample rate is invalid.".to_owned())?,
        bit_depth: u16::try_from(required_u64(
            &document,
            "/audio/bit_depth",
            "Project audio requirements are incomplete.",
        )?)
        .map_err(|_| "Project bit depth is invalid.".to_owned())?,
        file_format: required_string(
            &document,
            "/audio/file_format",
            "Project audio requirements are incomplete.",
        )?,
        delivery_method: required_string(
            &document,
            "/delivery/method",
            "Project delivery requirements are incomplete.",
        )?,
        requested_deliverables,
        deadline: document
            .pointer("/schedule/deadline")
            .and_then(Value::as_str)
            .map(str::to_owned),
        creative_direction: required_string(
            &document,
            "/creative_direction",
            "Project creative direction is unavailable.",
        )?,
        message: String::new(),
    })
}

fn project_update_support(document: &Value) -> ProjectUpdateSupport {
    let capabilities = document.get("capabilities").and_then(Value::as_array);
    ProjectUpdateSupport {
        update: capabilities.is_some_and(|items| {
            items
                .iter()
                .any(|item| item.as_str() == Some("project.update"))
        }),
        creative_direction_utf8_hex: capabilities.is_some_and(|items| {
            items
                .iter()
                .any(|item| item.as_str() == Some(UTF8_HEX_CAPABILITY))
        }),
    }
}

fn discovery_supports_update(home: &Path) -> Result<ProjectUpdateSupport, String> {
    let executable = resolve_command(home, AUTOMATION_EXECUTABLE)
        .ok_or_else(|| "JL Mixing Automation was not found.".to_owned())?;
    let arguments = vec!["system-info".to_owned(), "--json".to_owned()];
    let output = SystemProcessRunner
        .run(&executable, &arguments, None)
        .map_err(|_| "JL Mixing Automation discovery could not be started.".to_owned())?;
    if !output.success {
        return Err("JL Mixing Automation discovery failed.".into());
    }
    let document: Value = serde_json::from_str(output.stdout.trim())
        .map_err(|_| "JL Mixing Automation returned malformed discovery data.".to_owned())?;
    Ok(project_update_support(&document))
}

pub fn get_project_edit_info(
    app: &AppHandle,
    client_id: &str,
    project_id: &str,
) -> Result<ProjectEditInfo, String> {
    let home = resolve_home(app)?;
    let workspace = resolve_workspace_root(app)?;
    let mut info = read_edit_info(&workspace, client_id.trim(), project_id.trim())?;
    match discovery_supports_update(&home) {
        Ok(support) if support.update => {
            info.update_supported = true;
            info.message = "Project editing is available.".into();
        }
        Ok(_) => {
            info.message =
                "The installed JL Mixing Automation does not advertise project.update.".into()
        }
        Err(message) => info.message = message,
    }
    Ok(info)
}

fn blocked(code: ProjectUpdateCode, message: impl Into<String>) -> ProjectUpdateResult {
    ProjectUpdateResult {
        ok: false,
        code,
        message: message.into(),
    }
}

fn same_editable(left: &ProjectEditInfo, request: &ProjectUpdateRequest) -> bool {
    left.project_name == request.project_name.trim()
        && left.artist == request.artist.trim()
        && left.album == request.album.trim()
        && left.producer == request.producer.trim()
        && left.mix_engineer == request.mix_engineer.trim()
        && left.bpm == request.bpm
        && left.musical_key == request.musical_key.trim()
        && left.time_signature == request.time_signature.trim()
        && left.sample_rate == request.sample_rate
        && left.bit_depth == request.bit_depth
        && left.file_format == request.file_format.trim().to_ascii_uppercase()
        && left.delivery_method == request.delivery_method.trim()
        && left.requested_deliverables == request.requested_deliverables
        && left.deadline == request.deadline
        && left.creative_direction == request.creative_direction.trim()
}

fn utf8_hex(value: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(value.len() * 2);
    for byte in value.as_bytes() {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}

fn creative_direction_argument(
    value: &str,
    support: ProjectUpdateSupport,
) -> Result<(&'static str, String), ProjectUpdateResult> {
    if value.contains('\r') || value.contains('\n') {
        if !support.creative_direction_utf8_hex {
            return Err(blocked(
                ProjectUpdateCode::UnsupportedCapability,
                "The installed JL Mixing Automation does not support multiline Creative Direction. Update Automation, then save again.",
            ));
        }
        // The installed Windows Automation entry point is a cmd.exe launcher. Hex keeps embedded
        // line breaks and Unicode out of that command parser while preserving the exact UTF-8.
        return Ok(("--creative-direction-utf8-hex", utf8_hex(value)));
    }
    Ok(("--creative-direction", value.to_owned()))
}

pub fn update_project(app: &AppHandle, request: ProjectUpdateRequest) -> ProjectUpdateResult {
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return blocked(ProjectUpdateCode::Failed, message),
    };
    let workspace = match resolve_workspace_root(app) {
        Ok(value) => value,
        Err(message) => return blocked(ProjectUpdateCode::Failed, message),
    };
    let before = match read_edit_info(
        &workspace,
        request.client_id.trim(),
        request.project_id.trim(),
    ) {
        Ok(value) => value,
        Err(message) => return blocked(ProjectUpdateCode::ProjectUnavailable, message),
    };
    if before.last_modified_at != request.expected_last_modified_at {
        return blocked(
            ProjectUpdateCode::Conflict,
            "Project settings changed outside this edit session. Refresh and review the newer values before saving.",
        );
    }
    let support = match discovery_supports_update(&home) {
        Ok(support) if support.update => support,
        Ok(_) => {
            return blocked(
                ProjectUpdateCode::UnsupportedCapability,
                "The installed JL Mixing Automation does not support Project editing.",
            )
        }
        Err(message) => return blocked(ProjectUpdateCode::AutomationUnavailable, message),
    };
    if request.project_name.trim().is_empty() {
        return blocked(ProjectUpdateCode::InvalidInput, "Project name is required.");
    }
    if request.artist.trim().is_empty() {
        return blocked(ProjectUpdateCode::InvalidInput, "Artist is required.");
    }
    if request.delivery_method.trim().is_empty() {
        return blocked(
            ProjectUpdateCode::InvalidInput,
            "Delivery method is required.",
        );
    }
    if request.requested_deliverables.is_empty() {
        return blocked(
            ProjectUpdateCode::InvalidInput,
            "Select at least one requested deliverable.",
        );
    }
    if request.bpm.is_some_and(|value| value <= 0.0) {
        return blocked(
            ProjectUpdateCode::InvalidInput,
            "BPM must be positive or blank.",
        );
    }

    let creative_direction = request.creative_direction.trim();
    let (creative_direction_option, creative_direction_value) =
        match creative_direction_argument(creative_direction, support) {
            Ok(value) => value,
            Err(result) => return result,
        };

    let mut arguments = vec![
        "project".into(),
        "update".into(),
        "--json".into(),
        "--project".into(),
        before.project_path.clone(),
        "--name".into(),
        request.project_name.trim().into(),
        "--artist".into(),
        request.artist.trim().into(),
        "--album".into(),
        request.album.trim().into(),
        "--producer".into(),
        request.producer.trim().into(),
        "--engineer".into(),
        request.mix_engineer.trim().into(),
        "--bpm".into(),
        request
            .bpm
            .map(|value| value.to_string())
            .unwrap_or_else(|| "null".into()),
        "--key".into(),
        request.musical_key.trim().into(),
        "--time-signature".into(),
        request.time_signature.trim().into(),
        "--sample-rate".into(),
        request.sample_rate.to_string(),
        "--bit-depth".into(),
        request.bit_depth.to_string(),
        "--file-format".into(),
        request.file_format.trim().to_ascii_uppercase(),
        "--delivery-method".into(),
        request.delivery_method.trim().into(),
        "--deliverables".into(),
        request.requested_deliverables.join(","),
        "--deadline".into(),
        request.deadline.clone().unwrap_or_else(|| "null".into()),
        creative_direction_option.into(),
        creative_direction_value,
    ];
    arguments.shrink_to_fit();

    match invoke_api(
        &home,
        "project.update",
        &arguments,
        Some(&workspace),
        &SystemProcessRunner,
    ) {
        Ok(response) if response.status == ApiStatus::Success => {
            match read_edit_info(
                &workspace,
                request.client_id.trim(),
                request.project_id.trim(),
            ) {
                Ok(after)
                    if after.project_id == before.project_id
                        && after.project_path == before.project_path
                        && (after.last_modified_at != before.last_modified_at
                            || same_editable(&after, &request)) =>
                {
                    ProjectUpdateResult {
                        ok: true,
                        code: ProjectUpdateCode::Updated,
                        message: "Project settings were updated and verified. Derived validation and delivery state will refresh from authoritative data.".into(),
                    }
                }
                _ => blocked(
                    ProjectUpdateCode::Uncertain,
                    "Automation reported success, but Studio could not verify the updated authoritative project metadata. Refresh before retrying.",
                ),
            }
        }
        Ok(response) => {
            let message = response
                .errors
                .first()
                .map(|error| error.message.clone())
                .unwrap_or_else(|| "JL Mixing Automation rejected the Project update.".into());
            blocked(ProjectUpdateCode::Rejected, message)
        }
        Err(ApiCallError::Unavailable) => blocked(
            ProjectUpdateCode::AutomationUnavailable,
            "JL Mixing Automation was not found.",
        ),
        Err(error) => blocked(ProjectUpdateCode::Failed, error.message()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn support(encoded: bool) -> ProjectUpdateSupport {
        ProjectUpdateSupport {
            update: true,
            creative_direction_utf8_hex: encoded,
        }
    }

    #[test]
    fn multiline_creative_direction_uses_transport_safe_utf8_hex() {
        assert_eq!(
            creative_direction_argument("First line\nSecond line", support(true)).unwrap(),
            (
                "--creative-direction-utf8-hex",
                "4669727374206c696e650a5365636f6e64206c696e65".into(),
            )
        );
        assert_eq!(
            creative_direction_argument("Windows\r\nLine 🎚️", support(true)).unwrap(),
            (
                "--creative-direction-utf8-hex",
                utf8_hex("Windows\r\nLine 🎚️"),
            )
        );
    }

    #[test]
    fn existing_transport_remains_for_empty_and_single_line_values() {
        assert_eq!(
            creative_direction_argument("", support(false)).unwrap(),
            ("--creative-direction", String::new())
        );
        assert_eq!(
            creative_direction_argument("Single line", support(false)).unwrap(),
            ("--creative-direction", "Single line".into())
        );
    }

    #[test]
    fn multiline_value_explains_missing_automation_capability() {
        let result = creative_direction_argument("First\nSecond", support(false)).unwrap_err();
        assert!(!result.ok);
        assert_eq!(result.code, ProjectUpdateCode::UnsupportedCapability);
        assert!(result.message.contains("Update Automation"));
    }

    #[test]
    fn discovery_detects_multiline_transport_independently() {
        let document = serde_json::json!({
            "capabilities": ["project.update", UTF8_HEX_CAPABILITY]
        });
        assert_eq!(project_update_support(&document), support(true));
    }
}
