# JL Mixing Studio Development Status

Last updated: 2026-10-20

## Current release work

- Stable baseline: Studio v2.3.3 and Automation v2.3.3; published artifacts remain unchanged.
- Target: **Studio v2.4.0-rc.1**, release preparation in [PR #533](https://github.com/jl-aspect-works/jl-mixing-studio/pull/533), branch release/2.4.0-rc.1.
- Locked scope and detailed evidence: [#515](https://github.com/jl-aspect-works/jl-mixing-studio/issues/515).
- Automation API 1.0 and workspace schema 1.1.0 remain the compatibility baseline. Studio and Automation are independently versioned.

## Implemented scope

- #512 feasibility completed in #516/#517; shared native provider design approved.
- Six compatible updates integrated in #518, merge 4020a3c; source CI passed. RC installed dependency regression remains required.
- #441 Windows Reveal completed in #519/#520 with user-reported Windows/macOS passes.
- #439 Recent Revisions TOP pill completed in #522, e97741b, with user UI approval and passing CI.
- #521 macOS complete ad-hoc signing completed in #532, e1ca0fd; Intel 12.7.6 and Apple Silicon 27.0.1 installation/signature results reported separately.
- #513 shared macOS/Windows native preview/compact/comparison implementation merged in #523 as ba86403f4652fa0d0839e1face084b0e4624aebf.
- #514 development-package evidence and explicit dispositions are recorded in [native audio acceptance](NATIVE_AUDIO_ACCEPTANCE.md). Earlier passes do not qualify the eventual RC artifacts.

## Release gates and verification

- #523 pre-merge CI #2302 and CodeQL #97 passed. Post-merge CodeQL run 39407195511 passed; CI run 39407195258 was still pending at this checkpoint.
- PR #533 synchronizes VERSION/manifests to 2.4.0-rc.1 and selects v2.4 release notes while retaining protected publication, signature validation, checksums and provenance.
- Release-branch reconciliation accidentally dropped macOS rodio playback features; dbb419f restored the same shared feature stanza as main. The superseded release-head Intel E0432 failure is explained by that removed feature. Refreshed full Required CI and CodeQL must pass.
- [RC acceptance checklist](RELEASE_ACCEPTANCE_V2.4.md): exact candidate package tests are **Not Run**, independently for Intel macOS 12.7.6, Apple Silicon macOS 27.0.1 and Windows 11.
- Candidate publication and stable promotion are separate decisions. No stable v2.4.0 approval is recorded.

## Accepted limitations and deferred work

- Intel macOS Via Stop can freeze the playhead with stale Playing UI: **Accepted Limitation**; explicit manual recovery documented in [Dante guide](NATIVE_AUDIO_DANTE.md). Do not add stall detection.
- Physical output disconnect and detailed comparison Retry retention: **Accepted as built / Not individually tested**.
- Turtle AV/Dante AVIO analog receiver, wiring and downstream Sonos: **Deferred until complete system installation**, non-blocking. Two-way MacBook/Windows laptop Dante signal, stereo identity and isolation are separate reported passes.
- Apple Silicon Via qualification is Deferred while Via unavailable; prior discovery observations remain historical.
- Codec-by-codec and other Partial/Not Run development cases retain their recorded status.
- Hold dependency proposals #488/#505/#508/#511; retain the approved rodio/CPAL stack and macOS 12.7.6 support floor.
- #363 screenshots, #362 user guide and #50 Developer ID/notarization remain deferred.
- Historical stable verification remains in [v2.3.3 acceptance](RELEASE_ACCEPTANCE_V2.3.3.md); later development does not change stable packages.

## Immediate next action

Finish main integration verification and PR #533 Required CI/CodeQL, disposition #513/#514 with their explicit exceptions, merge through normal protection, then verify post-merge checks. Dispatch the protected Release workflow from main for v2.4.0-rc.1 and verify publication/assets/provenance before asking the user to run the RC checklist. Stable release requires separate approval.
