//! Isolated #512 output/discovery experiment; never reads Studio configuration.
use rodio::{Decoder, DeviceSinkBuilder, Player, Source};
use std::error::Error;
use std::fs::File;
use std::io::{Cursor, Write};
use std::thread;
use std::time::Duration;

fn fixture() -> Vec<u8> {
    let frames = 192_000_u32;
    let mut wav = Vec::with_capacity((44 + frames * 4) as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + frames * 4).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&48_000_u32.to_le_bytes());
    wav.extend_from_slice(&192_000_u32.to_le_bytes());
    wav.extend_from_slice(&4_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&(frames * 4).to_le_bytes());
    for frame in 0..frames {
        let left = frame < frames / 2;
        let position = frame % (frames / 2);
        let ramp = (position.min(frames / 2 - 1 - position) as f64 / 480.0).min(1.0);
        let frequency = if left { 440.0 } else { 880.0 };
        let sample = (1_000.0
            * ramp
            * (std::f64::consts::TAU * frequency * frame as f64 / 48_000.0).sin())
            as i16;
        wav.extend_from_slice(&(if left { sample } else { 0 }).to_le_bytes());
        wav.extend_from_slice(&(if left { 0 } else { sample }).to_le_bytes());
    }
    wav
}

fn run(log: &mut File, decode_only: bool) -> Result<(), Box<dyn Error>> {
    let decoder = Decoder::new(Cursor::new(fixture()))?;
    if decoder.channels().get() != 2 || decoder.sample_rate().get() != 48_000 {
        return Err("generated fixture did not decode as stereo 48 kHz".into());
    }
    writeln!(log, "PASS generated stereo/48 kHz PCM decode")?;
    if decode_only {
        return Ok(());
    }

    // Same output builder and player type as Studio's current Windows provider.
    // Keep the sink alive for the entire test; no default-device fallback retry.
    let sink = DeviceSinkBuilder::open_default_sink()?;
    let player = Player::connect_new(sink.mixer());
    player.append(decoder.repeat_infinite());
    writeln!(log, "STARTED 60-second rodio/CPAL output; discovery NOT VERIFIED")?;
    log.flush()?;
    thread::sleep(Duration::from_secs(60));
    player.clear();
    writeln!(log, "FINISHED; discovery and signal must be observed manually")?;
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let decode_only = match std::env::args().nth(1).as_deref() {
        None => false,
        Some("--decode-only") => true,
        _ => return Err("usage: JL-Dante-Rodio-Probe [--decode-only]".into()),
    };
    let log_path = std::env::temp_dir().join(format!("jl-dante-rodio-{}.log", std::process::id()));
    let mut log = File::create(&log_path)?;
    println!("Diagnostic log: {}", log_path.display());
    writeln!(log, "rodio=0.22.2 CPAL=0.17.3 PID={}", std::process::id())?;
    if let Err(error) = run(&mut log, decode_only) {
        writeln!(log, "ERROR {error}")?;
        return Err(error);
    }
    Ok(())
}
