# JL Mixing Studio Development Status

Last updated: 2026-08-11

## Current release

- Latest stable release: `v1.1.1`
- Release status: Released and coordinated with JL Mixing Automation `v1.5.0` through Automation API `1.0`.
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Current Automation provider baseline: JL Mixing Automation `v1.5.0`

## Active development target

- Target release: `v1.1.2-rc.1`
- Studio release line: `v1.1.x`
- Scope: Windows UX patch for hidden Automation subprocess execution.
- Primary objective: verify that Studio can invoke Automation discovery and workflow commands on Windows without flashing a terminal/PowerShell-style console window.
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

## v1.1.2 RC acceptance gate

Before promoting Studio `v1.1.2` stable:

1. build and publish `v1.1.2-rc.1` installers from a green release-prep commit;
2. install the Windows x64 RC package against JL Mixing Automation `v1.5.0`;
3. confirm Studio startup/discovery does not flash a terminal window;
4. exercise representative API-backed workflows, including client/project/intake/revision/delivery operations, and confirm they do not flash a terminal window;
5. confirm those workflows still complete successfully and Studio still receives expected Automation responses;
6. confirm no macOS regression through CI and, if practical, a normal packaged macOS smoke test;
7. record any release-blocking defect before stable promotion.

The visible-window behavior cannot be proven by headless CI, so packaged Windows observation is a required acceptance step for this patch release.

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

- The Windows console-window fix requires packaged visual confirmation because CI can validate process behavior but cannot directly assert that no visible console was created.
- Legacy approval/delivery regression support remains intentionally test-only until remaining parser-era assertions have explicit structured API equivalents.
