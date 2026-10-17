# JL Mixing Studio Development Status

Last updated: 2026-10-17

## Current release

- Current stable releases: [Studio v2.3.3](https://github.com/jl-aspect-works/jl-mixing-studio/releases/tag/v2.3.3) and [Automation v2.3.3](https://github.com/jl-aspect-works/jl-mixing-automation/releases/tag/v2.3.3), published 2026-09-30.
- Status: **Stable publication and required candidate qualification complete; release records reconciled.**
- Automation API: `1.0`; workspace metadata schema: `1.1.0`.
- Application identifier: `com.jlaudio.jlmixingstudio`.
- Studio and Automation remain independently versioned; compatibility follows API/capabilities and supported schemas.

## Completed release scope and verification

- v2.3 delivered Blind Revision Comparison, workflow/playback improvements and safe project/client management. See the [v2.3.1 acceptance record](RELEASE_ACCEPTANCE_V2.3.md).
- v2.3.2 delivered safe file/folder deletion (#270), per-region loudness matching (#396), completed-results correction (#434), and the approved per-region default with no scope selector (#436). See the [v2.3.2 acceptance record](RELEASE_ACCEPTANCE_V2.3.2.md).
- v2.3.3 delivered dependency/build-toolchain maintenance and security/release-provenance hardening without intentional product-behavior, Automation API or workspace-schema changes.
- [v2.3.3 acceptance](RELEASE_ACCEPTANCE_V2.3.3.md) records RC1 behavioral qualification and RC2 security/integrity plus installed sanity qualification. Windows x64 and macOS Intel passed. Apple Silicon installed acceptance is **Not run — hardware unavailable**; successful builds do not count as installed acceptance.
- [Engineering #12](https://github.com/jl-aspect-works/engineering/issues/12) records explicit approval of Studio `v2.3.3-rc.2` with Automation `v2.3.3-rc.1` for stable promotion.
- [Engineering #13](https://github.com/jl-aspect-works/engineering/issues/13) records stable publication: approved source tags, successful CI/release workflows, expected assets, checksum/inventory validation and independent consumer-side artifact provenance verification.
- Installed qualification applies to the exact RC packages. No separate full installed matrix for final stable packages is claimed.

## Post-release hardening

### v2.4 approved scope and active spike

- [#515](https://github.com/jl-aspect-works/jl-mixing-studio/issues/515) tracks the locked v2.4 scope: Windows Reveal (#441), Recent Revisions TOP status (#439), macOS Dante investigation (#512), conditional implementation/acceptance (#513/#514), and reviewed Dependabot changes.
- User approved starting #512 first. Dependency qualification follows the spike decision, then #441/#439 and the approved Dante implementation/acceptance.
- [macOS Dante discovery spike](macos-dante-discovery-spike.md) records source findings and options. On macOS 12.7.6 the user reports native AVAudioPlayer discovery **Pass**, with HTML media and Web Audio both **not detected** by Via. The next experiment is an isolated rodio 0.22.2 / CPAL 0.17.3 app; its host discovery and receiver acceptance remain **Not run**. Root cause is unconfirmed; no Studio playback behavior has changed.
- Automated documentation screenshots (#363) are explicitly deferred beyond v2.4; the user guide (#362) remains deferred.

### Unreleased October dependency maintenance

The user approved integrating reviewed dependency updates on 2026-10-16, with publication deferred to the next maintenance or feature release. This does not change the v2.3.3 qualification record or artifacts.

- Consolidate the Tauri API/core/build/clipboard updates, React 19.3, jsonschema 0.58.4, jest-dom 7.0.1 and Vitest 5.0.4; refresh reviewed Actions and align CodeQL init/analyze pins atomically.
- Retain jsdom 26.1 and rfd 0.15; their proposed upgrades (#489/#488) remain deferred for focused investigation/qualification.
- Full source CI and CodeQL qualify integration. Installed Windows and macOS acceptance, including macOS 12.7.6, clipboard, native dialogs, comparison/playback and schema/discovery behavior, remains required for the next approved release candidate. No installed acceptance for these new dependencies is claimed.
- [Engineering #24](https://github.com/jl-aspect-works/engineering/issues/24) tracks exact integration PRs, superseded Dependabot proposals and CI evidence. No VERSION/tag/release change is part of this work.

Engineering [#14](https://github.com/jl-aspect-works/engineering/issues/14) through [#18](https://github.com/jl-aspect-works/engineering/issues/18) are complete: create-only release guards, Automation Python CodeQL, branch protection and community/governance defaults. These later main-branch changes do not alter the published v2.3.3 artifacts.

The [governance record](https://github.com/jl-aspect-works/engineering/blob/main/docs/GITHUB_GOVERNANCE.md) distinguishes API-verified protections from owner-confirmed administrator settings. Native release immutability is enabled for future Studio/Automation releases; existing v2.3.3 releases still report `immutable: false`. Verify native immutability at the next approved release.

## Known and deferred items

- [#441](https://github.com/jl-aspect-works/jl-mixing-studio/issues/441): Windows Reveal actions remain open and explicitly nonblocking for the qualified v2.3.x releases; fix is now scoped for v2.4.
- Apple Silicon installed acceptance remains Not run, with the accepted hardware-unavailable disposition.
- Signing/notarization remains deferred: Studio [#50](https://github.com/jl-aspect-works/jl-mixing-studio/issues/50) and Automation [#112](https://github.com/jl-aspect-works/jl-mixing-automation/issues/112).
- v2.4 includes TOP status in Recent Revisions (#439). Deferred work includes user-guide/screenshot work (#362/#363), provider-specific media/cloud APIs and cascading deletion of non-empty clients.
- [Engineering #23](https://github.com/jl-aspect-works/engineering/issues/23) tracks separate residual repository-hardening work, including Plugin Suite and lightweight-workflow update maintenance. It does not reopen v2.3.3 release qualification.

## Immediate next action

Complete #512 diagnostic build validation and controlled macOS host discovery tests, then review the proposed routing approach before #513. No additional v2.3.3 build, tag, publication or acceptance cycle is required.
