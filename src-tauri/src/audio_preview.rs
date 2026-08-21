use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioPreviewStatus {
    pub supported: bool,
    pub relative_path: Option<String>,
    pub playing: bool,
    pub current_seconds: f64,
    pub duration_seconds: f64,
}

pub(crate) struct NativeAudioPreviewState {
    #[cfg(target_os = "windows")]
    inner: Mutex<WindowsPlayback>,
}

impl Default for NativeAudioPreviewState {
    fn default() -> Self {
        Self {
            #[cfg(target_os = "windows")]
            inner: Mutex::new(WindowsPlayback::default()),
        }
    }
}

#[cfg(target_os = "windows")]
#[derive(Default)]
struct WindowsPlayback {
    stream: Option<rodio::OutputStream>,
    player: Option<rodio::Player>,
    relative_path: Option<String>,
    duration: Duration,
    volume: f32,
}

#[cfg(target_os = "windows")]
impl WindowsPlayback {
    fn stop(&mut self) {
        if let Some(player) = self.player.take() {
            player.clear();
            drop(player);
        }
        self.stream.take();
        self.relative_path = None;
        self.duration = Duration::ZERO;
    }

    fn status(&self) -> NativeAudioPreviewStatus {
        let (playing, current_seconds) = match &self.player {
            Some(player) => (!player.is_paused() && !player.empty(), player.get_pos().as_secs_f64()),
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
    #[cfg(target_os = "windows")]
    {
        use rodio::{Decoder, DeviceSinkBuilder, Player, Source};
        use std::fs::File;

        let decoder = Decoder::try_from(
            File::open(path).map_err(|error| format!("Unable to open audio preview file: {error}"))?,
        )
        .map_err(|error| format!("Unable to decode audio preview file: {error}"))?;
        let duration = decoder
            .total_duration()
            .ok_or_else(|| "The audio preview duration could not be determined".to_owned())?;
        let stream = DeviceSinkBuilder::open_default_sink()
            .map_err(|error| format!("Unable to open the default Windows audio output device: {error}"))?;
        let player = Player::connect_new(stream.mixer());
        player.pause();
        player.append(decoder);

        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        playback.stop();
        playback.volume = if playback.volume > 0.0 { playback.volume } else { 1.0 };
        player.set_volume(playback.volume);
        playback.stream = Some(stream);
        playback.player = Some(player);
        playback.relative_path = Some(relative_path);
        playback.duration = duration;
        return Ok(playback.status());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (state, path, relative_path);
        Ok(unsupported_status())
    }
}

pub(crate) fn play(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        let player = playback
            .player
            .as_ref()
            .ok_or_else(|| "No Windows audio preview is loaded".to_owned())?;
        player.play();
        return Ok(playback.status());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}

pub(crate) fn pause(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        if let Some(player) = &playback.player {
            player.pause();
        }
        return Ok(playback.status());
    }
    #[cfg(not(target_os = "windows"))]
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
    #[cfg(target_os = "windows")]
    {
        let playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        let player = playback
            .player
            .as_ref()
            .ok_or_else(|| "No Windows audio preview is loaded".to_owned())?;
        player
            .try_seek(Duration::from_secs_f64(seconds.min(playback.duration.as_secs_f64())))
            .map_err(|error| format!("Unable to seek audio preview: {error}"))?;
        return Ok(playback.status());
    }
    #[cfg(not(target_os = "windows"))]
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
    #[cfg(target_os = "windows")]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        playback.volume = volume;
        if let Some(player) = &playback.player {
            player.set_volume(volume);
        }
        return Ok(playback.status());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (state, volume);
        Ok(unsupported_status())
    }
}

pub(crate) fn stop(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let mut playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        playback.stop();
        return Ok(playback.status());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}

pub(crate) fn status(state: &NativeAudioPreviewState) -> Result<NativeAudioPreviewStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let playback = state
            .inner
            .lock()
            .map_err(|_| "The Windows audio preview provider is unavailable".to_owned())?;
        return Ok(playback.status());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = state;
        Ok(unsupported_status())
    }
}
