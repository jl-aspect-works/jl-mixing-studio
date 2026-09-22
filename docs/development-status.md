# JL Mixing Studio Development Status

Last updated: 2026-09-22

## Current release

- Development target: JL Mixing Studio `v2.3.0`
- Current stable release: JL Mixing Studio `v2.2.0`
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Status: **v2.3 implementation scope is complete; release preparation is next**

Studio and Automation remain independently versioned products. Compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.

## Studio 2.3 release scope

The Blind Revision Comparison workstream (#370) was implemented one sequenced high-level issue at a time:

1. #374 — persistence model, regions, sessions, and cumulative standings;
2. #375 — setup flow, region management, and blind session shell;
3. #376 — per-region ranking interaction, ties, notes, and completion rules;
4. #377 — N-way playback coordinator, synchronized switching, and region looping;
5. #378 — loudness analysis, matching gain, and reusable cache;
6. #379 — reveal, results, TOP integration, and history actions;
7. #380 — cross-platform acceptance, NAS performance, and polish.

All planned v2.3 polish issues are complete. Per-region loudness matching (#396) remains deferred until after v2.3.

The locked product design is `docs/BLIND_REVISION_COMPARISON.md`. Approved comparison/reveal layout guidance is recorded in `docs/BLIND_REVISION_COMPARISON_WIREFRAMES.md` and its SVG reference.

## Completed work

- Studio and Automation `v2.2.0` stable releases were published and verified.
- #374 persistence foundation was approved and merged through PR #389 at `9b42c12ee5a0506503461b37d19016db6f0617a8`.
- Post-merge Studio CI run #1971 passed on that exact `main` commit.
- #375 setup, region management, and blind session shell was approved and merged through PR #390 at `8b175bc740747d9a6bb124f7be74d70d64bfc056`.
- Post-merge Studio CI run #1993 passed on that exact `main` commit.
- #376 per-region ranking, ties, notes, and completion rules was approved and merged through PR #393 at `a3c8f3f7a7a101f1fd3588159e910047b0f86c08`.
- Post-merge Studio CI run #2010 passed on that exact `main` commit.
- #377 N-way playback coordinator, synchronized switching, and region looping was approved and merged through PR #394 at `249bf7f61d3181ba7baf096dd66c3089ae35fd15`.
- Studio PR CI run #2019 passed before merge on PR head `9a1c8dfcda7f9aa7bff21b95bf2afc0139e792af`.
- #378 loudness analysis, matching gain, and reusable derived cache was merged through PR #395 at `b762fea292f470bd59d0dca63ea9b9f1f17db7f1`.
- #379 reveal and results workflow was merged through PR #397 at `a2d2d0877af75fb572385180ce01119e7e35799b`.
- #380 cross-platform acceptance and polish was merged through PR #398 at `55fa3847eaf54de63ad628bbebda49c4895cdb6a`; post-merge CI run #2058 passed.
- #385 Dashboard Today’s Work empty-state polish was approved and merged through PR #399 at `6410a1b`.
- #383 compact play controls were approved and merged through PR #400 at `82ecb2e181c82784156754de1bc5b73f56ab2237`; post-merge CI run #2069 passed.
- #368 Project Files rename/delete actions were manually accepted and merged through PR #402 at `a97f33fdd3a860ddd16a4204aed5ed7549dd27b8`; PR CI run #2073 passed across frontend, Rust, macOS, and Windows jobs.
- #337 Audio Prep Reset progress was manually accepted and merged through Automation PR #200 at `e8fb920316ef96a9d87289de7f9098e59b9dbee9` and Studio PR #404 at `1dd66e319823b027dc94843edaa3af239ff4ae8b`. Post-merge Automation CI run #1539 and Studio CI run #2080 passed. Studio presents real count-based progress with an indeterminate compatibility fallback for older Automation installations.

## Active work

- No high-level implementation issue is active.

## Remaining release work

1. Prepare and publish `v2.3.0` through the repository release workflow.

## Known and deferred items

- Per-region loudness matching (#396) remains deferred until after v2.3; v2.3 retains fixed full-source gain per candidate.
- Application signing, macOS notarization, provider-specific media/cloud APIs, and generic project/client deletion remain future work.

## Immediate next action

Prepare the `v2.3.0` release from the approved `main` commits, with #396 remaining deferred until after v2.3.
