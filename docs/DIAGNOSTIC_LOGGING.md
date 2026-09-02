# Diagnostic Logging

JL Mixing Studio writes structured JSON Lines diagnostics for Studio/Automation integration. Logging is best-effort and does not change Automation stdout/stderr API contracts or Studio operation results.

## Default locations

- macOS: `~/Library/Logs/JL Mixing Studio/studio.jsonl`
- Windows: `%LOCALAPPDATA%\JL Mixing Studio\logs\studio.jsonl`
- Linux: `$XDG_STATE_HOME/jl-mixing-studio/logs/studio.jsonl` or `~/.local/state/jl-mixing-studio/logs/studio.jsonl`

Set `JL_MIXING_LOG_DIR` to override the directory. Set `JL_MIXING_LOG_LEVEL=debug` to record detailed progress receipt/parsing, per-scan Listening reconciliation context, and current Delivery status; the default level is `info`. Non-current Delivery/package state and its issue codes are recorded at `info`.

## Retention

The active file rotates at 5 MB. One rotated backup is retained as `studio.jsonl.1`, bounding normal disk use to roughly 10 MB.

## Privacy and support

Logs contain operation names, executable-resolution/process timing information, status/error diagnostics, Listening project and destination identifiers, Delivery/package state and issue codes, and at debug level progress metadata and filesystem paths needed to trace source selection and reconciliation. They do not intentionally log file contents, metadata-document contents, credentials, secrets, or secret command-line values. Known sensitive field names are redacted by the logger.

For progress/integration or Listening troubleshooting, reproduce the issue once with `JL_MIXING_LOG_LEVEL=debug`, then collect `studio.jsonl` (and `studio.jsonl.1` if present) together with Automation's `automation.jsonl`.
