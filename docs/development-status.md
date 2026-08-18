# JL Mixing Studio Development Status

Last updated: 2026-08-18

## Current release

- Stable release being promoted: JL Mixing Studio `v2.0.0`
- Coordinated provider release: JL Mixing Automation `v2.0.0`
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Release coordination tracker: Studio issue #201
- Acceptance source of truth: `docs/v2.0-coordinated-acceptance.md`
- Status: **Studio RC3 accepted on macOS and Windows; stable 2.0 release approved and in final tag/package promotion**

Studio and Automation remain independently versioned products. Compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.

No additional 2.0 feature expansion is permitted in the stable release-preparation commits.

## Studio 2.0 release scope

The Daily Workflow release is complete and accepted for stable promotion.

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

Completed release work includes:

- Project Overview (#190)
- Client Files (#191)
- Audio Prep (#192)
- References (#193)
- Revisions (#189)
- Delivery (#194)
- Project Files (#195)
- Workspace configuration/health (#196)
- macOS embedded-audio-preview validation (#197)
- common validated project file service/browser (#198)
- shared workspace refresh/resilience (#199)
- shared project navigation/shell (#200)
- workspace storage summaries (#214)
- primary/secondary action hierarchy (#215)
- non-disruptive success feedback (#220)
- packaged RC acceptance fixes and workspace-configuration simplification (#233, #234, #236, #237, #238)
- Windows Revision History row-layout correction (#241)

## Automation 2.0 dependencies

All Automation capabilities required by Studio 2.0 are complete:

- #114 incremental cached intake validation
- #115 revision-description API support
- #116 Audio Prep structured validation/provenance; repair/conversion remains deferred
- #117 managed Delivery status/package reconciliation and failed-mutation safety

Automation API identity remains `1.0`; workspace metadata schema remains `1.1.0`.

## Daily Workflow product contract

After initial workspace configuration, normal work should be possible with Studio plus the DAW without requiring routine Finder, Explorer, Terminal, or PowerShell use.

Core ownership rules:

- Original Delivery is read-only in Studio.
- Audio Prep is the mutable working stage only for explicitly supported operations.
- Files is a controlled project filesystem view, not an unrestricted file manager.
- Revisions and Delivery remain purpose-built workflow surfaces.
- Automation owns workflow/metadata semantics and managed semantic mutation.
- Studio owns presentation, safe interaction, filesystem inspection, and explicitly permitted filesystem operations.
- Workspace/Automation state remains authoritative; Studio does not create a competing project-state database.

## Shared-workspace contract

Studio 2.0 treats local, NAS, and OS-mounted synchronized/cloud workspace paths as ordinary filesystems.

Implemented behavior includes targeted refresh on useful boundaries, focus/project-entry refresh, configured-path preservation during temporary unavailability, explicit retry/recovery, dirty Revision/Delivery Notes protection, visible slow-operation state, and a shared workspace storage index.

Real-time simultaneous collaborative conflict resolution remains out of scope.

## Audio preview contract

Studio 2.0 ships embedded audio preview on macOS through Tauri/WKWebView + HTML media for supported project audio. Windows preview is omitted cleanly for 2.0.

CI validates the required format matrix on Intel and Apple Silicon macOS runners. Packaged audible preview was included in the coordinated macOS acceptance pass.

## Architecture and safety invariants

- Automation API contract remains `1.0`.
- Workspace metadata schema remains `1.1.0`.
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

## Stable release gate

The accepted release basis is Studio `v2.0.0-rc.3` paired with Automation `v2.0.0-rc.1` through the capability-driven API contract.

Completed before stable promotion:

1. full Studio CI matrix passed on the RC3 preparation branch;
2. Automation 2.0 RC release gates passed;
3. packaged Studio RC3 was verified on macOS and Windows;
4. the approved Daily Workflow and practically testable coordinated acceptance matrix passed;
5. remaining fault-injection/slow-storage cases are explicitly recorded as deferred rather than implied passes;
6. no release-blocking defect remains open from final RC validation;
7. stable release notes document unsigned-install workarounds for both Studio and Automation.

Final promotion steps are limited to green stable-version/documentation preparation commits, immutable `v2.0.0` tags, successful release workflows, and release-asset/checksum verification.

## Historical acceptance

Historical release records remain authoritative for their original releases and should not be rewritten:

- `docs/v1.1-v1.4-coordinated-acceptance.md`
- `docs/v1.1.1-v1.5-coordinated-acceptance.md`
- `docs/release-candidate-acceptance.md`
