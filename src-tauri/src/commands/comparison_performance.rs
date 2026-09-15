use crate::diagnostic_log;
use serde::Deserialize;
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComparisonPlaybackLogRequest {
    action: String,
    outcome: String,
    operation_id: String,
    provider: String,
    revision_id: Option<String>,
    revision_number: Option<u32>,
    blind_id: Option<String>,
    target_revision_id: Option<String>,
    target_revision_number: Option<u32>,
    target_blind_id: Option<String>,
    candidate_count: u32,
    loop_enabled: bool,
    play_requested: bool,
    provider_playing: bool,
    full_song: bool,
    at_region_end: bool,
    position_ms: u64,
    region_end_ms: u64,
    provider_paused: Option<bool>,
    provider_ended: Option<bool>,
    ready_state: Option<u8>,
    network_state: Option<u8>,
}

// Playback diagnostics intentionally include revision identity for acceptance troubleshooting,
// but accept no paths or free-form error text from the frontend.
#[tauri::command]
pub(crate) fn log_comparison_playback(
    request: ComparisonPlaybackLogRequest,
) -> Result<(), String> {
    let valid_action = matches!(
        request.action.as_str(),
        "session_ready"
            | "toggle"
            | "candidate_switch"
            | "loop_restart"
            | "playback_end"
            | "retry"
            | "status"
    );
    let valid_outcome = matches!(request.outcome.as_str(), "started" | "success" | "error");
    let valid_provider = matches!(request.provider.as_str(), "web" | "native" | "unknown");
    let valid_operation_id = request.operation_id.len() <= 64
        && request
            .operation_id
            .chars()
            .all(|character| character.is_ascii_digit() || character == '-');
    let valid_blind_id = |value: &Option<String>| {
        value.as_ref().is_none_or(|candidate| {
            candidate.len() == 1 && candidate.chars().all(|character| character.is_ascii_uppercase())
        })
    };
    let valid_revision_id = |value: &Option<String>| {
        value.as_ref().is_none_or(|revision| {
            !revision.is_empty()
                && revision.len() <= 128
                && revision.chars().all(|character| {
                    character.is_ascii_alphanumeric()
                        || matches!(character, '-' | '_' | '.')
                })
        })
    };
    if !valid_action
        || !valid_outcome
        || !valid_provider
        || !valid_operation_id
        || !valid_blind_id(&request.blind_id)
        || !valid_blind_id(&request.target_blind_id)
        || !valid_revision_id(&request.revision_id)
        || !valid_revision_id(&request.target_revision_id)
        || request.candidate_count > 26
    {
        return Err("Invalid comparison playback event".into());
    }
    diagnostic_log::log(
        "info",
        "comparison_playback",
        &[
            ("action", json!(request.action)),
            ("outcome", json!(request.outcome)),
            ("operation_id", json!(request.operation_id)),
            ("provider", json!(request.provider)),
            ("revision_id", json!(request.revision_id)),
            ("revision_number", json!(request.revision_number)),
            ("blind_id", json!(request.blind_id)),
            ("target_revision_id", json!(request.target_revision_id)),
            ("target_revision_number", json!(request.target_revision_number)),
            ("target_blind_id", json!(request.target_blind_id)),
            ("candidate_count", json!(request.candidate_count)),
            ("loop_enabled", json!(request.loop_enabled)),
            ("play_requested", json!(request.play_requested)),
            ("provider_playing", json!(request.provider_playing)),
            ("full_song", json!(request.full_song)),
            ("at_region_end", json!(request.at_region_end)),
            ("position_ms", json!(request.position_ms)),
            ("region_end_ms", json!(request.region_end_ms)),
            ("provider_paused", json!(request.provider_paused)),
            ("provider_ended", json!(request.provider_ended)),
            ("ready_state", json!(request.ready_state)),
            ("network_state", json!(request.network_state)),
        ],
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn playback_request() -> ComparisonPlaybackLogRequest {
        ComparisonPlaybackLogRequest {
            action: "candidate_switch".into(),
            outcome: "success".into(),
            operation_id: "123-1".into(),
            provider: "web".into(),
            revision_id: Some("revision-2".into()),
            revision_number: Some(2),
            blind_id: Some("B".into()),
            target_revision_id: Some("revision-3".into()),
            target_revision_number: Some(3),
            target_blind_id: Some("C".into()),
            candidate_count: 4,
            loop_enabled: true,
            play_requested: true,
            provider_playing: false,
            full_song: true,
            at_region_end: true,
            position_ms: 180_000,
            region_end_ms: 180_000,
            provider_paused: Some(true),
            provider_ended: Some(true),
            ready_state: Some(4),
            network_state: Some(1),
        }
    }

    #[test]
    fn playback_log_accepts_revision_identity_but_rejects_path_like_values() {
        assert!(log_comparison_playback(playback_request()).is_ok());
        let mut invalid = playback_request();
        invalid.revision_id = Some("../Revision_02/mix.wav".into());
        assert!(log_comparison_playback(invalid).is_err());
    }
}
