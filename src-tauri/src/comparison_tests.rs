use super::*;
use std::collections::BTreeMap;
use std::fs;
use tempfile::tempdir;

fn candidate(id: &str, number: u32, blind: &str) -> CompletedCandidate {
    CompletedCandidate {
        revision_id: id.to_owned(),
        revision_number: number,
        blind_id: blind.to_owned(),
        integrated_lufs: None,
        applied_gain_db: None,
    }
}

fn snapshot(region_id: &str, name: &str, start: f64, end: Option<f64>) -> RegionSnapshot {
    RegionSnapshot {
        region_id: region_id.to_owned(),
        name: name.to_owned(),
        start_seconds: start,
        end_seconds: end,
    }
}

fn result(region: RegionSnapshot, rows: &[&[&str]]) -> CompletedRegionResult {
    CompletedRegionResult {
        region,
        rank_rows: rows
            .iter()
            .map(|row| row.iter().map(|value| (*value).to_owned()).collect())
            .collect(),
        notes: BTreeMap::new(),
    }
}

fn session(
    id: &str,
    candidates: Vec<CompletedCandidate>,
    regions: Vec<CompletedRegionResult>,
) -> CompletedSession {
    CompletedSession {
        session_id: id.to_owned(),
        completed_at: "2026-09-05T02:00:00Z".to_owned(),
        candidates,
        regions,
        loudness_match: false,
    }
}

#[test]
fn missing_metadata_loads_default_without_creating_file() {
    let temp = tempdir().unwrap();
    let document = load(temp.path()).unwrap();
    assert_eq!(document, ComparisonDocument::default());
    assert!(!comparison_path(temp.path()).exists());
}

#[test]
fn initialize_creates_valid_project_local_metadata() {
    let temp = tempdir().unwrap();
    let document = initialize(temp.path()).unwrap();
    assert_eq!(document.schema_version, COMPARISON_SCHEMA_VERSION);
    assert_eq!(document.regions[0].region_id, FULL_SONG_REGION_ID);
    let saved = load(temp.path()).unwrap();
    assert_eq!(saved, document);
}

#[test]
fn newer_schema_fails_without_rewriting_file() {
    let temp = tempdir().unwrap();
    let path = comparison_path(temp.path());
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    let original = r#"{"schema_version":99,"regions":[],"completed_sessions":[]}"#;
    fs::write(&path, original).unwrap();

    let error = load(temp.path()).unwrap_err();
    assert!(error.contains("newer than supported"));
    assert_eq!(fs::read_to_string(path).unwrap(), original);
}

#[test]
fn custom_region_edit_does_not_change_completed_snapshot() {
    let mut document = ComparisonDocument::default();
    let region = add_custom_region(&mut document, "Verse".into(), 10.0, 20.0).unwrap();
    append_completed_session(
        &mut document,
        session(
            "session-1",
            vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
            vec![result(
                snapshot(&region.region_id, "Verse", 10.0, Some(20.0)),
                &[&["r1"], &["r2"]],
            )],
        ),
    )
    .unwrap();

    update_custom_region(
        &mut document,
        &region.region_id,
        "Verse 1".into(),
        12.0,
        24.0,
    )
    .unwrap();
    let historical = &document.completed_sessions[0].regions[0].region;
    assert_eq!(historical.name, "Verse");
    assert_eq!(historical.start_seconds, 10.0);
    assert_eq!(historical.end_seconds, Some(20.0));
}

#[test]
fn deleted_live_region_remains_in_historical_session() {
    let mut document = ComparisonDocument::default();
    let region = add_custom_region(&mut document, "Bridge".into(), 30.0, 40.0).unwrap();
    append_completed_session(
        &mut document,
        session(
            "session-1",
            vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
            vec![result(
                snapshot(&region.region_id, "Bridge", 30.0, Some(40.0)),
                &[&["r2"], &["r1"]],
            )],
        ),
    )
    .unwrap();

    assert!(delete_custom_region(&mut document, &region.region_id).unwrap());
    assert!(document
        .regions
        .iter()
        .all(|item| item.region_id != region.region_id));
    assert_eq!(
        document.completed_sessions[0].regions[0].region.region_id,
        region.region_id
    );
}

