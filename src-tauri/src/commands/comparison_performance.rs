use crate::diagnostic_log;
use serde_json::json;

// Deliberately narrow diagnostics: no file paths, revision mappings, or free-form errors.
#[tauri::command]
pub(crate) fn log_comparison_performance(
    phase: String,
    outcome: String,
    operation_id: String,
    count: u32,
    elapsed_ms: u64,
) -> Result<(), String> {
    let valid_phase = matches!(
        phase.as_str(),
        "setup"
            | "waveform"
            | "loudness"
            | "candidate_source"
            | "audio_prepare"
            | "session_prepare"
            | "candidate_switch"
            | "results"
            | "save_session"
    );
    let valid_outcome = matches!(
        outcome.as_str(),
        "started" | "success" | "error" | "cancelled"
    );
    if !valid_phase
        || !valid_outcome
        || operation_id.len() > 64
        || !operation_id.chars().all(|c| c.is_ascii_digit() || c == '-')
    {
        return Err("Invalid comparison timing event".into());
    }
    diagnostic_log::log(
        "info",
        "comparison_performance",
        &[
            ("phase", json!(phase)),
            ("outcome", json!(outcome)),
            ("operation_id", json!(operation_id)),
            ("count", json!(count)),
            ("elapsed_ms", json!(elapsed_ms)),
        ],
    );
    Ok(())
}
