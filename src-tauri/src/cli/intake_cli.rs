use std::path::Path;

#[path = "../intake_progress.rs"]
mod intake_progress;

use crate::automation_api::{
    invoke_api, resolve_command, ApiCallError, ApiError, ApiStatus, ProcessRunner,
    SystemProcessRunner, AUTOMATION_EXECUTABLE,
};
use crate::intake as intake_report;
use crate::intake::IntakeReportError;
use crate::models::{IntakeOperationCode, IntakeOperationResult, IntakeRequest};
pub(crate) use intake_progress::IntakeProgressEvent;
use intake_progress::invoke_intake_with_progress;

const INCREMENTAL_INTAKE_CAPABILITY: &str = "intake.validate.incremental";
const STRUCTURED_INTAKE_CAPABILITY: &str = "intake.validate.structured";
const PROGRESS_INTAKE_CAPABILITY: &str = "intake.validate.progress";

pub fn read_intake_report(
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    match normalize_intake_request(request) {
        Ok(request) => report_result(
            intake_report::read_report(project_directory, &request),
            false,
        ),
        Err(message) => blocked_intake_operation(IntakeOperationCode::InvalidInput, &message),
    }
}

pub fn preflight_intake_validation(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(
        home,
        project_directory,
        request,
        IntakeOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn run_intake_validation(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(
        home,
        project_directory,
        request,
        IntakeOperation::Run,
        &SystemProcessRunner,
    )
}

pub fn run_intake_validation_with_progress<F>(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
    on_progress: F,
) -> IntakeOperationResult
where
    F: FnMut(IntakeProgressEvent) + Send + 'static,
{
    let runner = SystemProcessRunner;
    if supports_intake_progress(home, &runner) {
        run_intake_operation_streaming(home, project_directory, request, on_progress)
    } else {
        run_intake_operation(
            home,
            project_directory,
            request,
            IntakeOperation::Run,
            &runner,
        )
    }
}

/// Refresh Client Files using Automation's cached structured validation contract. The same
/// Automation response may also carry the additive Audio Prep status/provenance section; keeping
/// one request avoids duplicate validation scans when Studio needs both working surfaces.
pub fn refresh_client_files_validation(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    let runner = SystemProcessRunner;
    if !supports_client_files_validation(home, &runner) {
        return blocked_intake_operation(
            IntakeOperationCode::Rejected,
            "JL Mixing Automation does not advertise the incremental structured intake capabilities required by Client Files",
        );
    }
    verify_structured_refresh(run_intake_operation(
        home,
        project_directory,
        request,
        IntakeOperation::Run,
        &runner,
    ))
}

pub fn refresh_client_files_validation_with_progress<F>(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
    on_progress: F,
) -> IntakeOperationResult
where
    F: FnMut(IntakeProgressEvent) + Send + 'static,
{
    let runner = SystemProcessRunner;
    if !supports_client_files_validation(home, &runner) {
        return blocked_intake_operation(
            IntakeOperationCode::Rejected,
            "JL Mixing Automation does not advertise the incremental structured intake capabilities required by Client Files",
        );
    }
    let result = if supports_intake_progress(home, &runner) {
        run_intake_operation_streaming(home, project_directory, request, on_progress)
    } else {
        run_intake_operation(
            home,
            project_directory,
            request,
            IntakeOperation::Run,
            &runner,
        )
    };
    verify_structured_refresh(result)
}

fn verify_structured_refresh(result: IntakeOperationResult) -> IntakeOperationResult {
    if result.ok
        && result.files.is_empty()
        && result
            .report
            .as_ref()
            .is_some_and(|report| report.files_discovered > 0)
    {
        return blocked_intake_operation(
            IntakeOperationCode::Uncertain,
            "Automation advertised structured intake validation but did not return verifiable per-file records. The intake report may have been updated; do not retry automatically.",
        );
    }
    result
}

fn advertised_capabilities<R: ProcessRunner>(home: &Path, runner: &R) -> Option<Vec<String>> {
    let executable = resolve_command(home, AUTOMATION_EXECUTABLE)?;
    let arguments = vec!["system-info".to_owned(), "--json".to_owned()];
    let output = runner.run(&executable, &arguments, None).ok()?;
    if !output.success {
        return None;
    }
    let document = serde_json::from_str::<serde_json::Value>(output.stdout.trim()).ok()?;
    if document.get("api_version").and_then(|value| value.as_str()) != Some("1.0") {
        return None;
    }
    document
        .get("capabilities")?
        .as_array()?
        .iter()
        .filter_map(|value| value.as_str().map(str::to_owned))
        .collect::<Vec<_>>()
        .into()
}

fn supports_client_files_validation<R: ProcessRunner>(home: &Path, runner: &R) -> bool {
    let Some(capabilities) = advertised_capabilities(home, runner) else {
        return false;
    };
    let has = |capability: &str| capabilities.iter().any(|value| value == capability);
    has(INCREMENTAL_INTAKE_CAPABILITY) && has(STRUCTURED_INTAKE_CAPABILITY)
}

fn supports_intake_progress<R: ProcessRunner>(home: &Path, runner: &R) -> bool {
    advertised_capabilities(home, runner)
        .is_some_and(|capabilities| capabilities.iter().any(|value| value == PROGRESS_INTAKE_CAPABILITY))
}

pub fn blocked_intake_operation(code: IntakeOperationCode, message: &str) -> IntakeOperationResult {
    IntakeOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        report: None,
        files: Vec::new(),
        audio_prep_files: Vec::new(),
        audio_prep_available: false,
    }
}

#[derive(Clone, Copy)]
pub(super) enum IntakeOperation {
    Preflight,
    Run,
}

pub(super) fn run_intake_operation<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
    operation: IntakeOperation,
    runner: &R,
) -> IntakeOperationResult {
    let request = match validate_operation_request(home, request, runner) {
        Ok(request) => request,
        Err(result) => return result,
    };

    let arguments = intake_arguments(project_directory, operation, false);
    match invoke_api(
        home,
        "intake.validate",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response) => finish_intake_response(
            operation,
            response.status,
            response.data,
            response.errors,
            &request,
        ),
        Err(error) => intake_api_error(operation, error),
    }
}

