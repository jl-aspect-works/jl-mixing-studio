use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::AppHandle;

use crate::automation_api::{
    invoke_api, resolve_command, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
    AUTOMATION_EXECUTABLE,
};
use crate::models::{ClientEditInfo, ClientUpdateCode, ClientUpdateRequest, ClientUpdateResult};
use crate::workspace::find_validated_client_path;
use crate::{resolve_home, resolve_workspace_root};

fn client_file(client_path: &Path) -> PathBuf {
    client_path.join("client.json")
}

fn required_string(document: &Value, pointer: &str, message: &str) -> Result<String, String> {
    document
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| message.to_owned())
}

fn required_u64(document: &Value, pointer: &str, message: &str) -> Result<u64, String> {
    document
        .pointer(pointer)
        .and_then(Value::as_u64)
        .ok_or_else(|| message.to_owned())
}

fn read_edit_info(workspace: &Path, client_id: &str) -> Result<ClientEditInfo, String> {
    let client_path = find_validated_client_path(workspace, client_id)
        .ok_or_else(|| "The selected client is unavailable or ambiguous.".to_owned())?;
    let path = client_file(&client_path);
    if path.is_symlink() || !path.is_file() {
        return Err("Client configuration is unavailable or unsafe.".into());
    }
    let text = fs::read_to_string(&path)
        .map_err(|_| "Client configuration could not be read.".to_owned())?;
    let document: Value = serde_json::from_str(&text)
        .map_err(|_| "Client configuration is not valid JSON.".to_owned())?;

    let requested_deliverables = document
        .pointer("/defaults/delivery/requested_deliverables")
        .and_then(Value::as_array)
        .ok_or_else(|| "Client delivery defaults are incomplete.".to_owned())?
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| "Client delivery defaults are invalid.".to_owned())
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ClientEditInfo {
        update_supported: false,
        client_id: required_string(&document, "/client_id", "Client identity is incomplete.")?,
        client_path: client_path.to_string_lossy().into_owned(),
        document_id: required_string(
            &document,
            "/metadata/document_id",
            "Client conflict metadata is incomplete.",
        )?,
        schema_version: required_string(
            &document,
            "/metadata/schema_version",
            "Client schema metadata is incomplete.",
        )?,
        created_with: required_string(
            &document,
            "/metadata/created_with",
            "Client creation metadata is incomplete.",
        )?,
        created_at: required_string(
            &document,
            "/metadata/created_at",
            "Client creation metadata is incomplete.",
        )?,
        last_modified_at: required_string(
            &document,
            "/metadata/last_modified_at",
            "Client conflict metadata is incomplete.",
        )?,
        client_name: required_string(&document, "/client_name", "Client name is unavailable.")?,
        artist: document
            .pointer("/defaults/artist")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        sample_rate: u32::try_from(required_u64(
            &document,
            "/defaults/audio/sample_rate",
            "Client audio defaults are incomplete.",
        )?)
        .map_err(|_| "Client sample rate is invalid.".to_owned())?,
        bit_depth: u16::try_from(required_u64(
            &document,
            "/defaults/audio/bit_depth",
            "Client audio defaults are incomplete.",
        )?)
        .map_err(|_| "Client bit depth is invalid.".to_owned())?,
        file_format: required_string(
            &document,
            "/defaults/audio/file_format",
            "Client audio defaults are incomplete.",
        )?,
        delivery_method: required_string(
            &document,
            "/defaults/delivery/method",
            "Client delivery defaults are incomplete.",
        )?,
        requested_deliverables,
        message: String::new(),
    })
}

fn discovery_supports_update(home: &Path) -> Result<bool, String> {
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
    Ok(document
        .get("capabilities")
        .and_then(Value::as_array)
        .is_some_and(|items| {
            items
                .iter()
                .any(|item| item.as_str() == Some("client.update"))
        }))
}

