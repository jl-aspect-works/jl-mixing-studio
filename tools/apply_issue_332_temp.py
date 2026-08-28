from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

p = Path("src-tauri/src/managed_client_files.rs")
s = p.read_text()
anchor = '''pub fn plan_import(app: &AppHandle, request: ManagedImportRequest) -> ManagedOperationResult {
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    if supports_managed_stdin(&home) {
        match import_stdin_request(&request, false) {
            Ok((arguments, payload)) => {
                call_api_with_stdin(app, &project, IMPORT_PLAN_OPERATION, arguments, &payload)
            }
            Err(message) => request_error(message),
        }
    } else {
        match import_arguments(&request, false) {
            Ok(arguments) => call_api(app, &project, IMPORT_PLAN_OPERATION, arguments),
            Err(message) => request_error(message),
        }
    }
}
'''
replacement = '''pub fn plan_import_with_progress<F>(
    app: &AppHandle,
    request: ManagedImportRequest,
    on_progress: F,
) -> ManagedOperationResult
where
    F: FnMut(IntakeProgressEvent) + Send + 'static,
{
    let project = match project_directory(app, &request.client_id, &request.project_id) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let home = match resolve_home(app) {
        Ok(value) => value,
        Err(message) => return request_error(message),
    };
    let progress = supports_import_progress(&home);
    if supports_managed_stdin(&home) {
        let (mut arguments, payload) = match import_stdin_request(&request, false) {
            Ok(value) => value,
            Err(message) => return request_error(message),
        };
        if progress {
            arguments.push("--progress=stderr-json".into());
        }
        let arguments = with_project_argument(&project, arguments);
        return match invoke_with_progress_input(
            &home,
            &arguments,
            IMPORT_PLAN_OPERATION,
            Some(&payload),
            on_progress,
        ) {
            Ok(response) => finish_streaming_response(response),
            Err(error) => request_error(error.message()),
        };
    }

    let mut arguments = match import_arguments(&request, false) {
        Ok(arguments) => arguments,
        Err(message) => return request_error(message),
    };
    if !progress {
        return call_api(app, &project, IMPORT_PLAN_OPERATION, arguments);
    }
    arguments.push("--progress=stderr-json".into());
    let arguments = with_project_argument(&project, arguments);
    match invoke_with_progress(&home, &arguments, IMPORT_PLAN_OPERATION, on_progress) {
        Ok(response) => finish_streaming_response(response),
        Err(error) => request_error(error.message()),
    }
}
'''
s = replace_once(s, anchor, replacement, "plan import function")
p.write_text(s)

p = Path("src-tauri/src/lib.rs")
s = p.read_text()
old = '''#[tauri::command]
fn plan_managed_client_import(
    app: tauri::AppHandle,
    request: ManagedImportRequest,
) -> ManagedOperationResult {
    managed_client_files::plan_import(&app, request)
}
'''
new = '''#[tauri::command]
async fn plan_managed_client_import(
    app: tauri::AppHandle,
    request: ManagedImportRequest,
    progress: tauri::ipc::Channel<serde_json::Value>,
) -> Result<ManagedOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client_id = request.client_id.clone();
        let project_id = request.project_id.clone();
        managed_client_files::plan_import_with_progress(&app, request, move |event| {
            let _ = progress.send(serde_json::json!({
                "clientId": &client_id,
                "projectId": &project_id,
                "phase": event.phase,
                "completed": event.completed,
                "total": event.total,
                "overallCompleted": event.overall_completed,
                "overallTotal": event.overall_total,
                "active": event.active,
            }));
        })
    })
    .await
    .map_err(|error| format!("Managed import planning task failed: {error}"))
}
'''
s = replace_once(s, old, new, "Tauri plan command")
p.write_text(s)

p = Path("src/intake/ManagedFileOperationDialog.tsx")
s = p.read_text()
s = replace_once(
    s,
    '      const result = await planManagedImport({ clientId, projectId, sourceKind, sources });\n',
    '      setImportProgress(null);\n      const result = await planManagedImport({ clientId, projectId, sourceKind, sources }, setImportProgress);\n',
    "plan callback",
)
old = '''      {state.status === "planning" && <div className="managed-operation-progress managed-operation-progress-primary" role="status" aria-live="polite"><span className="client-files-spinner" aria-hidden="true" /><strong>{sourceReviewLabel(state.sourceKind, state.sources)}</strong><p>Preparing the selected files for import. No project files are being changed yet.</p></div>}
'''
new = '''      {state.status === "planning" && <div className="managed-operation-progress managed-operation-progress-primary" role="status" aria-live="polite">{importProgressUi?.determinate ? <><strong>{importProgressUi.label}</strong><progress aria-label={importProgressUi.ariaLabel} value={importProgressUi.value} max={importProgressUi.max} /><p>Reviewing destinations and existing Audio Prep lineage. No project files are being changed yet.</p></> : <><span className="client-files-spinner" aria-hidden="true" /><strong>{sourceReviewLabel(state.sourceKind, state.sources)}</strong><p>Preparing the selected files for import. No project files are being changed yet.</p></>}</div>}
'''
s = replace_once(s, old, new, "planning progress presentation")
p.write_text(s)