fn run_intake_operation_streaming<F>(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
    on_progress: F,
) -> IntakeOperationResult
where
    F: FnMut(IntakeProgressEvent) + Send + 'static,
{
    let runner = SystemProcessRunner;
    let request = match validate_operation_request(home, request, &runner) {
        Ok(request) => request,
        Err(result) => return result,
    };
    let arguments = intake_arguments(project_directory, IntakeOperation::Run, true);
    match invoke_intake_with_progress(home, &arguments, on_progress) {
        Ok(response) => finish_intake_response(
            IntakeOperation::Run,
            response.status,
            response.data,
            response.errors,
            &request,
        ),
        Err(error) => intake_api_error(IntakeOperation::Run, error),
    }
}

fn validate_operation_request<R: ProcessRunner>(
    home: &Path,
    request: IntakeRequest,
    runner: &R,
) -> Result<IntakeRequest, IntakeOperationResult> {
    let request = normalize_intake_request(request)
        .map_err(|message| blocked_intake_operation(IntakeOperationCode::InvalidInput, &message))?;

    let version = super::check_version_with_runner(home, runner);
    if !version.available {
        return Err(blocked_intake_operation(
            IntakeOperationCode::AutomationUnavailable,
            &version.message,
        ));
    }
    if !version.supported {
        return Err(blocked_intake_operation(
            IntakeOperationCode::UnsupportedVersion,
            &version.message,
        ));
    }
    if !version.intake_validation_supported {
        return Err(blocked_intake_operation(
            IntakeOperationCode::Rejected,
            "JL Mixing Automation does not advertise the intake.validate report capability required by Studio",
        ));
    }
    Ok(request)
}

fn finish_intake_response(
    operation: IntakeOperation,
    status: ApiStatus,
    data: serde_json::Value,
    errors: Vec<ApiError>,
    request: &IntakeRequest,
) -> IntakeOperationResult {
    let completed_with_findings = status == ApiStatus::Blocked
        && errors
            .first()
            .is_some_and(|error| error.code == "INTAKE_BLOCKING_FINDINGS");
    let completed = matches!(
        (operation, status),
        (IntakeOperation::Preflight, ApiStatus::Planned)
            | (IntakeOperation::Run, ApiStatus::Success)
    ) || completed_with_findings;

    if !completed {
        let message = errors
            .first()
            .map(|error| error.message.clone())
            .unwrap_or_else(|| {
                format!(
                    "JL Mixing Automation returned unexpected status {:?} for intake.validate",
                    status
                )
            });
        return blocked_intake_operation(IntakeOperationCode::Rejected, &message);
    }

    let Some(report_markdown) = data.get("report_markdown").and_then(|value| value.as_str()) else {
        return unverifiable_intake_result(operation);
    };

    let structured_files = data
        .get("files")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    let (audio_prep_available, audio_prep_files) = match data.get("audio_prep") {
        None => (false, Vec::new()),
        Some(audio_prep) => {
            let Some(files) = audio_prep.get("files").and_then(|value| value.as_array()) else {
                return unverifiable_intake_result(operation);
            };
            (true, files.clone())
        }
    };

    let parsed = intake_report::parse_report(report_markdown, request);
    let mut result = report_result(parsed, matches!(operation, IntakeOperation::Preflight));
    let Some(report) = result.report.as_ref() else {
        return unverifiable_intake_result(operation);
    };

    let returned_project_id = data
        .get("project")
        .and_then(|value| value.get("id"))
        .and_then(|value| value.as_str());
    let summary = data.get("summary");
    let files_discovered = summary
        .and_then(|value| value.get("files_discovered"))
        .and_then(|value| value.as_u64());
    let blocking_errors = summary
        .and_then(|value| value.get("blocking_errors"))
        .and_then(|value| value.as_u64());
    let warnings = summary
        .and_then(|value| value.get("warnings"))
        .and_then(|value| value.as_u64());

    let blocking_matches = completed_with_findings == (report.blocking_errors > 0);
    let summary_matches = returned_project_id == Some(request.project_id.as_str())
        && files_discovered == Some(report.files_discovered as u64)
        && blocking_errors == Some(report.blocking_errors as u64)
        && warnings == Some(report.warnings as u64);

    if !blocking_matches || !summary_matches {
        return unverifiable_intake_result(operation);
    }

    result.files = structured_files;
    result.audio_prep_files = audio_prep_files;
    result.audio_prep_available = audio_prep_available;
    if matches!(operation, IntakeOperation::Run) && result.code == IntakeOperationCode::Validated {
        result.message = "Intake validation completed and the report was verified.".into();
    }
    result
}

