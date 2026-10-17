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

### v2.4 approved scope and completed Windows Reveal correction

- [#515](https://github.com/jl-aspect-works/jl-mixing-studio/issues/515) tracks the locked v2.4 scope: Windows Reveal (#441), Recent Revisions TOP status (#439), macOS Dante investigation (#512), conditional implementation/acceptance (#513/#514), and reviewed Dependabot changes.
- User approved starting #512 first and approved the shared native-provider design on 2026-10-17. Dependency qualification follows spike closeout, then #441/#439 and #513/#514.
- [macOS Dante discovery spike](macos-dante-discovery-spike.md): feasibility passed on Intel macOS 12.7.6 / Via 1.4.1.3. User verified audible rodio/CPAL output, Via discovery and Controller TX publication; both WebKit controls were not detected. PR #516 merged as `1fa4649`; final source head passed CI #2260 and CodeQL #54. Shared native preview/compact/comparison design is approved for #513. Receiver/isolation, full Studio playback and Apple Silicon installed acceptance remain unverified; shipping playback is unchanged.
- #512 is closed after PRs #516/#517 and passing main CI/CodeQL. PR #518 integrated the six reviewed dependency proposals from #515: serde_json 1.0.154 (#503), jsonschema 0.58.6 (#504), Tauri JS API 2.12.3 (#506), tauri-build 2.7.2 (#507), Vite React plugin 6.1.2 (#509), and clipboard JS 2.4.2 (#510). PR CI #2264 / CodeQL #58 and main CI #2265 / CodeQL #59 passed on merge `4020a3c`; installed acceptance remains required for the release candidate.
- Hold rfd #488 pending packaged-dialog qualification; rodio #505 conflicts with the approved macOS 12.7.6 support floor; TypeScript #508 has unsupported lint-tool peers; jsdom #511 needs focused accessibility regression investigation. Retain rodio 0.22.2 / CPAL 0.17.3, rfd 0.15.4, TypeScript 5.8.3 and jsdom 26.1.0.
- #441: PR #519 merged as `579eda6`, replacing the shared Windows Reveal command-line handoff with native Shell item selection while preserving containment validation and macOS `open -R`. Source CI #2270 / CodeQL #64 passed. The user verified all Windows tables with the installed test package and confirmed Reveal works on Windows and macOS. [Installed acceptance](WINDOWS_REVEAL_ACCEPTANCE.md) records the reported passes and detailed path/variant cases still to enumerate at v2.4 RC acceptance. Post-merge verification is tracked in #441.
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

- #441 Windows Reveal is fixed for v2.4 with reported Windows/macOS behavior acceptance. Published v2.3.x artifacts are unchanged; detailed release-candidate path/variant coverage remains to be recorded.
- Apple Silicon installed acceptance remains Not run, with the accepted hardware-unavailable disposition.
- Signing/notarization remains deferred: Studio [#50](https://github.com/jl-aspect-works/jl-mixing-studio/issues/50) and Automation [#112](https://github.com/jl-aspect-works/jl-mixing-automation/issues/112).
- v2.4 includes TOP status in Recent Revisions (#439). Deferred work includes user-guide/screenshot work (#362/#363), provider-specific media/cloud APIs and cascading deletion of non-empty clients.
- [Engineering #23](https://github.com/jl-aspect-works/engineering/issues/23) tracks separate residual repository-hardening work, including Plugin Suite and lightweight-workflow update maintenance. It does not reopen v2.3.3 release qualification.

## Immediate next action

After #441 closeout checks complete, proceed with #439 Recent Revisions TOP status, then the approved #513 implementation/#514 acceptance. Preserve detailed Reveal and dependency installed coverage for the next approved release candidate. No additional v2.3.3 release cycle is required.
