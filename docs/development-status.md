# JL Mixing Studio Development Status

Last updated: 2026-08-17

## Current release

- Latest stable Studio release: `v1.1.2`
- Current stable Automation baseline: JL Mixing Automation `v1.5.1`
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`

Studio and Automation remain independently versioned products. Studio compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.

## Active development target

- Target Studio release: `v2.0.0`
- Target Automation release: `v2.0.0`
- Planned first coordinated candidate: `v2.0.0-rc.1`
- Coordination tracker: Studio issue #201
- Coordinated acceptance source of truth: `docs/v2.0-coordinated-acceptance.md`
- Status: **implementation scope complete; pre-RC release acceptance/packaging preparation**

No additional 2.0 feature expansion is permitted unless a release-blocking defect requires a narrowly scoped change.

## Studio 2.0 implementation status

Approved Daily Workflow screen work is complete:

- #190 Project Overview
- #191 Client Files
- #192 Audio Prep
- #193 References
- #189 Revisions
- #194 Delivery
- #195 Project Files
- #196 Workspace configuration and health

Foundation work is complete:

- #197 macOS embedded audio-preview spike — ship on macOS; Windows preview deferred
- #198 common validated project file service/browser
- #199 shared workspace refresh and resilience
- #200 shared project navigation/shell

Final 2.0 polish is complete:

- #214 workspace storage usage in Dashboard/navigator
- #215 primary/secondary button hierarchy
- #220 non-disruptive success feedback

## Automation 2.0 dependencies

All linked Automation dependencies required by Studio 2.0 are complete:

- Automation #114 incremental cached intake validation
- Automation #115 revision-description API support
- Automation #116 Audio Prep structured validation/provenance; repair/conversion deferred beyond 2.0
- Automation #117 managed Delivery status/package reconciliation and failed-mutation safety

Automation #117 was completed through PR #122 plus final failure-safety regression PR #123.

## Daily Workflow product contract

After initial workspace configuration, normal work should be possible with Studio plus the DAW without requiring Finder, Explorer, Terminal, or PowerShell.

Global navigation:

1. Dashboard
2. Studio
3. Clients
4. Projects
5. Tasks
6. Activities
7. Settings

Project navigation:

1. Overview
2. Client Files
3. Audio Prep
4. References
5. Revisions
6. Delivery
7. Files

Core ownership rules:

- Original Delivery is read-only in Studio.
- Audio Prep is the mutable working/fixup stage for supported 2.0 operations.
- Files is a controlled project filesystem view, not an unrestricted file manager.
- Revisions and Delivery remain purpose-built workflow surfaces.
- Automation owns workflow/metadata semantics and managed semantic mutation.
- Studio owns presentation, safe interaction, filesystem inspection and explicitly permitted filesystem operations.
- Workspace/Automation state remains authoritative; Studio does not create a competing project-state database.

## Shared-workspace contract

Studio 2.0 treats local, NAS, and OS-mounted synchronized/cloud workspace paths as ordinary filesystems.

Implemented behavior includes:

- targeted refresh on useful boundaries rather than an always-on watcher;
- refresh on window focus and project/workflow entry;
- one shared workspace-refresh invalidation boundary for screen-local authoritative data;
- configured-path preservation during temporary workspace unavailability;
- no silent fallback to `~/Music/Mixes` after a configured workspace becomes unavailable;
- explicit Retry/recovery behavior;
- preservation of dirty local Revision Notes/Delivery Notes while clean documents refresh from authoritative state;
- visible busy states and duplicate-action suppression for slow storage operations;
- one background workspace storage index shared by Dashboard and navigator.

Real-time simultaneous collaborative conflict resolution remains out of scope.

## Audio preview contract

Studio 2.0 ships embedded audio preview on macOS through the existing Tauri/WKWebView + HTML media path.

- shared preview component/capability across supported project-file screens;
- one file playing at a time;
- Play/Pause, seek/progress, elapsed and total duration;
- no waveform UI;
- no proxy/transcode playback;
- Windows preview omitted cleanly for 2.0.

CI exercises the required WKWebView format matrix on Intel and Apple Silicon macOS runners. Packaged acceptance must still confirm actual audible playback with representative real project/bounce files.

## Architecture and safety invariants

- Automation API contract remains `1.0` for this release line unless explicitly changed.
- Workspace metadata schema remains `1.1.0` unless explicitly changed.
- Human CLI output is not parsed as the Automation API contract.
- No automatic retry occurs after uncertain non-idempotent mutation outcomes.
- Canonical containment/path traversal/symlink protections remain mandatory for project file access.
- Original Delivery remains immutable from Studio.
- Manifest-managed Delivery files are not blindly renamed/deleted by Studio.
- Failed managed Delivery mutations must preserve authoritative state.
- Application identifier remains unchanged for upgrade/settings compatibility.

## Explicitly deferred beyond 2.0

- Windows embedded audio preview/playback
- Audio Prep Fix/Convert, repair, normalization, or format conversion
- generic Add/Import Files in Files or Audio Prep
- Client Files import/re-import workflow
- mutation of Original Delivery
- provider-specific OneDrive/iDrive/NAS integrations
- real-time multi-machine conflict merging
- unrestricted generic filesystem browsing
- waveform editing, playlists, A/B comparison, DAW-like transport
- reference linking/sharing to external files instead of project-owned copies

## Release gate

The next development step is coordinated `v2.0.0-rc.1` preparation, not additional feature implementation.

Before an RC is accepted:

1. align Studio and Automation application versions to their respective `2.0.0-rc.1` release metadata;
2. require all existing CI/test gates to pass on the exact RC-prep commits;
3. publish new immutable RC tags rather than moving/reusing a candidate tag;
4. verify expected release packages/checksums;
5. execute `docs/v2.0-coordinated-acceptance.md` against packaged candidates;
6. track every failed or unexpectedly blocked result with a GitHub issue;
7. fix only release blockers/regressions during RC acceptance;
8. create final `v2.0.0` tags only after explicit coordinated release approval.

## Historical acceptance

Historical release records remain authoritative for their original releases and should not be rewritten:

- `docs/v1.1-v1.4-coordinated-acceptance.md`
- `docs/v1.1.1-v1.5-coordinated-acceptance.md`
- `docs/release-candidate-acceptance.md`
