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

## Comparison performance

At the default `info` level, `comparison_performance` events record `phase`, `operation_id`, `outcome` (started/success/error/cancelled), `elapsed_ms`, and candidate `count` where applicable. Match started and terminal events by operation ID. Phases are setup, waveform, loudness, candidate_source, audio_prepare, session_prepare, candidate_switch, results, and save_session. Timings include frontend-to-desktop command latency; session preparation includes source resolution and provider preparation. These overlapping durations should not be added together. No per-tick playback logging is emitted.

Reproduce a slow screen load or candidate switch and compare the phase durations in `studio.jsonl`. A started event without a terminal event can indicate an operation still pending or an interrupted application. Waveform requests superseded by a new selection are marked cancelled even though background decoding may finish later. Diagnostics contain no source paths, revision identities, notes, LUFS values, or raw error messages.

Comparison loading indicators display the current phase and elapsed time; indeterminate bars do not estimate completion percentages. Candidate source resolution reports completed source counts before the audio-provider preparation phase. New Comparison loading covers eligibility/regions and the initial waveform; changing the preview dropdown updates its selection immediately and displays waveform loading status. Setup, results, loudness analysis, and waveform decoding run on background workers so their loading indicators can repaint.
