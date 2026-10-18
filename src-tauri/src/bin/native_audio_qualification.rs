//! Headless native decoder/control qualification. Does not claim audible output.
use rodio::{Decoder, Player, Source};
use std::{error::Error, fs::File, path::Path, time::Duration};

fn qualify(path: &Path) -> Result<(), Box<dyn Error>> {
    let mut decoder = Decoder::try_from(File::open(path)?)?;
    let channels = decoder.channels().get();
    let rate = decoder.sample_rate().get();
    let duration = decoder.total_duration().ok_or("Missing native duration")?;
    if !(0.9..=1.2).contains(&duration.as_secs_f64()) {
        return Err(format!("Unexpected one-second fixture duration: {duration:?}").into());
    }
    if channels
        != if path.file_name().unwrap().to_string_lossy().contains("mono") {
            1
        } else {
            2
        }
    {
        return Err("Channel count changed".into());
    }
    decoder.try_seek(Duration::from_millis(500))?;
    if !decoder
        .take((rate * u32::from(channels) / 10) as usize)
        .any(|sample| sample.abs() > 0.0001)
    {
        return Err("No audible samples after native seek".into());
    }
    println!(
        "PASS {}: channels={channels}, rate={rate}, duration={duration:?}, seek=500ms",
        path.display()
    );
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let files: Vec<_> = std::env::args().skip(1).collect();
    if files.len() != 9 {
        return Err("Expected all nine generated native codec fixtures".into());
    }
    for file in files {
        qualify(Path::new(&file))?;
    }
    // A disconnected output must be stoppable without waiting for a render callback.
    let (player, output) = Player::new();
    player.append(rodio::source::SineWave::new(440.0).take_duration(Duration::from_secs(1)));
    player.pause();
    assert!(player.is_paused());
    player.set_volume(0.0);
    assert_eq!(player.volume(), 0.0);
    player.play();
    assert!(!player.is_paused());
    player.stop();
    drop(player);
    drop(output);
    println!("PASS native play/pause/mute and teardown without a live audio callback; audible output NOT tested");
    Ok(())
}
