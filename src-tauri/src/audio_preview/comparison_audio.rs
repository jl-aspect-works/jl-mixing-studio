use super::NativeAudioPreviewState;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeComparisonCandidateStatus {
    pub blind_id: String,
    pub duration_seconds: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeComparisonAudioStatus {
    pub supported: bool,
    pub active_candidate_id: String,
    pub playing: bool,
    pub current_seconds: f64,
    pub duration_seconds: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub candidates: Option<Vec<NativeComparisonCandidateStatus>>,
}

#[cfg(target_os = "windows")]
use std::{collections::BTreeMap, time::Duration};

#[cfg(target_os = "windows")]
pub(super) struct WindowsComparisonPlayback {
    _stream: rodio::MixerDeviceSink,
    players: BTreeMap<String, rodio::Player>,
    durations: BTreeMap<String, Duration>,
    match_gains: BTreeMap<String, f32>,
    active_candidate_id: String,
    volume: f32,
}

#[cfg(target_os = "windows")]
impl WindowsComparisonPlayback {
    pub(super) fn clear(&self) {
        self.players.values().for_each(rodio::Player::clear);
    }

    fn status(&self, include_candidates: bool) -> NativeComparisonAudioStatus {
        let player = self.players.get(&self.active_candidate_id);
        let duration = self
            .durations
            .get(&self.active_candidate_id)
            .copied()
            .unwrap_or_default();
        NativeComparisonAudioStatus {
            supported: true,
            active_candidate_id: self.active_candidate_id.clone(),
            playing: player.is_some_and(|value| !value.is_paused() && !value.empty()),
            current_seconds: player.map_or(0.0, |value| value.get_pos().as_secs_f64()),
            duration_seconds: duration.as_secs_f64(),
            candidates: include_candidates.then(|| {
                self.durations
                    .iter()
                    .map(|(blind_id, duration)| NativeComparisonCandidateStatus {
                        blind_id: blind_id.clone(),
                        duration_seconds: duration.as_secs_f64(),
                    })
                    .collect()
            }),
        }
    }

    // Synchronization is operation/drift driven. Paused candidates are not polled or
    // decoded in lockstep, which avoids constant local and NAS I/O.
    fn synchronize_inactive(&self, position: Duration) {
        const DRIFT_THRESHOLD: Duration = Duration::from_millis(350);
        for (blind_id, player) in &self.players {
            if blind_id == &self.active_candidate_id {
                continue;
            }
            let current = player.get_pos();
            if current.abs_diff(position) < DRIFT_THRESHOLD {
                continue;
            }
            let duration = self.durations.get(blind_id).copied().unwrap_or_default();
            let _ = player.try_seek(position.min(duration));
        }
    }
}

pub(crate) fn prepare(
    state: &NativeAudioPreviewState,
    candidates: Vec<(String, std::path::PathBuf, Option<f64>)>,
    start_seconds: f64,
) -> Result<NativeComparisonAudioStatus, String> {
    if !start_seconds.is_finite() || start_seconds < 0.0 {
        return Err("Comparison start position is invalid".into());
    }
    #[cfg(target_os = "windows")]
    {
        use rodio::{Decoder, DeviceSinkBuilder, Player, Source};
        use std::fs::File;

        if candidates.len() < 2 {
            return Err("Comparison playback requires at least two candidates".into());
        }
        let stream = DeviceSinkBuilder::open_default_sink().map_err(|error| {
            format!("Unable to open the default Windows audio output device: {error}")
        })?;
        let mut players = BTreeMap::new();
        let mut durations = BTreeMap::new();
        let mut match_gains = BTreeMap::new();
        for (blind_id, path, applied_gain_db) in &candidates {
            let decoder = Decoder::try_from(
                File::open(path)
                    .map_err(|_| format!("Candidate {blind_id} could not be prepared."))?,
            )
            .map_err(|_| format!("Candidate {blind_id} could not be prepared."))?;
            let duration = decoder
                .total_duration()
                .ok_or_else(|| format!("Candidate {blind_id} could not be prepared."))?;
            let player = Player::connect_new(stream.mixer());
            player.pause();
            player.append(decoder);
            player
                .try_seek(Duration::from_secs_f64(start_seconds).min(duration))
                .map_err(|_| format!("Candidate {blind_id} could not be prepared."))?;
            let match_gain = gain_scalar(*applied_gain_db);
            player.set_volume(match_gain);
            players.insert(blind_id.clone(), player);
            durations.insert(blind_id.clone(), duration);
            match_gains.insert(blind_id.clone(), match_gain);
        }
        let comparison = WindowsComparisonPlayback {
            _stream: stream,
            players,
            durations,
            match_gains,
            active_candidate_id: candidates[0].0.clone(),
            volume: 1.0,
        };
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        playback.stop();
        playback.comparison = Some(comparison);
        return Ok(playback
            .comparison
            .as_ref()
            .expect("comparison was just assigned")
            .status(true));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (state, candidates);
        Ok(unsupported_status())
    }
}

pub(crate) fn play(state: &NativeAudioPreviewState) -> Result<NativeComparisonAudioStatus, String> {
    #[cfg(target_os = "windows")]
    {
        return with_comparison(state, |comparison| {
            comparison
                .players
                .get(&comparison.active_candidate_id)
                .ok_or_else(|| "The active comparison candidate is unavailable".to_owned())?
                .play();
            Ok(comparison.status(false))
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsupported_on_non_windows(state)
    }
}

pub(crate) fn pause(
    state: &NativeAudioPreviewState,
) -> Result<NativeComparisonAudioStatus, String> {
    #[cfg(target_os = "windows")]
    {
        return with_comparison(state, |comparison| {
            if let Some(player) = comparison.players.get(&comparison.active_candidate_id) {
                player.pause();
            }
            Ok(comparison.status(false))
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsupported_on_non_windows(state)
    }
}

pub(crate) fn seek(
    state: &NativeAudioPreviewState,
    seconds: f64,
) -> Result<NativeComparisonAudioStatus, String> {
    if !seconds.is_finite() || seconds < 0.0 {
        return Err("Comparison seek position is invalid".into());
    }
    #[cfg(target_os = "windows")]
    {
        return with_comparison(state, |comparison| {
            let position = Duration::from_secs_f64(seconds);
            let duration = comparison
                .durations
                .get(&comparison.active_candidate_id)
                .copied()
                .unwrap_or_default();
            comparison
                .players
                .get(&comparison.active_candidate_id)
                .ok_or_else(|| "The active comparison candidate is unavailable".to_owned())?
                .try_seek(position.min(duration))
                .map_err(|_| {
                    format!(
                        "Candidate {} could not be repositioned.",
                        comparison.active_candidate_id
                    )
                })?;
            comparison.synchronize_inactive(position);
            Ok(comparison.status(false))
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsupported_on_non_windows(state)
    }
}

pub(crate) fn switch_candidate(
    state: &NativeAudioPreviewState,
    candidate_id: &str,
) -> Result<NativeComparisonAudioStatus, String> {
    #[cfg(target_os = "windows")]
    {
        return with_comparison(state, |comparison| {
            let active = comparison
                .players
                .get(&comparison.active_candidate_id)
                .ok_or_else(|| "The active comparison candidate is unavailable".to_owned())?;
            let position = active.get_pos();
            let was_playing = !active.is_paused() && !active.empty();
            active.pause();

            let target = comparison
                .players
                .get(candidate_id)
                .ok_or_else(|| format!("Candidate {candidate_id} could not be selected."))?;
            let duration = comparison
                .durations
                .get(candidate_id)
                .copied()
                .unwrap_or_default();
            target
                .try_seek(position.min(duration))
                .map_err(|_| format!("Candidate {candidate_id} could not be selected."))?;
            comparison.active_candidate_id = candidate_id.to_owned();
            if was_playing {
                target.play();
            }
            comparison.synchronize_inactive(position);
            Ok(comparison.status(false))
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = candidate_id;
        unsupported_on_non_windows(state)
    }
}

pub(crate) fn set_volume(
    state: &NativeAudioPreviewState,
    volume: f32,
) -> Result<NativeComparisonAudioStatus, String> {
    #[cfg(target_os = "windows")]
    {
        return with_comparison(state, |comparison| {
            comparison.volume = volume.clamp(0.0, 1.0);
            for (blind_id, player) in &comparison.players {
                player.set_volume(
                    comparison.volume * comparison.match_gains.get(blind_id).copied().unwrap_or(1.0),
                );
            }
            Ok(comparison.status(false))
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = volume;
        unsupported_on_non_windows(state)
    }
}

pub(crate) fn stop(state: &NativeAudioPreviewState) -> Result<NativeComparisonAudioStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        if let Some(comparison) = playback.comparison.take() {
            comparison.clear();
        }
        return Ok(unsupported_status());
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsupported_on_non_windows(state)
    }
}

pub(crate) fn status(
    state: &NativeAudioPreviewState,
) -> Result<NativeComparisonAudioStatus, String> {
    #[cfg(target_os = "windows")]
    {
        return with_comparison(state, |comparison| Ok(comparison.status(false)));
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsupported_on_non_windows(state)
    }
}

fn unsupported_status() -> NativeComparisonAudioStatus {
    NativeComparisonAudioStatus {
        supported: false,
        active_candidate_id: String::new(),
        playing: false,
        current_seconds: 0.0,
        duration_seconds: 0.0,
        candidates: None,
    }
}

#[cfg(not(target_os = "windows"))]
fn unsupported_on_non_windows(
    state: &NativeAudioPreviewState,
) -> Result<NativeComparisonAudioStatus, String> {
    let _ = state;
    Ok(unsupported_status())
}

#[cfg(target_os = "windows")]
fn with_comparison(
    state: &NativeAudioPreviewState,
    operation: impl FnOnce(
        &mut WindowsComparisonPlayback,
    ) -> Result<NativeComparisonAudioStatus, String>,
) -> Result<NativeComparisonAudioStatus, String> {
    let mut playback = state
        .inner
        .lock()
        .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
    let comparison = playback
        .comparison
        .as_mut()
        .ok_or_else(|| "Comparison audio is not prepared".to_owned())?;
    operation(comparison)
}

#[cfg(target_os = "windows")]
fn gain_scalar(gain_db: Option<f64>) -> f32 {
    gain_db
        .filter(|value| value.is_finite())
        .map(|value| 10.0_f64.powf(value.min(0.0) / 20.0) as f32)
        .unwrap_or(1.0)
}
