use std::path::Path;

use serde_json::json;

use crate::automation_api::{
    invoke_api, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
};
use crate::diagnostic_log;
use crate::models::{DeliveryStatusResult, ManagedDeliveryStatus};

pub fn get_delivery_status(home: &Path, project_directory: &Path) -> DeliveryStatusResult {
    let result = get_delivery_status_with_runner(home, project_directory, &SystemProcessRunner);
    log_delivery_status(project_directory, &result);
    result
}

fn log_delivery_status(project_directory: &Path, result: &DeliveryStatusResult) {
    let Some(delivery) = result.delivery.as_ref() else {
        diagnostic_log::error(
            "delivery_status_reconciliation",
            &[
                ("project_path", json!(project_directory)),
                ("ok", json!(result.ok)),
                ("message", json!(&result.message)),
            ],
        );
        return;
    };
    let issue_codes: Vec<&str> = delivery
        .issues
        .iter()
        .map(|issue| issue.code.as_str())
        .collect();
    let package_issue_codes: Vec<&str> = delivery
        .packages
        .iter()
        .flat_map(|package| package.issues.iter())
        .map(|issue| issue.code.as_str())
        .collect();
    let fields = [
        ("project_path", json!(project_directory)),
        ("state", json!(&delivery.state)),
        ("package_state", json!(&delivery.package_state)),
        ("deliverable_count", json!(delivery.deliverable_count)),
        ("untracked_count", json!(delivery.untracked.len())),
        ("issue_codes", json!(issue_codes)),
        ("package_issue_codes", json!(package_issue_codes)),
        (
            "current_package",
            json!(delivery.current_package.as_ref().map(|package| &package.name)),
        ),
    ];
    if delivery.state == "ready" && delivery.package_state == "current" {
        diagnostic_log::debug("delivery_status_reconciliation", &fields);
    } else {
        diagnostic_log::info("delivery_status_reconciliation", &fields);
    }
}

pub fn delete_delivery_package(
    home: &Path,
    project_directory: &Path,
    zip_name: &str,
) -> DeliveryStatusResult {
    delete_delivery_package_with_runner(home, project_directory, zip_name, &SystemProcessRunner)
}

pub(super) fn get_delivery_status_with_runner<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    runner: &R,
) -> DeliveryStatusResult {
    let arguments = vec![
        "delivery".to_owned(),
        "status".to_owned(),
        "--json".to_owned(),
        "--project".to_owned(),
        project_directory.to_string_lossy().into_owned(),
    ];
    match invoke_api(
        home,
        "delivery.status",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response) if response.status == ApiStatus::Success => {
            match serde_json::from_value::<ManagedDeliveryStatus>(response.data) {
                Ok(delivery) => DeliveryStatusResult {
                    ok: true,
                    message: "Delivery status reconciled successfully.".to_owned(),
                    delivery: Some(delivery),
                },
                Err(_) => failed("JL Mixing Automation returned an unverifiable delivery status."),
            }
        }
        Ok(response) => rejected(
            response
                .errors
                .first()
                .map(|error| error.message.as_str())
                .unwrap_or("JL Mixing Automation rejected the delivery status request."),
        ),
        Err(error) => api_error(error),
    }
}

pub(super) fn delete_delivery_package_with_runner<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    zip_name: &str,
    runner: &R,
) -> DeliveryStatusResult {
    let zip_name = zip_name.trim();
    if zip_name.is_empty() || zip_name.contains('/') || zip_name.contains('\\') {
        return rejected("Select a generated delivery ZIP filename, not a path.");
    }
    let arguments = vec![
        "delivery".to_owned(),
        "delete-package".to_owned(),
        "--json".to_owned(),
        "--project".to_owned(),
        project_directory.to_string_lossy().into_owned(),
        "--zip-name".to_owned(),
        zip_name.to_owned(),
    ];
    match invoke_api(
        home,
        "delivery.delete-package",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response) if response.status == ApiStatus::Success => {
            let Some(delivery_value) = response.data.get("delivery").cloned() else {
                return failed(
                    "JL Mixing Automation deleted the package, but the refreshed delivery state could not be verified.",
                );
            };
            match serde_json::from_value::<ManagedDeliveryStatus>(delivery_value) {
                Ok(delivery) => DeliveryStatusResult {
                    ok: true,
                    message: "Generated delivery package deleted successfully.".to_owned(),
                    delivery: Some(delivery),
                },
                Err(_) => failed(
                    "JL Mixing Automation deleted the package, but the refreshed delivery state could not be verified.",
                ),
            }
        }
        Ok(response) => rejected(
            response
                .errors
                .first()
                .map(|error| error.message.as_str())
                .unwrap_or("JL Mixing Automation rejected the package deletion."),
        ),
        Err(error) => api_error(error),
    }
}

fn api_error(error: ApiCallError) -> DeliveryStatusResult {
    match error {
        ApiCallError::Unavailable => {
            failed("JL Mixing Automation was not found in its default install location or on PATH.")
        }
        ApiCallError::IncompatibleVersion(version) => failed(&format!(
            "JL Mixing Automation returned API {version}; Studio requires Automation API 1.0."
        )),
        error => failed(&error.message()),
    }
}

fn rejected(message: &str) -> DeliveryStatusResult {
    DeliveryStatusResult {
        ok: false,
        message: message.to_owned(),
        delivery: None,
    }
}

fn failed(message: &str) -> DeliveryStatusResult {
    DeliveryStatusResult {
        ok: false,
        message: message.to_owned(),
        delivery: None,
    }
}
