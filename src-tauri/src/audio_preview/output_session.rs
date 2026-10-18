use super::output_failure::OutputFailure;
use rodio::{DeviceSinkBuilder, MixerDeviceSink};

pub(super) struct OutputSession {
    stream: MixerDeviceSink,
    failure: OutputFailure,
}

impl OutputSession {
    pub(super) fn open() -> Result<Self, String> {
        let failure = OutputFailure::default();
        let callback_failure = failure.clone();
        // open_default_sink can fall back to other output devices. Bind this
        // session to the chosen default instead; failure must not leak to speakers.
        let stream = DeviceSinkBuilder::from_default_device()
            .map_err(|error| format!("Unable to select the default audio output: {error}"))?
            .with_error_callback(move |error| {
                callback_failure.record();
                eprintln!("Native audio output failed: {error}");
            })
            .open_sink_or_fallback()
            .map_err(|error| format!("Unable to open the default audio output. Check your intended system output and Dante Via, if used, then retry: {error}"))?;
        Ok(Self { stream, failure })
    }

    pub(super) fn mixer(&self) -> &rodio::mixer::Mixer {
        self.stream.mixer()
    }

    pub(super) fn failed(&self) -> bool {
        self.failure.failed()
    }
}
