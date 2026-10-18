use serde::Serialize;
use std::path::Path;
#[cfg(any(target_os = "windows", target_os = "macos"))]
use std::sync::Mutex;
#[cfg(any(target_os = "windows", target_os = "macos"))]
use std::time::Duration;

mod comparison_audio;
#[cfg(any(target_os = "windows", target_os = "macos", test))]
mod output_failure;
#[cfg(any(target_os = "windows", target_os = "macos"))]
mod output_session;

pub(crate) const fn supported() -> bool {
    cfg!(any(target_os = "windows", target_os = "macos"))
}
pub(crate) use comparison_audio::{
    pause as pause_comparison, play as play_comparison, prepare as prepare_comparison,
    seek as seek_comparison, set_match_gains as set_comparison_match_gains,
    set_volume as set_comparison_volume, status as comparison_status, stop as stop_comparison,
    switch_candidate as switch_comparison_candidate, NativeComparisonAudioStatus,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioPreviewStatus {
    pub supported: bool,
    pub relative_path: Option<String>,
    pub playing: bool,
    pub current_seconds: f64,
    pub duration_seconds: f64,
}

#[derive(Default)]
pub(crate) struct NativeAudioPreviewState {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    inner: Mutex<NativePlayback>,
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
#[derive(Default)]
struct NativePlayback {
    stream: Option<output_session::OutputSession>,
    player: Option<rodio::Player>,
    relative_path: Option<String>,
    duration: Duration,
    volume: f32,
    comparison: Option<comparison_audio::NativeComparisonPlayback>,
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
impl NativePlayback {
    fn stop(&mut self) {
        if let Some(player) = self.player.take() {
            player.stop();
            drop(player);
        }
        self.stream.take();
        self.relative_path = None;
        self.duration = Duration::ZERO;
        if let Some(comparison) = self.comparison.take() {
            comparison.clear();
        }
    }

    fn check_output(&mut self) -> Result<(), String> {
        if self.stream.as_ref().is_some_and(|output| output.failed())
            || self
                .comparison
                .as_ref()
                .is_some_and(|value| value.output_failed())
        {
            self.stop();
            return Err(output_failure::OUTPUT_LOST_MESSAGE.into());
        }
        Ok(())
    }

    fn status(&self) -> NativeAudioPreviewStatus {
        let (playing, current_seconds) = match &self.player {
            Some(player) => (
                !player.is_paused() && !player.empty(),
                player.get_pos().as_secs_f64(),
            ),
            None => (false, 0.0),
        };
        NativeAudioPreviewStatus {
            supported: true,
            relative_path: self.relative_path.clone(),
            playing,
            current_seconds,
            duration_seconds: self.duration.as_secs_f64(),
        }
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn unsupported_status() -> NativeAudioPreviewStatus {
    NativeAudioPreviewStatus {
        supported: false,
        relative_path: None,
        playing: false,
        current_seconds: 0.0,
        duration_seconds: 0.0,
    }
}

pub(crate) fn load(
    state: &NativeAudioPreviewState,
    path: &Path,
    relative_path: String,
) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        use rodio::{Decoder, Player, Source};
        use std::fs::File;

        let decoder = Decoder::try_from(
            File::open(path)
                .map_err(|error| format!("Unable to open audio preview file: {error}"))?,
        )
        .map_err(|error| format!("Unable to decode audio preview file: {error}"))?;
        let duration = decoder
            .total_duration()
            .ok_or_else(|| "The audio preview duration could not be determined".to_owned())?;
        let stream = output_session::OutputSession::open()?;
        let player = Player::connect_new(stream.mixer());
        player.pause();
        player.append(decoder);

        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.stop();
        playback.volume = if playback.volume > 0.0 {
            playback.volume
        } else {
            1.0
        };
        player.set_volume(playback.volume);
        playback.stream = Some(stream);
        playback.player = Some(player);
        playback.relative_path = Some(relative_path);
        playback.duration = duration;
        return Ok(playback.status());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (state, path, relative_path);
        Ok(unsupported_status())
    }
}

pub(crate) fn play(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.check_output()?;
        let player = playback
            .player
            .as_ref()
            .ok_or_else(|| "No native audio preview is loaded".to_owned())?;
        player.play();
        return Ok(playback.status());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}

pub(crate) fn pause(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.check_output()?;
        if let Some(player) = &playback.player {
            player.pause();
        }
        return Ok(playback.status());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}

pub(crate) fn seek(
    state: &NativeAudioPreviewState,
    seconds: f64,
) -> Result<NativeAudioPreviewStatus, String> {
    if !seconds.is_finite() || seconds < 0.0 {
        return Err("Audio preview seek position is invalid".into());
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.check_output()?;
        let player = playback
            .player
            .as_ref()
            .ok_or_else(|| "No native audio preview is loaded".to_owned())?;
        player
            .try_seek(Duration::from_secs_f64(
                seconds.min(playback.duration.as_secs_f64()),
            ))
            .map_err(|error| format!("Unable to seek audio preview: {error}"))?;
        return Ok(playback.status());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}

pub(crate) fn set_volume(
    state: &NativeAudioPreviewState,
    volume: f32,
) -> Result<NativeAudioPreviewStatus, String> {
    let volume = volume.clamp(0.0, 1.0);
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.check_output()?;
        playback.volume = volume;
        if let Some(player) = &playback.player {
            player.set_volume(volume);
        }
        return Ok(playback.status());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (state, volume);
        Ok(unsupported_status())
    }
}

pub(crate) fn stop(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.stop();
        return Ok(playback.status());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}

pub(crate) fn status(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The native audio preview provider is unavailable".to_owned())?;
        playback.check_output()?;
        return Ok(playback.status());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}
