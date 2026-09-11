# JL Mixing Studio Development Status

Last updated: 2026-09-11

## Current release

- Development target: JL Mixing Studio `v2.3.0`
- Current stable release: JL Mixing Studio `v2.2.0`
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Status: **Blind Revision Comparison implementation is in progress**

Studio and Automation remain independently versioned products. Compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.

## Studio 2.3 release scope

The current planned workstream is Blind Revision Comparison (#370), implemented one sequenced high-level issue at a time:

1. #374 — persistence model, regions, sessions, and cumulative standings;
2. #375 — setup flow, region management, and blind session shell;
3. #376 — per-region ranking interaction, ties, notes, and completion rules;
4. #377 — N-way playback coordinator, synchronized switching, and region looping;
5. #378 — loudness analysis, matching gain, and reusable cache;
6. #379 — reveal, results, TOP integration, and history actions;
7. #380 — cross-platform acceptance, NAS performance, and polish.

The locked product design is `docs/BLIND_REVISION_COMPARISON.md`. Approved comparison/reveal layout guidance is recorded in `docs/BLIND_REVISION_COMPARISON_WIREFRAMES.md` and its SVG reference.

## Completed work

- Studio and Automation `v2.2.0` stable releases were published and verified.
- #374 persistence foundation was approved and merged through PR #389 at `9b42c12ee5a0506503461b37d19016db6f0617a8`.
- Post-merge Studio CI run #1971 passed on that exact `main` commit.
- #375 setup, region management, and blind session shell was approved and merged through PR #390 at `8b175bc740747d9a6bb124f7be74d70d64bfc056`.
- Post-merge Studio CI run #1993 passed on that exact `main` commit.

## Active work

- #376 is implementing per-region unranked pools, drag/drop and accessible ranking operations, ties with competition-rank numbering, candidate notes, No Preference, and region/session completion gates.
- #377 and later issues remain blocked by the #376 implementation, CI, and approval gate.

## Remaining release work

1. Complete, validate, approve, and merge #376.
2. Implement and approve #377–#379 in locked dependency order.
3. Complete #380 cross-platform, NAS-performance, and UX acceptance.
4. Prepare and publish `v2.3.0` through the repository release workflow.

## Known and deferred items

- Completed comparison persistence remains deferred to the reveal/results workflow in #379; #376 owns in-memory ranking and completion readiness.
- Comparison playback coordination and looping behavior are owned by #377.
- Loudness analysis/matching implementation is owned by #378; #375 only captures and freezes the session setting.
- Reveal/results, cumulative TOP integration, and history actions are owned by #379.
- Application signing, macOS notarization, provider-specific media/cloud APIs, and generic project/client deletion remain future work.

## Immediate next action

Publish the focused #376 implementation PR, complete CI and review, and do not start #377 until #376 is approved and merged.
