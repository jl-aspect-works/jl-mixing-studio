use std::io;
use std::path::Path;

use crate::automation_api::{
    invoke_api, ApiCallError, ApiResponse, ApiStatus, ProcessResult, ProcessRunner,
    SystemProcessRunner,
};
use crate::models::{
    ProjectCreationRequest, ProjectCreationSummary, ProjectOperationCode, ProjectOperationResult,
};

pub fn preflight_project_creation(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(
        home,
        client_directory,
        request,
        ProjectOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_project(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(
        home,
        client_directory,
        request,
        ProjectOperation::Create,
        &SystemProcessRunner,
    )
}

pub fn blocked_project_operation(
    code: ProjectOperationCode,
    message: &str,
) -> ProjectOperationResult {
    ProjectOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        project: None,
    }
}

#[derive(Clone, Copy)]
pub(super) enum ProjectOperation {
    Preflight,
    Create,
}

struct ProjectApiProcessRunner<'a, R> {
    inner: &'a R,
}

impl<R: ProcessRunner> ProcessRunner for ProjectApiProcessRunner<'_, R> {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult> {
        self.inner
            .run(executable, arguments, current_directory)
            .map(normalize_project_api_process_result)
    }
}

fn normalize_project_api_process_result(mut result: ProcessResult) -> ProcessResult {
    if result.success || serde_json::from_str::<serde_json::Value>(result.stdout.trim()).is_ok() {
        return result;
    }

    let detail = result
        .stderr
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            format!(
                "JL Mixing Automation exited with code {} without returning an API response",
                result
                    .exit_code
                    .map_or_else(|| "unknown".into(), |code| code.to_string())
            )
        });

    result.stdout = serde_json::json!({
        "api_version": "1.0",
        "operation": "project.create",
        "status": "error",
        "data": {},
        "warnings": [],
        "errors": [{
            "code": "AUTOMATION_PROCESS_FAILED",
            "message": detail,
        }],
    })
    .to_string();
    result
}

