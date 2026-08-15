use std::path::Path;

use crate::automation_api::{invoke_api, ApiCallError, ApiStatus, SystemProcessRunner};
use crate::models::{
    RevisionDescriptionUpdateRequest, RevisionDescriptionUpdateResult,
    RevisionDescriptionUpdateSummary,
};

pub fn update_revision_description(
    home: &Path,
    project_directory: &Path,
    request: RevisionDescriptionUpdateRequest,
) -> RevisionDescriptionUpdateResult {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let description = request.description.trim().to_owned();
    if !super::is_valid_client_id(&client_id)
        || !super::is_valid_client_id(&project_id)
        || request.revision == 0
        || description.is_empty()
        || description.chars().any(char::is_control)
    {
        return failed("Enter a valid non-empty revision description.");
    }

    let arguments = vec![
        "revision".into(),
        "update-description".into(),
        "--json".into(),
        "--project".into(),
        project_directory.to_string_lossy().into_owned(),
        "--revision".into(),
        request.revision.to_string(),
        "--description".into(),
        description.clone(),
    ];
    match invoke_api(
        home,
        "revision.update-description",
        &arguments,
        Some(project_directory),
        &SystemProcessRunner,
    ) {
        Ok(response) if response.status == ApiStatus::Success => {
            let Some(revision) = response.data.get("revision") else {
                return failed("Automation updated the description, but Studio could not verify the result.");
            };
            let number = revision.get("number").and_then(serde_json::Value::as_u64);
            let returned_description = revision
                .get("description")
                .and_then(serde_json::Value::as_str);
            let project = response
                .data
                .get("project")
                .and_then(|value| value.get("id"))
                .and_then(serde_json::Value::as_str);
            if number != Some(u64::from(request.revision))
                || returned_description != Some(description.as_str())
                || project != Some(project_id.as_str())
            {
                return failed("Automation updated the description, but Studio could not verify the returned revision identity.");
            }
            RevisionDescriptionUpdateResult {
                ok: true,
                message: format!("Revision {} description updated.", request.revision),
                revision: Some(RevisionDescriptionUpdateSummary {
                    client_id,
                    project_id,
                    revision: request.revision,
                    description,
                }),
            }
        }
        Ok(response) => failed(
            &response
                .errors
                .first()
                .map(|error| error.message.clone())
                .unwrap_or_else(|| "Automation rejected the revision description update.".into()),
        ),
        Err(ApiCallError::Unavailable) => failed(
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => failed(&format!(
            "JL Mixing Automation returned API {version}; Studio requires Automation API 1.0"
        )),
        Err(ApiCallError::Malformed | ApiCallError::UnexpectedOperation(_)) => failed(
            "Installed JL Mixing Automation does not provide the revision description update capability required by Studio.",
        ),
        Err(error) => failed(&error.message()),
    }
}

fn failed(message: &str) -> RevisionDescriptionUpdateResult {
    RevisionDescriptionUpdateResult {
        ok: false,
        message: message.to_owned(),
        revision: None,
    }
}
