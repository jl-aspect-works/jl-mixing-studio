use std::env;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};

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
    let Some(executable) = resolve_command(home, AUTOMATION_EXECUTABLE) else {
        return Err(ApiCallError::Unavailable);
    };

    let mut command = Command::new(executable);
    command
        .args(arguments)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(path) = automation_subprocess_path(env::var_os("PATH").as_deref()) {
        command.env("PATH", path);
    }
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    // As with the shared Automation boundary, context is explicit in arguments. Never assign a
    // project or workspace cwd here because Windows UNC working directories are not reliable.
    let mut child = command.spawn().map_err(|error| {
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

    let stderr_thread = thread::spawn(move || {
        let mut diagnostics = String::new();
        for line in BufReader::new(stderr).lines() {
            let Ok(line) = line else {
                continue;
            };
            if let Some(payload) = line.strip_prefix(PROGRESS_PREFIX) {
                if let Ok(event) = serde_json::from_str::<IntakeProgressEvent>(payload) {
                    on_progress(event);
                    continue;
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
    child.wait().map_err(|_| ApiCallError::StartFailed)?;
    let _diagnostics = stderr_thread.join().map_err(|_| ApiCallError::Malformed)?;

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