pub(super) fn run_project_operation<R: ProcessRunner>(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
    operation: ProjectOperation,
    runner: &R,
) -> ProjectOperationResult {
    let request = match normalize_project_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_project_operation(ProjectOperationCode::InvalidInput, &message)
        }
    };

    let version = super::check_version_with_runner(home, runner);
    if !version.available {
        return blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_project_operation(
            ProjectOperationCode::UnsupportedVersion,
            &version.message,
        );
    }
    if !version.project_creation_supported {
        return blocked_project_operation(
            ProjectOperationCode::Rejected,
            "JL Mixing Automation does not advertise the project.create effective-artist capability required by Studio",
        );
    }

    let arguments = project_arguments(&request, client_directory, operation);
    let project_runner = ProjectApiProcessRunner { inner: runner };
    match invoke_api(home, "project.create", &arguments, None, &project_runner) {
        Ok(response)
            if matches!(
                (operation, response.status),
                (ProjectOperation::Preflight, ApiStatus::Planned)
                    | (ProjectOperation::Create, ApiStatus::Success)
            ) =>
        {
            let Some(project) = project_summary_from_api(&response.data, &request) else {
                return blocked_project_operation(
                    match operation {
                        ProjectOperation::Preflight => ProjectOperationCode::Failed,
                        ProjectOperation::Create => ProjectOperationCode::Uncertain,
                    },
                    match operation {
                        ProjectOperation::Preflight => {
                            "The JL Mixing Automation project preview could not be verified"
                        }
                        ProjectOperation::Create => {
                            "JL Mixing Automation reported success, but the created project identity could not be verified. The operation may have completed."
                        }
                    },
                );
            };
            ProjectOperationResult {
                ok: true,
                code: match operation {
                    ProjectOperation::Preflight => ProjectOperationCode::Ready,
                    ProjectOperation::Create => ProjectOperationCode::Created,
                },
                message: match operation {
                    ProjectOperation::Preflight => "Preflight passed. No changes were made.",
                    ProjectOperation::Create => "Project created successfully.",
                }
                .to_owned(),
                project: Some(project),
            }
        }
        Ok(response) => rejected_project_api_response(response),
        Err(ApiCallError::Unavailable) => blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => blocked_project_operation(
            ProjectOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        Err(error) => blocked_project_operation(
            match operation {
                ProjectOperation::Preflight => ProjectOperationCode::Failed,
                ProjectOperation::Create => ProjectOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn project_summary_from_api(
    data: &serde_json::Value,
    request: &ProjectCreationRequest,
) -> Option<ProjectCreationSummary> {
    let project = data.get("project")?;
    let project_id = project.get("id")?.as_str()?;
    let project_name = project.get("name")?.as_str()?;
    let artist = project.get("artist")?.as_str()?;
    let client_id = data.get("client")?.get("id")?.as_str()?;

    if !super::is_valid_client_id(project_id)
        || project_name != request.project_name
        || artist.trim().is_empty()
        || client_id != request.client_id
    {
        return None;
    }

    Some(ProjectCreationSummary {
        client_id: request.client_id.clone(),
        project_id: project_id.to_owned(),
        project_name: request.project_name.clone(),
        artist: artist.to_owned(),
    })
}

fn rejected_project_api_response(response: ApiResponse) -> ProjectOperationResult {
    let error = response.errors.first();
    let collision = error
        .map(|item| item.code == "PROJECT_ALREADY_EXISTS")
        .unwrap_or(false);
    let message = error.map(|item| item.message.clone()).unwrap_or_else(|| {
        format!(
            "JL Mixing Automation returned unexpected status {:?} for project.create",
            response.status
        )
    });
    ProjectOperationResult {
        ok: false,
        code: if collision {
            ProjectOperationCode::Collision
        } else {
            ProjectOperationCode::Rejected
        },
        message,
        project: None,
    }
}

fn normalize_project_request(
    request: ProjectCreationRequest,
) -> Result<ProjectCreationRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_name = request.project_name.trim().to_owned();
    let artist = request
        .artist
        .map(|artist| artist.trim().to_owned())
        .filter(|artist| !artist.is_empty());

    if client_id.is_empty() || !super::is_valid_client_id(&client_id) {
        return Err("Select a valid client before creating a project".into());
    }
    if project_name.is_empty() {
        return Err("Project name is required".into());
    }
    if project_name.chars().any(char::is_control) {
        return Err("Project name cannot contain control characters".into());
    }
    if artist
        .as_ref()
        .is_some_and(|value| value.chars().any(char::is_control))
    {
        return Err("Artist cannot contain control characters".into());
    }

    Ok(ProjectCreationRequest {
        client_id,
        project_name,
        artist,
    })
}

fn project_arguments(
    request: &ProjectCreationRequest,
    client_directory: &Path,
    operation: ProjectOperation,
) -> Vec<String> {
    let mut arguments = vec![
        "project".into(),
        "create".into(),
        request.project_name.clone(),
        "--client".into(),
        client_directory.to_string_lossy().into_owned(),
        "--json".into(),
    ];
    if let Some(artist) = &request.artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    if matches!(operation, ProjectOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> ProjectCreationRequest {
        ProjectCreationRequest {
            client_id: "acme".into(),
            project_name: "Blue Sky".into(),
            artist: None,
        }
    }

    #[test]
    fn project_create_explicitly_supplies_validated_client_path() {
        let arguments = project_arguments(
            &request(),
            Path::new(r"\\server\mixes\Clients\Acme"),
            ProjectOperation::Create,
        );

        assert_eq!(
            arguments,
            vec![
                "project",
                "create",
                "Blue Sky",
                "--client",
                r"\\server\mixes\Clients\Acme",
                "--json",
            ]
        );
    }

    #[test]
    fn project_preflight_keeps_explicit_client_and_dry_run() {
        let arguments = project_arguments(
            &request(),
            Path::new(r"C:\Mixes\Clients\Acme"),
            ProjectOperation::Preflight,
        );

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["--client", r"C:\Mixes\Clients\Acme"]));
        assert_eq!(arguments.last().map(String::as_str), Some("--dry-run"));
    }

    #[test]
    fn failed_process_stderr_becomes_structured_project_api_error() {
        let result = normalize_project_api_process_result(ProcessResult {
            success: false,
            exit_code: Some(1),
            stdout: String::new(),
            stderr: "Traceback line\nPermissionError: Access is denied\n".into(),
        });

        let response: serde_json::Value =
            serde_json::from_str(&result.stdout).expect("synthetic API response");
        assert_eq!(response["operation"], "project.create");
        assert_eq!(response["status"], "error");
        assert_eq!(
            response["errors"][0]["message"],
            "PermissionError: Access is denied"
        );
    }

    #[test]
    fn structured_nonzero_api_response_is_preserved() {
        let stdout = r#"{"api_version":"1.0","operation":"project.create","status":"error","data":{},"warnings":[],"errors":[{"code":"FILESYSTEM_ERROR","message":"Access is denied"}]}"#;
        let result = normalize_project_api_process_result(ProcessResult {
            success: false,
            exit_code: Some(1),
            stdout: stdout.into(),
            stderr: "ignored stderr".into(),
        });

        assert_eq!(result.stdout, stdout);
    }
}
