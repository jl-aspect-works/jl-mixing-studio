# JL Mixing Studio Development Status

Last updated: 2026-08-11

## Current release

- Latest stable release: `v1.1.0`
- Release status: Released, with post-release compatibility fixes merged on `main`
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Current coordinated Automation provider target: `v1.5.0-rc.2` / final `v1.5.0`

## Active development target

- Target release candidate: `v1.1.1-rc.1`
- Studio release line: `v1.1.x`
- Scope: **Frozen except for confirmed defects, compatibility fixes, documentation, and release preparation.**
- Primary objective: validate and publish a refreshed Studio v1.1 build that incorporates the merged Windows/Automation v1.5 compatibility fixes.
- Versioning policy: Studio and Automation retain independent product versions. Studio compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.
- Coordinated acceptance source of truth: `docs/v1.1.1-v1.5-coordinated-acceptance.md`.

## Current provider contract

Studio v1.1 supports Automation API `1.0` and consumes these workflow capabilities:

- `system.info`
- `client.create`
- `project.create`
- `intake.validate`
- `revision.create`
- `revision.approve`
- `delivery.create`

Additional provider capabilities may be advertised by Automation without requiring Studio to consume them. Studio must tolerate compatible additive provider behavior within API 1.0.

Studio creation remains a separate human-CLI-backed path in Studio v1.1 and is not part of the API-backed workflow capability set.

## Completed post-v1.1 release compatibility work

The following Windows/Automation v1.5 fixes are merged to `main`:

- PR #176 — discover native Windows Automation installations and Windows launcher extensions while preserving macOS/POSIX discovery.
- PR #178 — accept authoritative Automation v1.5 Windows `root_path` forms in Studio's bundled schema snapshot.
- PR #180 — remove obsolete Windows-only workflow blocks so capability-backed client/project/intake/revision/approval/delivery operations run on Windows.
- PR #181 — add Windows path regression coverage and remove stale hard-coded provider-version recovery guidance.
- PR #182 — refresh current Studio v1.1 documentation for Automation API 1.0, Automation v1.5 coordination, and Windows support.

These fixes preserve Automation API `1.0`, metadata schema `1.1.0`, and existing macOS behavior.

## Current cross-platform behavior

### macOS

- Automation discovery remains supported through installed/default/PATH-compatible provider locations.
- API-backed workflows remain enabled according to API/capability admission.
- Packaged Studio builds continue to support Intel and Apple Silicon artifacts through the release workflow.

### Windows

- Studio discovers the native Automation v1.5 installation beneath the user's local application-data Programs location as well as compatible PATH launchers.
- Windows `.exe`, `.cmd`, and `.bat` launcher resolution is supported where applicable.
- Valid drive-letter and UNC workspace roots are accepted by the bundled metadata schema snapshot.
- API-backed client, project, intake, revision, approval, and delivery workflows are enabled when Automation API 1.0 advertises the required capability.

## Release validation status

Before publishing Studio `v1.1.1`:

1. prepare and validate `v1.1.1-rc.1` release metadata;
2. run `npm run release:verify -- v1.1.1-rc.1` and `npm run check`;
3. require the complete GitHub CI matrix to pass;
4. build packaged macOS and Windows installers;
5. execute the coordinated acceptance matrix in `docs/v1.1.1-v1.5-coordinated-acceptance.md` against Automation v1.5 RC2;
6. fix only confirmed release defects, cutting another RC if required;
7. publish stable `v1.1.1` only after no release-blocking defects remain.

## Historical v1.1 / Automation v1.4 acceptance

The original Studio v1.1.0 release was coordinated against JL Mixing Automation v1.4.0 and Automation API 1.0. The historical acceptance record remains in `docs/v1.1-v1.4-coordinated-acceptance.md` and should not be rewritten to imply that those tests were performed against Automation v1.5.

The v1.5 coordination is a compatibility/Windows enablement validation of the same Automation API 1.0 contract, plus the Windows schema/path extensions carried under metadata schema identity 1.1.0.

## Architecture and safety invariants

- Automation owns workflow rules, filesystem mutation, provider schemas, capability names, and structured machine responses.
- Studio owns presentation, provider discovery/admission, confirmation UX, operating-system integration, and post-operation reconciliation.
- Human CLI output is not parsed as an Automation API contract.
- No automatic retry occurs after uncertain mutation outcomes.
- Destructive delivery clean-replacement remains guarded by exact deletion preview, revalidation, explicit confirmation, and authoritative post-operation checks.
- Workspace metadata remains authoritative; Studio does not create a second project-state database.

## Maintenance strategy

- `main`: source of truth for current Studio v1.1.x release preparation and approved compatibility fixes.
- `release/1.0.x`: maintenance line for explicitly approved v1.0 patch work if needed.
- All repository changes use feature/fix/documentation branches and pull requests; `main` is never modified directly.
- Release tags are created only from a reviewed, green merge commit.

## Deferred items

- Broader UI/wireframe redesign.
- Additional Automation options not already exposed by the v1.1 UI.
- New Automation API capabilities beyond the current Studio workflow set.
- DAW/template-management features.
- Signing/notarization and other distribution hardening unless separately approved.
- New search/navigation/reporting features not required for the current release line.

## Known issues and technical debt

- Legacy approval/delivery regression support remains intentionally test-only until all remaining parser-era assertions have explicit structured API equivalents.
- No known release-blocking defect is currently recorded after the merged Windows compatibility fixes; packaged v1.5 coordination remains the final release gate.
