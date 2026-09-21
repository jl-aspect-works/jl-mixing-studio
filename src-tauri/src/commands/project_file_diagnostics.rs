use crate::diagnostic_log;
use serde_json::json;

pub(super) fn record_mutation(
    operation: &str,
    area: &str,
    relative_path: &str,
    result: &str,
    failure_stage: Option<&str>,
) {
    let target_identity = sanitized_target_identity(relative_path);
    let fields = [
        ("operation", json!(operation)),
        ("area", json!(area)),
        ("target_identity", json!(target_identity)),
        ("result", json!(result)),
        ("failure_stage", json!(failure_stage)),
    ];
    if result == "failed" {
        diagnostic_log::error("project_file_mutation", &fields);
    } else {
        diagnostic_log::info("project_file_mutation", &fields);
    }
}

fn sanitized_target_identity(relative_path: &str) -> String {
    // FNV-1a gives support logs a repeatable identity without recording a client filename or path.
    let hash = relative_path
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325_u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        });
    format!("project-file-{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_identity_is_stable_without_exposing_the_path() {
        let path = "04_Revisions/Revision_01/Client Secret Mix.wav";
        let identity = sanitized_target_identity(path);
        assert_eq!(identity, sanitized_target_identity(path));
        assert!(identity.starts_with("project-file-"));
        assert!(!identity.contains("Client"));
        assert!(!identity.contains("Revision"));
    }
}
