use std::env;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Instant;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use serde_json::json;

#[path = "diagnostic_log.rs"]
mod diagnostic_log;

use crate::automation_api::{
    automation_subprocess_path, resolve_command, ApiCallError, ApiError, ApiStatus,
    AUTOMATION_EXECUTABLE,
};

const SUPPORTED_API_VERSION: &str = "1.0";
const PROGRESS_PREFIX: &str = "JL_PROGRESS ";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IntakeProgressEvent {
    pub operation: String,
    pub phase: String,
    pub completed: usize,
    pub total: Option<usize>,
    pub active: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct StreamingAutomationResponse {
    api_version: String,
    operation: String,
    pub(crate) status: ApiStatus,
    pub(crate) data: serde_json::Value,
    pub(crate) errors: Vec<ApiError>,
}

pub(crate) fn invoke_with_progress<F>(
    home: &Path,
    arguments: &[String],
    expected_operation: &str,
    mut on_progress: F,
) -> Result<StreamingAutomationResponse, ApiCallError>
where
    F: FnMut(IntakeProgressEvent) + Send + 'static,
{
    let started = Instant::now();
    let Some(executable) = resolve_command(home, AUTOMATION_EXECUTABLE) else {
        diagnostic_log::error(
            "automation_resolve_failed",
            &[("operation", json!(expected_operation))],
        );
        return Err(ApiCallError::Unavailable);
    };
    diagnostic_log::info(
        "streaming_process_start",
        &[
            ("operation", json!(expected_operation)),
            ("executable", json!(executable.to_string_lossy())),
            ("argument_count", json!(arguments.len())),
        ],
    );

    let mut command = Command::new(&executable);
    command
        .args(arguments)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(path) = automation_subprocess_path(env::var_os("PATH").as_deref()) {
        command.env("PATH", path);
    }
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    // Context is explicit in arguments. Never assign a project/workspace cwd because Windows
    // UNC working directories are not reliable.
    let mut child = command.spawn().map_err(|error| {
        diagnostic_log::error(
            "streaming_process_spawn_failed",
            &[
                ("operation", json!(expected_operation)),
                ("error_kind", json!(format!("{:?}", error.kind()))),
            ],
        );
        if error.kind() == std::io::ErrorKind::NotFound {
            ApiCallError::Unavailable
        } else {
            ApiCallError::StartFailed
        }
    })?;
    let Some(stdout) = child.stdout.take() else {
        return Err(ApiCallError::StartFailed);
    };
    let Some(stderr) = child.stderr.take() else {
        return Err(ApiCallError::StartFailed);
    };

    let operation_for_thread = expected_operation.to_owned();
    let stderr_thread = thread::spawn(move || {
        let mut diagnostics = String::new();
        for line in BufReader::new(stderr).lines() {
            let Ok(line) = line else {
                diagnostic_log::error(
                    "stderr_read_failed",
                    &[("operation", json!(operation_for_thread))],
                );
                continue;
            };
            if let Some(payload) = line.strip_prefix(PROGRESS_PREFIX) {
                diagnostic_log::debug(
                    "progress_line_received",
                    &[
                        ("operation", json!(operation_for_thread)),
                        ("payload", json!(payload)),
                    ],
                );
                match serde_json::from_str::<IntakeProgressEvent>(payload) {
                    Ok(event) => {
                        diagnostic_log::debug(
                            "progress_event_parsed",
                            &[
                                ("operation", json!(event.operation)),
                                ("phase", json!(event.phase)),
                                ("completed", json!(event.completed)),
                                ("total", json!(event.total)),
                                ("active", json!(event.active)),
                            ],
                        );
                        on_progress(event);
                        continue;
                    }
                    Err(error) => {
                        diagnostic_log::error(
                            "progress_parse_failed",
                            &[
                                ("operation", json!(operation_for_thread)),
                                ("error", json!(error.to_string())),
                            ],
                        );
                    }
                }
            }
            diagnostics.push_str(&line);
            diagnostics.push('\n');
        }
        diagnostics
    });

    let mut stdout_text = String::new();
    let mut reader = BufReader::new(stdout);
    reader
        .read_to_string(&mut stdout_text)
        .map_err(|_| ApiCallError::Malformed)?;
    let status = child.wait().map_err(|_| ApiCallError::StartFailed)?;
    let diagnostics = stderr_thread.join().map_err(|_| ApiCallError::Malformed)?;
    diagnostic_log::info(
        "streaming_process_complete",
        &[
            ("operation", json!(expected_operation)),
            ("duration_ms", json!(started.elapsed().as_millis() as u64)),
            ("exit_success", json!(status.success())),
            ("diagnostic_bytes", json!(diagnostics.len())),
        ],
    );

    let response: StreamingAutomationResponse =
        serde_json::from_str(stdout_text.trim()).map_err(|_| ApiCallError::Malformed)?;
    if response.api_version != SUPPORTED_API_VERSION {
        return Err(ApiCallError::IncompatibleVersion(response.api_version));
    }
    if response.operation != expected_operation {
        return Err(ApiCallError::UnexpectedOperation(response.operation));
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_event_deserializes_automation_contract() {
        let event: IntakeProgressEvent = serde_json::from_str(
            r#"{"operation":"intake.validate","phase":"validating","completed":7,"total":20,"active":["Kick.wav","Snare.wav"]}"#,
        )
        .expect("progress JSON");
        assert_eq!(event.completed, 7);
        assert_eq!(event.total, Some(20));
        assert_eq!(event.active, ["Kick.wav", "Snare.wav"]);
    }
}
