#![cfg(test)]

use std::cell::RefCell;
use std::collections::VecDeque;
use std::io;
use std::path::{Path, PathBuf};

use crate::automation_api::{ProcessResult, ProcessRunner};

use super::delivery_management::{
    delete_delivery_package_with_runner, get_delivery_status_with_runner,
};

#[derive(Debug, PartialEq, Eq)]
struct Invocation {
    arguments: Vec<String>,
    current_directory: Option<PathBuf>,
}

struct FakeRunner {
    results: RefCell<VecDeque<io::Result<ProcessResult>>>,
    invocations: RefCell<Vec<Invocation>>,
}

impl FakeRunner {
    fn new(results: Vec<io::Result<ProcessResult>>) -> Self {
        Self {
            results: RefCell::new(results.into()),
            invocations: RefCell::new(Vec::new()),
        }
    }
}

impl ProcessRunner for FakeRunner {
    fn run(
        &self,
        _executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult> {
        self.invocations.borrow_mut().push(Invocation {
            arguments: arguments.to_vec(),
            current_directory: current_directory.map(Path::to_owned),
        });
        self.results
            .borrow_mut()
            .pop_front()
            .expect("a fake process result")
    }
}

fn installed_home() -> tempfile::TempDir {
    let home = tempfile::tempdir().unwrap();
    let bin = home.path().join(".local/bin");
    std::fs::create_dir_all(&bin).unwrap();
    std::fs::write(bin.join("jl-mixing"), "managed launcher").unwrap();
    home
}

fn success(operation: &str, data: serde_json::Value) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: true,
        exit_code: Some(0),
        stdout: serde_json::json!({
            "api_version": "1.0",
            "operation": operation,
            "status": "success",
            "data": data,
            "warnings": [],
            "errors": []
        })
        .to_string(),
        stderr: String::new(),
    })
}

fn delivery_status() -> serde_json::Value {
    serde_json::json!({
        "delivery_path": "/fixed/project/05_Final_Delivery",
        "delivery_manifest_path": "/fixed/project/05_Final_Delivery/delivery-manifest.json",
        "state": "ready",
        "revisions": {"current": 2, "approved": 2, "delivered": 2, "source": 2},
        "deliverables": [{
            "path": "Blue Sky Main Mix.wav",
            "deliverable_type": "main_mix",
            "size_bytes": 4096,
            "expected_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "actual_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "status": "current"
        }],
        "deliverable_count": 1,
        "untracked": [],
        "issues": [],
        "notes": {
            "path": "/fixed/project/05_Final_Delivery/Delivery_Notes.md",
            "present": true,
            "size_bytes": 120,
            "modified_at": "2026-08-15T21:00:00-04:00"
        },
        "packages": [{
            "name": "blue-sky-rev-02-20260815210000.zip",
            "path": "/fixed/project/05_Final_Delivery/blue-sky-rev-02-20260815210000.zip",
            "size_bytes": 8192,
            "modified_at": "2026-08-15T21:00:00-04:00",
            "status": "current",
            "issues": []
        }],
        "package_state": "current",
        "current_package": {
            "name": "blue-sky-rev-02-20260815210000.zip",
            "path": "/fixed/project/05_Final_Delivery/blue-sky-rev-02-20260815210000.zip",
            "size_bytes": 8192,
            "modified_at": "2026-08-15T21:00:00-04:00",
            "status": "current",
            "issues": []
        }
    })
}

#[test]
fn delivery_status_uses_explicit_project_api_contract() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![success("delivery.status", delivery_status())]);
    let project = Path::new("/fixed/project");

    let result = get_delivery_status_with_runner(home.path(), project, &runner);

    assert!(result.ok);
    let delivery = result.delivery.expect("managed delivery status");
    assert_eq!(delivery.state, "ready");
    assert_eq!(delivery.package_state, "current");
    assert_eq!(delivery.deliverable_count, 1);
    let invocations = runner.invocations.borrow();
    assert_eq!(invocations.len(), 1);
    assert_eq!(
        invocations[0].arguments,
        vec!["delivery", "status", "--json", "--project", "/fixed/project"]
    );
    assert_eq!(invocations[0].current_directory, Some(project.to_owned()));
}

#[test]
fn package_delete_uses_only_generated_filename_and_returns_refreshed_status() {
    let home = installed_home();
    let refreshed = delivery_status();
    let runner = FakeRunner::new(vec![success(
        "delivery.delete-package",
        serde_json::json!({
            "deleted_name": "blue-sky-rev-02-20260815210000.zip",
            "deleted_path": "/fixed/project/05_Final_Delivery/blue-sky-rev-02-20260815210000.zip",
            "delivery": refreshed
        }),
    )]);
    let project = Path::new("/fixed/project");

    let result = delete_delivery_package_with_runner(
        home.path(),
        project,
        "blue-sky-rev-02-20260815210000.zip",
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.delivery.unwrap().package_state, "current");
    let invocations = runner.invocations.borrow();
    assert_eq!(
        invocations[0].arguments,
        vec![
            "delivery",
            "delete-package",
            "--json",
            "--project",
            "/fixed/project",
            "--zip-name",
            "blue-sky-rev-02-20260815210000.zip"
        ]
    );
}

#[test]
fn package_delete_rejects_paths_before_invoking_automation() {
    let home = installed_home();
    let runner = FakeRunner::new(Vec::new());

    let result = delete_delivery_package_with_runner(
        home.path(),
        Path::new("/fixed/project"),
        "Stems/Blue Sky Main Mix.wav",
        &runner,
    );

    assert!(!result.ok);
    assert!(result.message.contains("filename, not a path"));
    assert!(runner.invocations.borrow().is_empty());
}