#[test]
fn competition_ranks_feed_cumulative_mean_and_revision_tiebreak() {
    let mut document = ComparisonDocument::default();
    let full = snapshot(FULL_SONG_REGION_ID, "Full Song", 0.0, None);
    append_completed_session(
        &mut document,
        session(
            "s1",
            vec![
                candidate("r1", 1, "A"),
                candidate("r2", 2, "B"),
                candidate("r3", 3, "C"),
                candidate("r4", 4, "D"),
            ],
            vec![result(full.clone(), &[&["r1"], &["r2", "r3"], &["r4"]])],
        ),
    )
    .unwrap();
    append_completed_session(
        &mut document,
        session(
            "s2",
            vec![
                candidate("r1", 1, "A"),
                candidate("r2", 2, "B"),
                candidate("r3", 3, "C"),
                candidate("r4", 4, "D"),
            ],
            vec![result(full, &[&["r4"], &["r2", "r3"], &["r1"]])],
        ),
    )
    .unwrap();

    let standings = cumulative_standings(&document, FULL_SONG_REGION_ID);
    assert_eq!(
        standings
            .iter()
            .map(|standing| standing.revision_id.as_str())
            .collect::<Vec<_>>(),
        vec!["r3", "r2", "r4", "r1"]
    );
    assert_eq!(standings[0].average_placement, 2.0);
    assert_eq!(standings[0].contributing_sessions, 2);
}

#[test]
fn deleting_session_recomputes_standings_deterministically() {
    let mut document = ComparisonDocument::default();
    let full = snapshot(FULL_SONG_REGION_ID, "Full Song", 0.0, None);
    append_completed_session(
        &mut document,
        session(
            "older",
            vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
            vec![result(full.clone(), &[&["r1"], &["r2"]])],
        ),
    )
    .unwrap();
    append_completed_session(
        &mut document,
        session(
            "newer",
            vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
            vec![result(full, &[&["r2"], &["r1"]])],
        ),
    )
    .unwrap();

    assert_eq!(
        cumulative_standings(&document, FULL_SONG_REGION_ID)[0].revision_id,
        "r2"
    );
    assert!(delete_completed_session(&mut document, "newer"));
    assert_eq!(
        cumulative_standings(&document, FULL_SONG_REGION_ID)[0].revision_id,
        "r1"
    );
}

#[test]
fn clear_history_preserves_live_regions() {
    let mut document = ComparisonDocument::default();
    let region = add_custom_region(&mut document, "Outro".into(), 50.0, 60.0).unwrap();
    append_completed_session(
        &mut document,
        session(
            "session-1",
            vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
            vec![result(
                snapshot(FULL_SONG_REGION_ID, "Full Song", 0.0, None),
                &[&["r1"], &["r2"]],
            )],
        ),
    )
    .unwrap();

    clear_ranking_history(&mut document);
    assert!(document.completed_sessions.is_empty());
    assert!(document
        .regions
        .iter()
        .any(|item| item.region_id == region.region_id));
}

#[test]
fn incomplete_rankings_are_rejected() {
    let mut document = ComparisonDocument::default();
    let invalid = session(
        "session-1",
        vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
        vec![result(
            snapshot(FULL_SONG_REGION_ID, "Full Song", 0.0, None),
            &[&["r1"]],
        )],
    );
    assert!(append_completed_session(&mut document, invalid).is_err());
    assert!(document.completed_sessions.is_empty());
}

#[test]
fn loudness_matched_session_requires_measurements_and_gain() {
    let mut document = ComparisonDocument::default();
    let mut matched = session(
        "session-1",
        vec![candidate("r1", 1, "A"), candidate("r2", 2, "B")],
        vec![result(
            snapshot(FULL_SONG_REGION_ID, "Full Song", 0.0, None),
            &[&["r1"], &["r2"]],
        )],
    );
    matched.loudness_match = true;
    assert!(append_completed_session(&mut document, matched).is_err());
}
