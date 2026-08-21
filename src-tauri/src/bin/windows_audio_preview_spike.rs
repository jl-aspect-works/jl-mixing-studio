#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("windows_audio_preview_spike is only intended to run on Windows");
}

#[cfg(target_os = "windows")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    windows::run()
}

#[cfg(target_os = "windows")]
mod windows {
    use rodio::{Decoder, DeviceSinkBuilder, Player, Source};
    use std::error::Error;
    use std::fs::{self, File};
    use std::path::{Path, PathBuf};
    use std::thread;
    use std::time::Duration;

    pub fn run() -> Result<(), Box<dyn Error>> {
        let mut require_device = false;
        let mut manual_play = false;
        let mut files = Vec::new();
        for argument in std::env::args().skip(1) {
            match argument.as_str() {
                "--require-device" => require_device = true,
                "--manual-play" => manual_play = true,
                _ => files.push(PathBuf::from(argument)),
            }
        }
        if files.is_empty() {
            return Err("provide one or more audio fixture paths".into());
        }

        if manual_play {
            return manual_playback(&files);
        }

        for path in &files {
            probe_decode_seek_and_release(path)?;
        }

        probe_unsupported_rejection(&files[0])?;
        probe_player_control_surface(&files[0])?;

        if require_device {
            probe_default_output_device(&files[0])?;
            println!("PASS default Windows audio output device playback/control probe");
        } else {
            println!(
                "SKIP default Windows audio output device probe in headless CI; packaged/manual acceptance covers real output-device playback."
            );
        }

        println!("PASS Windows native audio preview spike");
        Ok(())
    }

    fn manual_playback(files: &[PathBuf]) -> Result<(), Box<dyn Error>> {
        let device = DeviceSinkBuilder::open_default_sink().map_err(|error| {
            format!("Unable to open the default Windows audio output device: {error}")
        })?;
        println!("JL Mixing Studio Windows native audio spike manual playback");
        println!("Using the default Windows audio output device.");

        for path in files {
            let decoder = Decoder::try_from(File::open(path)?)?;
            let duration = decoder
                .total_duration()
                .ok_or_else(|| format!("{} did not report a duration", path.display()))?;
            let player = Player::connect_new(device.mixer());
            player.append(decoder);
            println!(
                "PLAYING {} ({:.2}s)",
                path.file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("<audio>"),
                duration.as_secs_f64()
            );
            thread::sleep(duration + Duration::from_millis(250));
            player.clear();
            drop(player);
            prove_file_release(path)?;
            println!("PASS audible playback and file release: {}", path.display());
        }

        drop(device);
        println!("PASS manual Windows output-device playback");
        Ok(())
    }

    fn probe_decode_seek_and_release(path: &Path) -> Result<(), Box<dyn Error>> {
        let file = File::open(path)?;
        let mut decoder = Decoder::try_from(file)?;
        let channels = decoder.channels().get();
        let sample_rate = decoder.sample_rate();
        let duration = decoder
            .total_duration()
            .ok_or_else(|| format!("{} did not report a duration", path.display()))?;
        if duration.is_zero() {
            return Err(format!("{} reported zero duration", path.display()).into());
        }

        let seek_to = Duration::from_secs_f64(duration.as_secs_f64() / 2.0);
        decoder.try_seek(seek_to)?;
        if decoder.next().is_none() {
            return Err(format!("{} produced no samples after seek", path.display()).into());
        }
        drop(decoder);

        prove_file_release(path)?;
        println!(
            "PASS {} channels={} sample_rate={} duration_ms={} seek_ms={}",
            path.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("<audio>"),
            channels,
            sample_rate,
            duration.as_millis(),
            seek_to.as_millis()
        );
        Ok(())
    }

    fn probe_unsupported_rejection(reference: &Path) -> Result<(), Box<dyn Error>> {
        let unsupported = reference
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("unsupported-preview.txt");
        fs::write(&unsupported, b"not an audio stream")?;
        let decode_result = Decoder::try_from(File::open(&unsupported)?);
        if decode_result.is_ok() {
            fs::remove_file(&unsupported)?;
            return Err("unsupported input unexpectedly decoded".into());
        }
        fs::remove_file(&unsupported)?;
        println!("PASS unsupported input rejected cleanly");
        Ok(())
    }

    fn probe_player_control_surface(path: &Path) -> Result<(), Box<dyn Error>> {
        let decoder = Decoder::try_from(File::open(path)?)?;
        let (player, output) = Player::new();
        player.append(decoder);
        player.pause();
        if !player.is_paused() {
            return Err("rodio Player did not enter paused state".into());
        }
        player.play();
        if player.is_paused() {
            return Err("rodio Player did not resume from paused state".into());
        }
        player.clear();
        if !player.empty() {
            return Err("rodio Player did not clear the active source".into());
        }
        drop(player);
        drop(output);
        prove_file_release(path)?;
        println!("PASS rodio Player play/pause/clear/drop control surface");
        Ok(())
    }

    fn probe_default_output_device(path: &Path) -> Result<(), Box<dyn Error>> {
        let device = DeviceSinkBuilder::open_default_sink()?;
        let player = Player::connect_new(device.mixer());
        player.append(Decoder::try_from(File::open(path)?)?);
        thread::sleep(Duration::from_millis(100));
        player.pause();
        let paused_position = player.get_pos();
        thread::sleep(Duration::from_millis(50));
        player.play();
        player.try_seek(Duration::from_millis(250))?;
        thread::sleep(Duration::from_millis(100));
        let resumed_position = player.get_pos();
        if resumed_position < Duration::from_millis(200) {
            return Err(format!(
                "native output seek/progress did not advance as expected (paused={:?}, resumed={:?})",
                paused_position, resumed_position
            )
            .into());
        }
        player.clear();
        drop(player);
        drop(device);
        prove_file_release(path)?;
        Ok(())
    }

    fn prove_file_release(path: &Path) -> Result<(), Box<dyn Error>> {
        let mut temporary = path.to_path_buf();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("audio");
        temporary.set_extension(format!("{extension}.release-check"));
        if temporary.exists() {
            fs::remove_file(&temporary)?;
        }
        fs::rename(path, &temporary)?;
        fs::rename(&temporary, path)?;
        Ok(())
    }
}