pub fn get_client_edit_info(app: &AppHandle, client_id: &str) -> Result<ClientEditInfo, String> {
    let home = resolve_home(app)?;
    let workspace = resolve_workspace_root(app)?;
    let mut info = read_edit_info(&workspace, client_id.trim())?;
    match discovery_supports_update(&home) {
        Ok(true) => {
            info.update_supported = true;
            info.message = "Client editing is available.".into();
        }
        Ok(false) => {
            info.message =
                "The installed JL Mixing Automation does not advertise client.update.".into();
        }
        Err(message) => info.message = message,
    }
    Ok(info)
}

fn blocked(code: ClientUpdateCode, message: impl Into<String>) -> ClientUpdateResult {
    ClientUpdateResult {
        ok: false,
        code,
        message: message.into(),
    }
}

pub fn update_client(app: &AppHandle, request: ClientUpdateRequest) -> ClientUpdateResult {
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return blocked(ClientUpdateCode::Failed, message),
    };
    let workspace = match resolve_workspace_root(app) {
        Ok(value) => value,
        Err(message) => return blocked(ClientUpdateCode::Failed, message),
    };
    let before = match read_edit_info(&workspace, request.client_id.trim()) {
        Ok(value) => value,
        Err(message) => return blocked(ClientUpdateCode::ClientUnavailable, message),
    };
    if before.last_modified_at != request.expected_last_modified_at {
        return blocked(
            ClientUpdateCode::Conflict,
            "Client settings changed outside this edit session. Refresh and review the newer values before saving.",
        );
    }
    match discovery_supports_update(&home) {
        Ok(true) => {}
        Ok(false) => {
            return blocked(
                ClientUpdateCode::UnsupportedCapability,
                "The installed JL Mixing Automation does not support Client editing.",
            );
        }
        Err(message) => return blocked(ClientUpdateCode::AutomationUnavailable, message),
    }

    if request.client_name.trim().is_empty() {
        return blocked(ClientUpdateCode::InvalidInput, "Client name is required.");
    }
    if request.delivery_method.trim().is_empty() {
        return blocked(
            ClientUpdateCode::InvalidInput,
            "Delivery method is required.",
        );
    }
    if request.requested_deliverables.is_empty() {
        return blocked(
            ClientUpdateCode::InvalidInput,
            "Select at least one requested deliverable.",
        );
    }

    let arguments = vec![
        "client".into(),
        "update".into(),
        "--json".into(),
        "--client".into(),
        before.client_path.clone(),
        "--name".into(),
        request.client_name.trim().into(),
        "--artist".into(),
        request.artist.trim().into(),
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
    ];

    match invoke_api(
        &home,
        "client.update",
        &arguments,
        Some(&workspace),
        &SystemProcessRunner,
    ) {
        Ok(response) if response.status == ApiStatus::Success => {
            match read_edit_info(&workspace, request.client_id.trim()) {
                Ok(after)
                    if after.client_id == before.client_id
                        && after.client_path == before.client_path
                        && (after.last_modified_at != before.last_modified_at
                            || (after.client_name == request.client_name.trim()
                                && after.artist == request.artist.trim()
                                && after.sample_rate == request.sample_rate
                                && after.bit_depth == request.bit_depth
                                && after.file_format
                                    == request.file_format.trim().to_ascii_uppercase()
                                && after.delivery_method == request.delivery_method.trim()
                                && after.requested_deliverables == request.requested_deliverables)) =>
                {
                    ClientUpdateResult {
                        ok: true,
                        code: ClientUpdateCode::Updated,
                        message: "Client settings were updated and verified.".into(),
                    }
                }
                _ => blocked(
                    ClientUpdateCode::Uncertain,
                    "Automation reported success, but Studio could not verify the updated authoritative client metadata. Refresh before retrying.",
                ),
            }
        }
        Ok(response) => {
            let message = response
                .errors
                .first()
                .map(|error| error.message.clone())
                .unwrap_or_else(|| "JL Mixing Automation rejected the Client update.".into());
            blocked(ClientUpdateCode::Rejected, message)
        }
        Err(ApiCallError::Unavailable) => blocked(
            ClientUpdateCode::AutomationUnavailable,
            "JL Mixing Automation was not found.",
        ),
        Err(error) => blocked(ClientUpdateCode::Failed, error.message()),
    }
}
