use serde::Serialize;
use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectAudioWaveform {
    pub(super) duration_seconds: f64,
    pub(super) peaks: Vec<f32>,
}

#[derive(PartialEq)]
struct Fingerprint {
    length: u64,
    modified: SystemTime,
}

impl Fingerprint {
    fn read(path: &Path) -> Result<Self, String> {
        let metadata = fs::metadata(path).map_err(|_| "Waveform source is unavailable")?;
        Ok(Self {
            length: metadata.len(),
            modified: metadata
                .modified()
                .map_err(|_| "Waveform source timestamp is unavailable")?,
        })
    }
}

struct Entry {
    fingerprint: Fingerprint,
    waveform: ProjectAudioWaveform,
}

type Slot = Arc<Mutex<Option<Entry>>>;

#[derive(Default)]
pub(super) struct WaveformCache {
    slots: Mutex<VecDeque<(PathBuf, Slot)>>,
}

impl WaveformCache {
    // Cache only validated canonical paths. A per-source lock joins overlapping decodes,
    // while unrelated sources remain independent. Keep at most 32 cached waveforms.
    pub(super) fn get(
        &self,
        path: &Path,
        decode: impl FnOnce() -> Result<ProjectAudioWaveform, String>,
    ) -> Result<(ProjectAudioWaveform, bool), String> {
        let slot = {
            let mut slots = self
                .slots
                .lock()
                .map_err(|_| "Waveform cache is unavailable")?;
            let slot = if let Some(index) = slots.iter().position(|(key, _)| key == path) {
                slots
                    .remove(index)
                    .ok_or("Waveform cache slot is unavailable")?
                    .1
            } else {
                Arc::new(Mutex::new(None))
            };
            slots.push_back((path.to_owned(), slot.clone()));
            if slots.len() > 32 {
                slots.pop_front();
            }
            slot
        };
        let mut entry = slot
            .lock()
            .map_err(|_| "Waveform cache entry is unavailable")?;
        let fingerprint = Fingerprint::read(path)?;
        if let Some(cached) = entry
            .as_ref()
            .filter(|cached| cached.fingerprint == fingerprint)
        {
            return Ok((cached.waveform.clone(), true));
        }
        let waveform = decode()?;
        if fingerprint != Fingerprint::read(path)? {
            return Err("Waveform source changed while loading; select it again to retry".into());
        }
        *entry = Some(Entry {
            fingerprint,
            waveform: waveform.clone(),
        });
        Ok((waveform, false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    fn waveform() -> ProjectAudioWaveform {
        ProjectAudioWaveform {
            duration_seconds: 30.0,
            peaks: vec![0.5],
        }
    }

    #[test]
    fn unchanged_source_is_reused_but_modified_and_deleted_sources_are_not() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audio");
        fs::write(&path, b"original").unwrap();
        let cache = WaveformCache::default();
        assert!(!cache.get(&path, || Ok(waveform())).unwrap().1);
        assert!(cache.get(&path, || panic!("must reuse")).unwrap().1);
        let modified = SystemTime::now() + Duration::from_secs(5);
        fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_modified(modified)
            .unwrap();
        assert!(!cache.get(&path, || Ok(waveform())).unwrap().1);
        fs::remove_file(&path).unwrap();
        assert!(cache
            .get(&path, || panic!("must reject deleted source"))
            .is_err());
    }

    #[test]
    fn overlapping_requests_decode_once_and_failures_can_retry() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audio");
        fs::write(&path, b"audio").unwrap();
        let cache = Arc::new(WaveformCache::default());
        assert!(cache.get(&path, || Err("decode failed".into())).is_err());
        let count = Arc::new(AtomicUsize::new(0));
        let threads: Vec<_> = (0..4)
            .map(|_| {
                let cache = cache.clone();
                let count = count.clone();
                let path = path.clone();
                std::thread::spawn(move || {
                    cache
                        .get(&path, || {
                            count.fetch_add(1, Ordering::SeqCst);
                            Ok(waveform())
                        })
                        .unwrap()
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        assert_eq!(count.load(Ordering::SeqCst), 1);
    }
}
