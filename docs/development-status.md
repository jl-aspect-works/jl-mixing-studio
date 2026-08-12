# JL Mixing Studio Development Status

Last updated: 2026-08-11

## Current release

- Latest stable release: `v1.1.1`
- Release status: Released and coordinated with JL Mixing Automation `v1.5.0` through Automation API `1.0`.
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Current Automation provider baseline: JL Mixing Automation `v1.5.0`

## Active development target

- Target release: `v1.1.2`
- Studio release line: `v1.1.x`
- Scope: Windows UX patch for hidden Automation subprocess execution.
- Primary objective: promote the accepted `v1.1.2-rc.1` behavior to stable with release metadata only.
- Versioning policy: Studio and Automation retain independent product versions. Studio compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.

## Windows console-window fix

Issue #185 reported that Studio v1.1.1 could display a transient terminal window whenever Automation was invoked on Windows.

PR #186 fixes the shared Automation subprocess boundary by applying the Windows `CREATE_NO_WINDOW` creation flag while preserving stdout/stderr capture, exit-code handling, PATH handling, working-directory handling, and existing non-Windows behavior. The fix is merged to `main` in merge commit `7d698b85c840a059dd053d229eae34f277fa5ff4`.

Automated validation for PR #186 passed:

- Windows desktop compile check;
- Intel macOS compile check;
- Apple Silicon macOS compile check;
- frontend checks;
- Rust formatting and clippy;
- full Rust test suite.

The existing Windows-only `SystemProcessRunner` regression continues to execute a `.cmd` launcher and verify captured stdout with the no-window creation flag applied.

## v1.1.2 RC acceptance

Studio `v1.1.2-rc.1` was built and published successfully from merge commit `30d9eb4daf1f4c3790e95be659bba6ba0b5f55fb`.

Release automation produced and published:

- Windows x64 NSIS installer;
- Intel macOS DMG;
- Apple Silicon macOS DMG;
- `SHA256SUMS.txt`.

Packaged Windows acceptance against JL Mixing Automation `v1.5.0` is complete. The previously visible terminal/PowerShell-style window no longer appears during Studio Automation subprocess execution. The fix was confirmed working in the packaged Windows RC.

No release-blocking defect remains for the v1.1.2 patch objective.

## Stable v1.1.2 release gate

Before publishing stable `v1.1.2`:

1. set all Studio application/release metadata from `1.1.2-rc.1` to `1.1.2`;
2. regenerate `package-lock.json` without dependency changes;
3. run `npm run release:verify -- v1.1.2` and `npm run check`;
4. require the complete GitHub CI matrix to pass on the final-release prep commit;
5. merge the final-release prep PR;
6. create tag `v1.1.2` on the exact green merge commit;
7. verify the release workflow publishes the expected macOS and Windows installers plus checksums;
8. close issue #185 after the stable release is verified.

No additional functional or compatibility changes are permitted in the final promotion unless a release-blocking defect is discovered.

## Current provider contract

Studio v1.1 consumes Automation API `1.0` capabilities including:

- `system.info`
- `client.create`
- `project.create`
- `intake.validate`
- `revision.create`
- `revision.approve`
- `delivery.create`

Additional provider capabilities may be advertised by Automation without requiring Studio to consume them. Studio must tolerate compatible additive provider behavior within API 1.0.

## Completed v1.1.1 / Automation v1.5 compatibility work

Merged Windows/Automation v1.5 work includes:

- PR #176 — native Windows Automation discovery and launcher-extension support.
- PR #178 — Automation v1.5 Windows `root_path` schema support.
- PR #180 — capability-backed workflow support on Windows.
- PR #181 — Windows path regression coverage and version-neutral provider guidance.
- PR #182 — current documentation refresh for Automation API 1.0 and Windows support.
- PR #183 — Studio `v1.1.1-rc.1` release preparation and coordinated acceptance plan.
- PR #184 — Studio `v1.1.1` stable release preparation.
- PR #186 — suppress Automation subprocess console windows on Windows.
- PR #187 — Studio `v1.1.2-rc.1` release preparation.

The coordinated v1.1.1 / Automation v1.5 acceptance record remains in `docs/v1.1.1-v1.5-coordinated-acceptance.md`.

## Architecture and safety invariants

- Automation owns workflow rules, filesystem mutation, provider schemas, capability names, and structured machine responses.
- Studio owns presentation, provider discovery/admission, confirmation UX, operating-system integration, and post-operation reconciliation.
- Human CLI output is not parsed as an Automation API contract.
- No automatic retry occurs after uncertain mutation outcomes.
- Destructive delivery clean replacement remains guarded by preview, revalidation, explicit confirmation, and authoritative post-operation checks.
- Workspace metadata remains authoritative; Studio does not create a second project-state database.
- Application identifier `com.jlaudio.jlmixingstudio` remains unchanged for upgrade/settings compatibility.

## Historical acceptance

The original Studio v1.1.0 release was coordinated against JL Mixing Automation v1.4.0. That historical record remains in `docs/v1.1-v1.4-coordinated-acceptance.md` and must not be rewritten to imply v1.5 testing.

Studio v1.1.1 was subsequently accepted and released with Automation v1.5 cross-platform compatibility under the same Automation API `1.0` and metadata schema `1.1.0` identities.

## Known issues and technical debt

- Legacy approval/delivery regression support remains intentionally test-only until remaining parser-era assertions have explicit structured API equivalents.
