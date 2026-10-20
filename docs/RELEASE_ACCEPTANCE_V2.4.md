# Studio v2.4.0-rc.1 installed acceptance

Status: **Not Run — awaiting publication and user testing of the exact RC assets**.
Release tracker: [#515](https://github.com/jl-aspect-works/jl-mixing-studio/issues/515).
Prior development results: [native audio acceptance](NATIVE_AUDIO_ACCEPTANCE.md);
these do not automatically qualify this candidate.

## Build identity and integrity

Record release URL, tag commit, asset filename, SHA-256, host OS/architecture,
Studio version, Automation version/API, Via/Controller versions, default output,
receiver endpoint and test files. Use the published architecture-specific installer.
Existing Automation stable v2.3.3 remains the compatibility baseline; record the
actual version used. No Automation release is implied.

- Verify downloaded installer against the published SHA256SUMS.txt.
- Verify provenance: `gh attestation verify <installer> --repo jl-aspect-works/jl-mixing-studio`.
- macOS after installation: `codesign --verify --deep --strict --verbose=2 "/Applications/JL Mixing Studio.app"`.
- Ad-hoc signing is intentional; Gatekeeper Open Anyway may be needed. Developer ID/notarization remains deferred (#50).
- Record actual results independently below; do not copy earlier development passes.

## Candidate matrix

| Check | Intel macOS 12.7.6 | Apple Silicon macOS 27.0.1 | Windows 11 x64 |
| --- | --- | --- | --- |
| Checksum and provenance verified | Not Run | Not Run | Not Run |
| Correct installer, upgrade/install, launch, version, relaunch | Not Run | Not Run | Not Run |
| Strict installed bundle signature | Not Run | Not Run | N/A |
| Workspace discovery, client/project load and schema validation | Not Run | Not Run | Not Run |
| Native open/save/folder dialogs; clipboard copy/paste | Not Run | Not Run | Not Run |
| Reveal selects intended file across Client Files, Audio Prep, Revisions, Delivery and Files; spaces/Unicode paths | Not Run | Not Run | Not Run |
| Recent Revisions TOP pill present when applicable, consistent style; non-TOP unchanged | Not Run | Not Run | Not Run |
| Ordinary and compact previews across app surfaces: audible, play/pause/seek/end/replay, mute/volume, file release | Not Run | Not Run | Not Run |
| Exclusive preview/comparison playback ownership | Not Run | Not Run | Not Run |
| Blind Comparison: candidate/region changes, loops, seek, shortcuts, ranking/results save/reopen | Not Run | Not Run | Not Run |
| Per-region loudness matching on candidate/region transitions | Not Run | Not Run | Not Run |
| Normal default-output playback without Via | Not Run | Not Run | Not Run |
| Via Studio source and Controller stereo transmitter; wired routing to laptop endpoint | Not Run | Deferred while Via unavailable | Not Run |
| Receiver audibility, L/R identity and unrelated-app/microphone isolation | Not Run (laptop endpoint) | Deferred while Via unavailable | Not Run (laptop endpoint) |
| Controller subscription remove/restore | Not Run | Deferred while Via unavailable | Not Run |
| Via interruption and explicit recovery without automatic replay | Accepted Limitation: Via Stop may freeze playhead/Playing; record manual recovery | Deferred while Via unavailable | Not Run |
| Sleep/wake, no automatic replay or unintended speaker output | Not Run | Not Run | Not Run |

Dependency regression coverage includes the dialogs, clipboard, schema/discovery,
frontend operation and playback/comparison rows. Exercise representative WAV/AIFF/
compressed files; record exact formats and any untested codec cases separately.
The detailed nine-format development matrix remains in NATIVE_AUDIO_ACCEPTANCE.md;
do not mark all codecs passed based on one file.

## Preserved approved dispositions

- Intel Via Stop frozen playhead/stale Playing: **Accepted Limitation**.
  Stop/close playback, restore Via/default output and routing, then explicitly restart.
  No new timeout/stall detector is required.
- Physical output unplug/replug and itemized comparison Retry state retention:
  **Accepted as built / Not individually tested** on all hosts.
- Physical Turtle AV/Dante AVIO analog receiver, wiring and downstream Sonos:
  **Deferred until complete system installation; non-blocking**.
- Apple Silicon Via checks remain **Deferred while unavailable**; earlier discovery
  observations remain historical evidence, not candidate passes.
- Other unexecuted checks remain Not Run/Partial until reported or explicitly dispositioned.
- Stable v2.4.0 requires completed candidate qualification and separate explicit user approval.

## Results and decision

User installed results: pending. Record failures against this exact candidate.
Publication is not installed acceptance. Stable promotion approval: **Not granted**.