fn intake_api_error(operation: IntakeOperation, error: ApiCallError) -> IntakeOperationResult {
    match error {
        ApiCallError::Unavailable => blocked_intake_operation(
            IntakeOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        ApiCallError::IncompatibleVersion(version) => blocked_intake_operation(
            IntakeOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        error => blocked_intake_operation(
            match operation {
                IntakeOperation::Preflight => IntakeOperationCode::Failed,
                IntakeOperation::Run => IntakeOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn intake_arguments(
    project_directory: &Path,
    operation: IntakeOperation,
    progress: bool,
) -> Vec<String> {
    let mut arguments = vec![
        "intake".into(),
        "validate".into(),
        "--json".into(),
        "--project".into(),
        project_directory.to_string_lossy().into_owned(),
    ];
    if matches!(operation, IntakeOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    if progress {
        arguments.push("--progress=stderr-json".into());
    }
    arguments
}

fn unverifiable_intake_result(operation: IntakeOperation) -> IntakeOperationResult {
    blocked_intake_operation(
        match operation {
            IntakeOperation::Preflight => IntakeOperationCode::Failed,
            IntakeOperation::Run => IntakeOperationCode::Uncertain,
        },
        match operation {
            IntakeOperation::Preflight => {
                "The JL Mixing Automation intake preview could not be verified"
            }
            IntakeOperation::Run => {
                "Intake validation may have updated the report, but the authoritative result could not be verified. Do not retry automatically."
            }
        },
    )
}

fn report_result(
    report: Result<Option<crate::models::IntakeReport>, IntakeReportError>,
    preview: bool,
) -> IntakeOperationResult {
    match report {
        Ok(Some(report)) => {
            let blocking = report.blocking_errors > 0;
            IntakeOperationResult {
                ok: true,
                code: if blocking {
                    IntakeOperationCode::BlockingFindings
                } else if preview {
                    IntakeOperationCode::Ready
                } else {
                    IntakeOperationCode::Validated
                },
                message: if blocking {
                    "Intake validation completed with blocking findings."
                } else if preview {
                    "Intake preview completed. No changes were made."
                } else {
                    "The authoritative intake report was loaded."
                }
                .to_owned(),
                report: Some(report),
                files: Vec::new(),
                audio_prep_files: Vec::new(),
                audio_prep_available: false,
            }
        }
        Ok(None) => IntakeOperationResult {
            ok: true,
            code: IntakeOperationCode::NotRun,
            message: "No intake validation has been run for this project.".into(),
            report: None,
            files: Vec::new(),
            audio_prep_files: Vec::new(),
            audio_prep_available: false,
        },
        Err(IntakeReportError::Missing | IntakeReportError::Unsafe) => blocked_intake_operation(
            IntakeOperationCode::ReportUnavailable,
            "The authoritative intake report is missing or unsafe",
        ),
        Err(IntakeReportError::TooLarge | IntakeReportError::Invalid) => blocked_intake_operation(
            IntakeOperationCode::ReportUnavailable,
            "The authoritative intake report could not be parsed safely",
        ),
    }
}

fn normalize_intake_request(request: IntakeRequest) -> Result<IntakeRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    if !super::is_valid_client_id(&client_id) || !super::is_valid_client_id(&project_id) {
        return Err("Select a valid project before running intake validation".into());
    }
    Ok(IntakeRequest {
        client_id,
        project_id,
    })
}
