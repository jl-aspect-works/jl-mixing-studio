use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{Map, Value};

const MAX_BYTES: u64 = 5 * 1024 * 1024;

fn level_rank(level: &str) -> u8 {
    match level {
        "debug" => 10,
        "info" => 20,
        "warning" => 30,
        "error" => 40,
        _ => 20,
    }
}

fn configured_rank() -> u8 {
    level_rank(
        &env::var("JL_MIXING_LOG_LEVEL")
            .unwrap_or_else(|_| "info".into())
            .trim()
            .to_ascii_lowercase(),
    )
}

pub(crate) fn log_path() -> PathBuf {
    if let Some(path) = env::var_os("JL_MIXING_LOG_DIR") {
        return PathBuf::from(path).join("studio.jsonl");
    }
    #[cfg(target_os = "windows")]
    if let Some(path) = env::var_os("LOCALAPPDATA") {
        return PathBuf::from(path)
            .join("JL Mixing Studio")
            .join("logs")
            .join("studio.jsonl");
    }
    #[cfg(target_os = "macos")]
    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home)
            .join("Library")
            .join("Logs")
            .join("JL Mixing Studio")
            .join("studio.jsonl");
    }
    let root = env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/state")))
        .unwrap_or_else(env::temp_dir);
    root.join("jl-mixing-studio")
        .join("logs")
        .join("studio.jsonl")
}

fn rotate(path: &PathBuf) {
    let Ok(metadata) = fs::metadata(path) else {
        return;
    };
    if metadata.len() < MAX_BYTES {
        return;
    }
    let rotated = path.with_extension("jsonl.1");
    let _ = fs::remove_file(&rotated);
    let _ = fs::rename(path, rotated);
}

pub(crate) fn log(level: &str, event: &str, fields: &[(&str, Value)]) {
    let normalized = level.to_ascii_lowercase();
    if level_rank(&normalized) < configured_rank() {
        return;
    }
    let path = log_path();
    let Some(parent) = path.parent() else {
        return;
    };
    if fs::create_dir_all(parent).is_err() {
        return;
    }
    rotate(&path);
    let mut record = Map::new();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default();
    record.insert("ts_unix_ms".into(), Value::from(timestamp));
    record.insert("level".into(), Value::from(normalized));
    record.insert("component".into(), Value::from("studio"));
    record.insert("event".into(), Value::from(event));
    for (key, value) in fields {
        let lowered = key.to_ascii_lowercase();
        let sensitive = [
            "password",
            "token",
            "secret",
            "credential",
            "authorization",
            "api_key",
        ]
        .iter()
        .any(|needle| lowered.contains(needle));
        record.insert(
            (*key).into(),
            if sensitive {
                Value::from("<redacted>")
            } else {
                value.clone()
            },
        );
    }
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    if let Ok(encoded) = serde_json::to_string(&Value::Object(record)) {
        let _ = writeln!(file, "{encoded}");
    }
}

pub(crate) fn debug(event: &str, fields: &[(&str, Value)]) {
    log("debug", event, fields);
}
pub(crate) fn info(event: &str, fields: &[(&str, Value)]) {
    log("info", event, fields);
}
pub(crate) fn error(event: &str, fields: &[(&str, Value)]) {
    log("error", event, fields);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_path_has_stable_file_name() {
        assert_eq!(
            log_path().file_name().and_then(|value| value.to_str()),
            Some("studio.jsonl")
        );
    }
}
