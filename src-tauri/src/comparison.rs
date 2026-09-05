use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const COMPARISON_SCHEMA_VERSION: u32 = 1;
pub const FULL_SONG_REGION_ID: &str = "full-song";
const COMPARISON_RELATIVE_PATH: [&str; 2] = ["00_Admin", "comparison.json"];
static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ComparisonDocument {
    pub schema_version: u32,
    pub regions: Vec<ProjectRegion>,
    pub completed_sessions: Vec<CompletedSession>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProjectRegion {
    pub region_id: String,
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: Option<f64>,
    pub built_in: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CompletedSession {
    pub session_id: String,
    pub completed_at: String,
    pub candidates: Vec<CompletedCandidate>,
    pub regions: Vec<CompletedRegionResult>,
    pub loudness_match: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CompletedCandidate {
    pub revision_id: String,
    pub revision_number: u32,
    pub blind_id: String,
    pub integrated_lufs: Option<f64>,
    pub applied_gain_db: Option<f64>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CompletedRegionResult {
    pub region: RegionSnapshot,
    pub rank_rows: Vec<Vec<String>>,
    #[serde(default)]
    pub notes: BTreeMap<String, String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RegionSnapshot {
    pub region_id: String,
    pub name: String,
    pub start_seconds: f64,
    pub end_seconds: Option<f64>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CumulativeStanding {
    pub revision_id: String,
    pub revision_number: u32,
    pub average_placement: f64,
    pub contributing_sessions: u32,
}

impl Default for ComparisonDocument {
    fn default() -> Self {
        Self {
            schema_version: COMPARISON_SCHEMA_VERSION,
            regions: vec![ProjectRegion {
                region_id: FULL_SONG_REGION_ID.to_owned(),
                name: "Full Song".to_owned(),
                start_seconds: 0.0,
                end_seconds: None,
                built_in: true,
            }],
            completed_sessions: Vec::new(),
        }
    }
}

pub fn comparison_path(project_directory: &Path) -> PathBuf {
    project_directory
        .join(COMPARISON_RELATIVE_PATH[0])
        .join(COMPARISON_RELATIVE_PATH[1])
}

pub fn load(project_directory: &Path) -> Result<ComparisonDocument, String> {
    let path = comparison_path(project_directory);
    if !path.exists() {
        return Ok(ComparisonDocument::default());
    }
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    let value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("Invalid comparison metadata in {}: {error}", path.display()))?;
    let document = migrate_to_current(value)?;
    validate(&document)?;
    Ok(document)
}

pub fn initialize(project_directory: &Path) -> Result<ComparisonDocument, String> {
    let path = comparison_path(project_directory);
    if path.exists() {
        return load(project_directory);
    }
    let document = ComparisonDocument::default();
    save(project_directory, &document)?;
    Ok(document)
}

pub fn save(project_directory: &Path, document: &ComparisonDocument) -> Result<(), String> {
    validate(document)?;
    let path = comparison_path(project_directory);
    let parent = path
        .parent()
        .ok_or_else(|| "Comparison metadata path has no parent directory".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    let json = serde_json::to_string_pretty(document)
        .map_err(|error| format!("Could not serialize comparison metadata: {error}"))?;
    replace_file_safely(&path, json.as_bytes())
}

fn migrate_to_current(value: Value) -> Result<ComparisonDocument, String> {
    let version = value
        .get("schema_version")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Comparison metadata is missing a numeric schema_version".to_owned())?;
    if version > u64::from(COMPARISON_SCHEMA_VERSION) {
        return Err(format!(
            "Comparison metadata schema {version} is newer than supported schema {COMPARISON_SCHEMA_VERSION}; no data was changed"
        ));
    }
    if version != u64::from(COMPARISON_SCHEMA_VERSION) {
        return Err(format!(
            "Comparison metadata schema {version} has no registered migration path to schema {COMPARISON_SCHEMA_VERSION}; no data was changed"
        ));
    }
    serde_json::from_value(value)
        .map_err(|error| format!("Comparison metadata does not match schema {version}: {error}"))
}

pub fn validate(document: &ComparisonDocument) -> Result<(), String> {
    if document.schema_version != COMPARISON_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported comparison schema {} (expected {})",
            document.schema_version, COMPARISON_SCHEMA_VERSION
        ));
    }
    validate_regions(&document.regions)?;
    validate_sessions(&document.completed_sessions)
}

fn validate_regions(regions: &[ProjectRegion]) -> Result<(), String> {
    let mut ids = HashSet::new();
    let mut full_song_count = 0;
    for region in regions {
        validate_region_bounds(&region.name, region.start_seconds, region.end_seconds)?;
        if region.region_id.trim().is_empty() || !ids.insert(region.region_id.as_str()) {
            return Err("Comparison region IDs must be non-empty and unique".to_owned());
        }
        if region.region_id == FULL_SONG_REGION_ID {
            full_song_count += 1;
            if !region.built_in
                || region.name != "Full Song"
                || region.start_seconds != 0.0
                || region.end_seconds.is_some()
            {
                return Err("The built-in Full Song region is immutable".to_owned());
            }
        } else if region.built_in {
            return Err("Only Full Song may be marked as a built-in region".to_owned());
        }
    }
    if full_song_count != 1 {
        return Err("Comparison metadata must contain exactly one Full Song region".to_owned());
    }
    Ok(())
}

fn validate_sessions(sessions: &[CompletedSession]) -> Result<(), String> {
    let mut session_ids = HashSet::new();
    for session in sessions {
        if session.session_id.trim().is_empty() || !session_ids.insert(session.session_id.as_str())
        {
            return Err("Completed comparison session IDs must be non-empty and unique".to_owned());
        }
        validate_session(session)?;
    }
    Ok(())
}

fn validate_session(session: &CompletedSession) -> Result<(), String> {
    if session.completed_at.trim().is_empty()
        || session.candidates.len() < 2
        || session.regions.is_empty()
    {
        return Err(
            "Completed comparison sessions require a timestamp, 2+ candidates, and 1+ regions"
                .to_owned(),
        );
    }
    let candidate_ids: HashSet<&str> = session
        .candidates
        .iter()
        .map(|candidate| candidate.revision_id.as_str())
        .collect();
    let blind_ids: HashSet<&str> = session
        .candidates
        .iter()
        .map(|candidate| candidate.blind_id.as_str())
        .collect();
    if candidate_ids.len() != session.candidates.len()
        || blind_ids.len() != session.candidates.len()
    {
        return Err(
            "Completed comparison candidates require unique revision_id and blind_id values"
                .to_owned(),
        );
    }
    if session.candidates.iter().any(|candidate| {
        candidate.revision_id.trim().is_empty()
            || candidate.blind_id.trim().is_empty()
            || (session.loudness_match
                && (candidate.integrated_lufs.is_none() || candidate.applied_gain_db.is_none()))
    }) {
        return Err("Completed comparison candidate metadata is incomplete".to_owned());
    }
    let mut region_ids = HashSet::new();
    for result in &session.regions {
        if !region_ids.insert(result.region.region_id.as_str()) {
            return Err("A completed session cannot contain the same region twice".to_owned());
        }
        validate_region_bounds(
            &result.region.name,
            result.region.start_seconds,
            result.region.end_seconds,
        )?;
        validate_rank_rows(result, &candidate_ids)?;
    }
    Ok(())
}

fn validate_region_bounds(name: &str, start: f64, end: Option<f64>) -> Result<(), String> {
    if name.trim().is_empty() || !start.is_finite() || start < 0.0 {
        return Err("Comparison regions require a name and a finite non-negative start".to_owned());
    }
    if let Some(end) = end {
        if !end.is_finite() || end <= start {
            return Err("Comparison region end must be finite and greater than start".to_owned());
        }
    }
    Ok(())
}

fn validate_rank_rows(
    result: &CompletedRegionResult,
    candidate_ids: &HashSet<&str>,
) -> Result<(), String> {
    let ranked: Vec<&str> = result
        .rank_rows
        .iter()
        .flat_map(|row| row.iter().map(String::as_str))
        .collect();
    if result.rank_rows.is_empty() || result.rank_rows.iter().any(Vec::is_empty) {
        return Err("Completed region rankings cannot contain empty rank rows".to_owned());
    }
    let unique: HashSet<&str> = ranked.iter().copied().collect();
    if ranked.len() != candidate_ids.len() || unique != *candidate_ids {
        return Err(
            "Every session candidate must be ranked exactly once in each completed region"
                .to_owned(),
        );
    }
    if result
        .notes
        .keys()
        .any(|revision_id| !candidate_ids.contains(revision_id.as_str()))
    {
        return Err(
            "Comparison notes may reference only candidates in the completed session".to_owned(),
        );
    }
    Ok(())
}

pub fn add_custom_region(
    document: &mut ComparisonDocument,
    name: String,
    start_seconds: f64,
    end_seconds: f64,
) -> Result<ProjectRegion, String> {
    validate_region_bounds(&name, start_seconds, Some(end_seconds))?;
    let region = ProjectRegion {
        region_id: new_uuid_style_id(),
        name,
        start_seconds,
        end_seconds: Some(end_seconds),
        built_in: false,
    };
    document.regions.push(region.clone());
    validate(document)?;
    Ok(region)
}

pub fn update_custom_region(
    document: &mut ComparisonDocument,
    region_id: &str,
    name: String,
    start_seconds: f64,
    end_seconds: f64,
) -> Result<(), String> {
    if region_id == FULL_SONG_REGION_ID {
        return Err("Full Song cannot be edited".to_owned());
    }
    validate_region_bounds(&name, start_seconds, Some(end_seconds))?;
    let region = document
        .regions
        .iter_mut()
        .find(|region| region.region_id == region_id)
        .ok_or_else(|| "Comparison region was not found".to_owned())?;
    region.name = name;
    region.start_seconds = start_seconds;
    region.end_seconds = Some(end_seconds);
    validate(document)
}

pub fn delete_custom_region(
    document: &mut ComparisonDocument,
    region_id: &str,
) -> Result<bool, String> {
    if region_id == FULL_SONG_REGION_ID {
        return Err("Full Song cannot be deleted".to_owned());
    }
    let before = document.regions.len();
    document
        .regions
        .retain(|region| region.region_id != region_id);
    validate(document)?;
    Ok(document.regions.len() != before)
}

pub fn append_completed_session(
    document: &mut ComparisonDocument,
    session: CompletedSession,
) -> Result<(), String> {
    validate_session(&session)?;
    document.completed_sessions.push(session);
    if let Err(error) = validate(document) {
        document.completed_sessions.pop();
        return Err(error);
    }
    Ok(())
}

pub fn delete_completed_session(document: &mut ComparisonDocument, session_id: &str) -> bool {
    let before = document.completed_sessions.len();
    document
        .completed_sessions
        .retain(|session| session.session_id != session_id);
    document.completed_sessions.len() != before
}

pub fn clear_ranking_history(document: &mut ComparisonDocument) {
    document.completed_sessions.clear();
}

pub fn cumulative_standings(
    document: &ComparisonDocument,
    region_id: &str,
) -> Vec<CumulativeStanding> {
    #[derive(Default)]
    struct Aggregate {
        revision_number: u32,
        total: u64,
        count: u32,
    }

    let mut aggregates: HashMap<String, Aggregate> = HashMap::new();
    for session in &document.completed_sessions {
        let Some(result) = session
            .regions
            .iter()
            .find(|result| result.region.region_id == region_id)
        else {
            continue;
        };
        let numbers: HashMap<&str, u32> = session
            .candidates
            .iter()
            .map(|candidate| (candidate.revision_id.as_str(), candidate.revision_number))
            .collect();
        let mut placement = 1_u64;
        for row in &result.rank_rows {
            for revision_id in row {
                let entry = aggregates.entry(revision_id.clone()).or_default();
                entry.revision_number = *numbers.get(revision_id.as_str()).unwrap_or(&0);
                entry.total += placement;
                entry.count += 1;
            }
            placement += row.len() as u64;
        }
    }

    let mut standings: Vec<CumulativeStanding> = aggregates
        .into_iter()
        .map(|(revision_id, aggregate)| CumulativeStanding {
            revision_id,
            revision_number: aggregate.revision_number,
            average_placement: aggregate.total as f64 / f64::from(aggregate.count),
            contributing_sessions: aggregate.count,
        })
        .collect();
    standings.sort_by(|left, right| {
        left.average_placement
            .total_cmp(&right.average_placement)
            .then_with(|| right.revision_number.cmp(&left.revision_number))
            .then_with(|| left.revision_id.cmp(&right.revision_id))
    });
    standings
}

pub fn new_session_id() -> String {
    new_uuid_style_id()
}

fn new_uuid_style_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = u128::from(ID_COUNTER.fetch_add(1, Ordering::Relaxed));
    let mixed = nanos ^ (counter << 64) ^ u128::from(std::process::id());
    let hex = format!("{mixed:032x}");
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

fn replace_file_safely(path: &Path, contents: &[u8]) -> Result<(), String> {
    let suffix = new_uuid_style_id();
    let temp = path.with_extension(format!("json.{suffix}.tmp"));
    let backup = path.with_extension(format!("json.{suffix}.bak"));
    fs::write(&temp, contents)
        .map_err(|error| format!("Could not write {}: {error}", temp.display()))?;

    if !path.exists() {
        return fs::rename(&temp, path)
            .map_err(|error| format!("Could not install {}: {error}", path.display()));
    }

    fs::rename(path, &backup)
        .map_err(|error| format!("Could not protect existing {}: {error}", path.display()))?;
    match fs::rename(&temp, path) {
        Ok(()) => {
            let _ = fs::remove_file(&backup);
            Ok(())
        }
        Err(error) => {
            let _ = fs::rename(&backup, path);
            let _ = fs::remove_file(&temp);
            Err(format!("Could not replace {}: {error}", path.display()))
        }
    }
}

#[cfg(test)]
#[path = "comparison_tests.rs"]
mod tests;
