use rodio::{Decoder, Source};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const CACHE_SCHEMA_VERSION: u32 = 1;
const CACHE_RELATIVE_PATH: [&str; 2] = ["00_Admin", "comparison-loudness-cache.json"];

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(crate) struct LoudnessAnalysisCandidate {
    pub revision_id: String,
    pub revision_number: u32,
    pub relative_path: String,
    pub integrated_lufs: f64,
    pub applied_gain_db: f64,
    pub cache_state: LoudnessCacheState,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum LoudnessCacheState {
    Analyzed,
    Reused,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
struct LoudnessCacheDocument {
    schema_version: u32,
    entries: Vec<LoudnessCacheEntry>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
struct LoudnessCacheEntry {
    revision_id: String,
    relative_path: String,
    source: SourceIdentity,
    integrated_lufs: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
struct SourceIdentity {
    size_bytes: u64,
    modified_unix_nanos: u128,
    fingerprint: String,
}

#[derive(Clone, Debug)]
pub(crate) struct LoudnessAnalysisInput {
    pub revision_id: String,
    pub revision_number: u32,
    pub relative_path: String,
    pub path: PathBuf,
}

pub(crate) fn analyze_project_candidates(
    project_directory: &Path,
    inputs: Vec<LoudnessAnalysisInput>,
) -> Result<Vec<LoudnessAnalysisCandidate>, String> {
    analyze_project_candidates_with(project_directory, inputs, analyze_integrated_loudness)
}

fn analyze_project_candidates_with(
    project_directory: &Path,
    inputs: Vec<LoudnessAnalysisInput>,
    analyzer: impl Fn(&Path) -> Result<f64, String>,
) -> Result<Vec<LoudnessAnalysisCandidate>, String> {
    if inputs.len() < 2 {
        return Err("Loudness Match requires at least two candidates".to_owned());
    }
    let mut cache = load_cache(project_directory)?;
    let mut analyzed = Vec::with_capacity(inputs.len());
    for input in inputs {
        let source = source_identity(&input.path)?;
        let cached = cache.entries.iter().find(|entry| {
            entry.revision_id == input.revision_id
                && entry.relative_path == input.relative_path
                && entry.source == source
        });
        let (integrated_lufs, cache_state) = if let Some(entry) = cached {
            (entry.integrated_lufs, LoudnessCacheState::Reused)
        } else {
            let value = analyzer(&input.path)?;
            cache.entries.retain(|entry| {
                entry.revision_id != input.revision_id || entry.relative_path != input.relative_path
            });
            cache.entries.push(LoudnessCacheEntry {
                revision_id: input.revision_id.clone(),
                relative_path: input.relative_path.clone(),
                source,
                integrated_lufs: value,
            });
            (value, LoudnessCacheState::Analyzed)
        };
        analyzed.push(LoudnessAnalysisCandidate {
            revision_id: input.revision_id,
            revision_number: input.revision_number,
            relative_path: input.relative_path,
            integrated_lufs,
            applied_gain_db: 0.0,
            cache_state,
        });
    }
    apply_attenuation_only_gains(&mut analyzed)?;
    save_cache(project_directory, &cache)?;
    Ok(analyzed)
}

fn apply_attenuation_only_gains(
    candidates: &mut [LoudnessAnalysisCandidate],
) -> Result<(), String> {
    let quietest = candidates
        .iter()
        .map(|candidate| candidate.integrated_lufs)
        .filter(|value| value.is_finite())
        .min_by(f64::total_cmp)
        .ok_or_else(|| {
            "Loudness Match could not identify a valid reference candidate".to_owned()
        })?;
    for candidate in candidates {
        candidate.applied_gain_db = (quietest - candidate.integrated_lufs).min(0.0);
    }
    Ok(())
}

fn analyze_integrated_loudness(path: &Path) -> Result<f64, String> {
    let decoder = Decoder::try_from(
        File::open(path).map_err(|error| format!("Unable to open loudness source: {error}"))?,
    )
    .map_err(|error| format!("Unable to decode loudness source: {error}"))?;
    let channels = usize::from(decoder.channels().get()).max(1);
    if channels > 2 {
        return Err("Loudness Match currently supports mono and stereo sources".to_owned());
    }
    let sample_rate = decoder.sample_rate().get();
    let mut channel_samples = vec![Vec::<f32>::new(); channels];

    for (index, sample) in decoder.enumerate() {
        channel_samples[index % channels].push(sample);
    }
    if channel_samples
        .iter()
        .all(|samples| samples.iter().all(|sample| sample.abs() <= f32::EPSILON))
    {
        return Err("The source audio is too quiet to analyze reliably".to_owned());
    }
    let channel_power = channel_samples
        .iter()
        .map(|samples| {
            let mut meter = bs1770::ChannelLoudnessMeter::new(sample_rate);
            meter.push(samples.iter().copied());
            meter.into_100ms_windows()
        })
        .collect::<Vec<_>>();
    let gated_power = if channels == 1 {
        bs1770::gated_mean(channel_power[0].as_ref())
    } else {
        let stereo_power =
            bs1770::reduce_stereo(channel_power[0].as_ref(), channel_power[1].as_ref());
        bs1770::gated_mean(stereo_power.as_ref())
    };
    Ok(round_db(f64::from(gated_power.loudness_lkfs())))
}

fn round_db(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn source_identity(path: &Path) -> Result<SourceIdentity, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Unable to inspect loudness source: {error}"))?;
    let modified = metadata
        .modified()
        .map_err(|error| format!("Unable to inspect loudness source timestamp: {error}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "Loudness source timestamp is before Unix epoch".to_owned())?;
    Ok(SourceIdentity {
        size_bytes: metadata.len(),
        modified_unix_nanos: modified.as_nanos(),
        fingerprint: sampled_fingerprint(path, metadata.len())?,
    })
}

fn sampled_fingerprint(path: &Path, size: u64) -> Result<String, String> {
    const SAMPLE_BYTES: u64 = 64 * 1024;
    let mut file = File::open(path)
        .map_err(|error| format!("Unable to fingerprint loudness source: {error}"))?;
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    let mut buffer = vec![0_u8; SAMPLE_BYTES.min(size.max(1)) as usize];
    let offsets = if size <= SAMPLE_BYTES {
        vec![0]
    } else {
        vec![
            0,
            size.saturating_sub(SAMPLE_BYTES) / 2,
            size.saturating_sub(SAMPLE_BYTES),
        ]
    };
    for offset in offsets {
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| format!("Unable to fingerprint loudness source: {error}"))?;
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("Unable to fingerprint loudness source: {error}"))?;
        for byte in &buffer[..count] {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100_0000_01b3);
        }
    }
    Ok(format!("{hash:016x}"))
}

fn cache_path(project_directory: &Path) -> PathBuf {
    project_directory
        .join(CACHE_RELATIVE_PATH[0])
        .join(CACHE_RELATIVE_PATH[1])
}

fn load_cache(project_directory: &Path) -> Result<LoudnessCacheDocument, String> {
    let path = cache_path(project_directory);
    if !path.exists() {
        return Ok(LoudnessCacheDocument {
            schema_version: CACHE_SCHEMA_VERSION,
            entries: Vec::new(),
        });
    }
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    let document: LoudnessCacheDocument = serde_json::from_str(&text)
        .map_err(|error| format!("Invalid loudness cache in {}: {error}", path.display()))?;
    if document.schema_version != CACHE_SCHEMA_VERSION {
        return Ok(LoudnessCacheDocument {
            schema_version: CACHE_SCHEMA_VERSION,
            entries: Vec::new(),
        });
    }
    Ok(document)
}

fn save_cache(project_directory: &Path, cache: &LoudnessCacheDocument) -> Result<(), String> {
    let path = cache_path(project_directory);
    let parent = path
        .parent()
        .ok_or_else(|| "Loudness cache path has no parent directory".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    let json = serde_json::to_string_pretty(cache)
        .map_err(|error| format!("Could not serialize loudness cache: {error}"))?;
    replace_file_safely(&path, json.as_bytes())
}

fn replace_file_safely(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes)
        .map_err(|error| format!("Could not write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("Could not replace {}: {error}", path.display())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    fn result(id: &str, lufs: f64) -> LoudnessAnalysisCandidate {
        LoudnessAnalysisCandidate {
            revision_id: id.to_owned(),
            revision_number: 1,
            relative_path: format!("{id}.wav"),
            integrated_lufs: lufs,
            applied_gain_db: 0.0,
            cache_state: LoudnessCacheState::Analyzed,
        }
    }

    #[test]
    fn quietest_candidate_is_reference_and_others_are_attenuated() {
        let mut candidates = vec![result("a", -12.0), result("b", -18.0), result("c", -15.5)];
        apply_attenuation_only_gains(&mut candidates).unwrap();
        assert_eq!(candidates[0].applied_gain_db, -6.0);
        assert_eq!(candidates[1].applied_gain_db, 0.0);
        assert_eq!(candidates[2].applied_gain_db, -2.5);
    }

    #[test]
    fn source_fingerprint_changes_when_bytes_change() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("source.wav");
        fs::write(&path, b"one").unwrap();
        let first = sampled_fingerprint(&path, 3).unwrap();
        fs::write(&path, b"two").unwrap();
        let second = sampled_fingerprint(&path, 3).unwrap();
        assert_ne!(first, second);
    }

    #[test]
    fn cache_reuses_unchanged_sources_and_invalidates_changed_sources() {
        let temp = tempfile::tempdir().unwrap();
        let first_path = temp.path().join("a.wav");
        let second_path = temp.path().join("b.wav");
        fs::write(&first_path, b"first").unwrap();
        fs::write(&second_path, b"second").unwrap();
        let calls = Cell::new(0);
        let inputs = || {
            vec![
                LoudnessAnalysisInput {
                    revision_id: "r1".to_owned(),
                    revision_number: 1,
                    relative_path: "a.wav".to_owned(),
                    path: first_path.clone(),
                },
                LoudnessAnalysisInput {
                    revision_id: "r2".to_owned(),
                    revision_number: 2,
                    relative_path: "b.wav".to_owned(),
                    path: second_path.clone(),
                },
            ]
        };
        let analyzer = |path: &Path| {
            calls.set(calls.get() + 1);
            Ok(if path.ends_with("a.wav") {
                -18.0
            } else {
                -15.0
            })
        };

        let first = analyze_project_candidates_with(temp.path(), inputs(), analyzer).unwrap();
        assert_eq!(calls.get(), 2);
        assert!(first
            .iter()
            .all(|candidate| candidate.cache_state == LoudnessCacheState::Analyzed));

        let second = analyze_project_candidates_with(temp.path(), inputs(), analyzer).unwrap();
        assert_eq!(calls.get(), 2);
        assert!(second
            .iter()
            .all(|candidate| candidate.cache_state == LoudnessCacheState::Reused));

        fs::write(&second_path, b"changed").unwrap();
        let third = analyze_project_candidates_with(temp.path(), inputs(), analyzer).unwrap();
        assert_eq!(calls.get(), 3);
        assert_eq!(third[0].cache_state, LoudnessCacheState::Reused);
        assert_eq!(third[1].cache_state, LoudnessCacheState::Analyzed);
    }
}
