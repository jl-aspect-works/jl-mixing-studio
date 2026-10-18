use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

pub(super) const OUTPUT_LOST_MESSAGE: &str = "Audio output was lost. Playback stopped. Restore your intended system output (and Dante Via, if used), then reload the preview or retry the comparison. Playback will not resume automatically.";

/// A stream callback latches this signal; only creating a new session resets it.
#[derive(Clone, Default)]
pub(super) struct OutputFailure(Arc<AtomicBool>);

impl OutputFailure {
    pub(super) fn record(&self) {
        self.0.store(true, Ordering::Release);
    }

    pub(super) fn failed(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_failure_is_visible_across_threads_and_remains_latched() {
        let session = OutputFailure::default();
        assert!(!session.failed());
        let callback = session.clone();
        std::thread::spawn(move || callback.record())
            .join()
            .unwrap();
        assert!(session.failed());
        assert!(session.failed());
        let next_session = OutputFailure::default();
        assert!(!next_session.failed());
        assert!(session.failed());
        assert!(OUTPUT_LOST_MESSAGE.contains("will not resume automatically"));
    }
}
