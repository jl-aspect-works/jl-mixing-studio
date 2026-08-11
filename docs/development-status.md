# JL Mixing Studio Development Status

Last updated: 2026-08-11

## Current release

- Latest stable release: `v1.1.0`
- Release status: Released; Studio `v1.1.1-rc.1` acceptance is complete and approved for promotion.
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Coordinated Automation provider baseline: JL Mixing Automation `v1.5.0-rc.2` / final `v1.5.0`

## Active development target

- Target release: `v1.1.1`
- Studio release line: `v1.1.x`
- Scope: **Frozen except for release preparation and confirmed release-blocking defects.**
- Primary objective: promote the accepted Studio `v1.1.1-rc.1` build to stable `v1.1.1` with only release-version metadata changes.
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

## Completed post-v1.1.0 compatibility work

The following Windows/Automation v1.5 fixes are merged to `main`:

- PR #176 — native Windows Automation discovery and launcher-extension support while preserving macOS/POSIX discovery.
- PR #178 — authoritative Automation v1.5 Windows `root_path` schema support.
- PR #180 — capability-backed client/project/intake/revision/approval/delivery workflows enabled on Windows.
- PR #181 — Windows path regression coverage and removal of stale hard-coded provider-version guidance.
- PR #182 — current Studio v1.1 documentation refreshed for Automation API 1.0, Automation v1.5 coordination, and Windows support.
- PR #183 — Studio `v1.1.1-rc.1` release metadata and coordinated acceptance plan.

These changes preserve Automation API `1.0`, metadata schema `1.1.0`, and existing macOS behavior.

## Coordinated RC acceptance

Studio `v1.1.1-rc.1` was accepted against JL Mixing Automation `v1.5.0-rc.2`.

Completed release gates include:

- release-version verification and full Studio checks;
- green GitHub CI on the RC-prep commit;
- successful Studio release workflow with Intel macOS, Apple Silicon macOS, and Windows x64 artifacts plus verified checksums;
- packaged macOS acceptance including Automation API discovery and all supported API-backed workflows;
- packaged Windows x64 acceptance including native Automation discovery, Windows workspace paths, all supported API-backed workflows, and upgrade/uninstall/reinstall behavior;
- regression-invariant verification for API 1.0, schema 1.1.0, no migration, capability-based compatibility, uncertain-mutation safety, and destructive clean replacement;
- no known release-blocking defects.

Apple Silicon packages are produced by CI. Manual Apple Silicon acceptance remains unclaimed unless separately performed; this does not block the accepted release gate recorded in the coordinated acceptance matrix.

## Current cross-platform behavior

### macOS

- Automation discovery is supported through installed/default/PATH-compatible provider locations.
- API-backed workflows are enabled according to API/capability admission.
- Packaged Studio builds support Intel and Apple Silicon artifacts through the release workflow.

### Windows

- Studio discovers the native Automation v1.5 installation beneath the user's local application-data Programs location as well as compatible PATH launchers.
- Windows `.exe`, `.cmd`, and `.bat` launcher resolution is supported where applicable.
- Valid drive-letter and UNC workspace roots are accepted by the bundled metadata schema snapshot.
- API-backed client, project, intake, revision, approval, and delivery workflows are enabled when Automation API 1.0 advertises the required capability.

## Final v1.1.1 release gate

Before publishing stable `v1.1.1`:

1. set all Studio application/release metadata from `1.1.1-rc.1` to `1.1.1`;
2. regenerate `package-lock.json` without dependency changes;
3. run `npm run release:verify -- v1.1.1` and `npm run check`;
4. require the complete GitHub CI matrix to pass on the final-release prep commit;
5. merge the final-release prep PR;
6. create tag `v1.1.1` on the exact green merge commit;
7. verify the release workflow publishes the expected macOS and Windows installers plus checksums.

No additional functional or compatibility changes are permitted in the final promotion unless a release-blocking defect is discovered.

## Historical v1.1 / Automation v1.4 acceptance

The original Studio v1.1.0 release was coordinated against JL Mixing Automation v1.4.0 and Automation API 1.0. The historical acceptance record remains in `docs/v1.1-v1.4-coordinated-acceptance.md` and should not be rewritten to imply that those tests were performed against Automation v1.5.

The v1.5 coordination validates the same Automation API 1.0 contract plus native Windows support and Windows path/schema extensions carried under metadata schema identity 1.1.0.

## Architecture and safety invariants

- Automation owns workflow rules, filesystem mutation, provider schemas, capability names, and structured machine responses.
- Studio owns presentation, provider discovery/admission, confirmation UX, operating-system integration, and post-operation reconciliation.
- Human CLI output is not parsed as an Automation API contract.
- No automatic retry occurs after uncertain mutation outcomes.
- Destructive delivery clean replacement remains guarded by exact deletion preview, revalidation, explicit confirmation, and authoritative post-operation checks.
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
- No known release-blocking defects remain for Studio v1.1.1 final promotion.
