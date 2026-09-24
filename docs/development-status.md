# JL Mixing Studio Development Status

Last updated: 2026-09-24

## Current release

- Development target: Studio `v2.3.1-rc.2` with Automation `v2.3.1-rc.1`
- Last qualified stable release: JL Mixing Studio `v2.2.0`; `v2.3.0` was published without packaged RC acceptance
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Status: **Studio RC2 published; RC1 matrix and RC2 focused fix verification reported; exact RC2 qualification pending**

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

The initial v2.3 polish sequence (#385, #383, #368, and #337) is complete. The v2.3 scope now also includes #366, #367, #391, #392, and #401. Per-region loudness matching (#396) remains deferred until after v2.3.

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
- #367 safe permanent project deletion was manually accepted and merged through Automation PR #201 at `a41d17666a941ab6d8af2d71cb8cf1b26549b067` and Studio PR #406 at `5f3cace2a6c2d4c4a81997b82177d7f33c064fc1`. Post-merge Automation CI run #1547 and Studio CI run #2087 passed. Deletion uses an authoritative summary and exact typed Project Name, retains external Listening copies, and is exposed on the selected-project card.
- #366 safe permanent empty-client deletion was manually accepted and merged through Automation PR #202 at `8cd98565cc83768e24bac5a1f1f02b67040203b1` and Studio PR #408 at `4a3e53801eed652819f306121dc8b64e41e68450`. Post-merge Automation CI run #1553 and Studio CI run #2091 passed. Deletion is limited to authoritatively project-free clients, summarizes remaining client content, requires the exact typed Client Name, and provides no recovery or cascading project deletion.
- #391 dialog Enter-key defaults was manually accepted and merged through PR #410 at `4bf43800e1d9140a2b01999aada9a0326173d4af`. Post-merge CI run #2096 passed after a targeted rerun of an unrelated intermittent comparison test. Enabled primary actions now respond consistently to Enter while multiline controls, disabled actions, and explicit typed-name deletion confirmations retain their intended behavior.
- #392 multiline Creative Direction persistence was manually accepted and merged through Automation PR #204 at `fe7251c0d81419af50315c4fb59d9a6e819469e6` and Studio PR #412 at `1b9d29efc21ef8152dae2b67287167032f0ffba3`. Post-merge Automation CI run #1557 passed. Studio post-merge CI run #2100 passed after a targeted rerun of the same unrelated intermittent comparison timing test seen in run #2096. Multiline UTF-8 text now crosses the Windows launcher safely and preserves LF/CRLF line breaks, while empty and single-line values retain their established behavior.
- #401 generated Client IDs was manually accepted and merged through PR #414 at `b59c0fe8670b0eda486eb42e5c5ce255fbcd0a98`; post-merge CI run #2104 passed. New Client now derives and previews a read-only filesystem-safe ID from the display name while preserving Automation’s authoritative validation and collision checks.

## Active work

- Studio #423 tracks the blind comparison defect found during candidate verification: a shorter revision ending within a selected final region could not load. PR #424 implements the approved rule (candidate audio must extend past region start, then plays and loops to its own end), passed user-reported manual verification and full PR CI #2119, and merged as `77d7a1d4feca7ddc8fb13e3c1624ab3e918a3432`; full post-merge CI #2120 passed. The user reported installed Windows and Mac verification of the fix on Studio RC2. Record exact platform details and complete issue disposition with the acceptance PR.
- Studio #419 tracks recovery after both `v2.3.0` releases were published as stable before RC acceptance. Both release pages were marked prerelease on 2026-09-24; their tags and assets remain intact. The `v2.3.0` packages are unqualified. Automation #206 fixed the Windows NAS client-deletion blocker in PR #207, merged as `1d38839b4db534478281b5c31f8d96e1865d6fd0`; post-merge Tests and ShellCheck #1565 passed. The user recorded a Windows C03 Pass on Automation/Studio RC1, without exact NAS-path evidence.
- Studio candidate PR #425 merged as `71e9c6f22ee24ae313302530deeaad10aaa2de91`; post-merge full CI #2122 passed. Release run #36064641938 succeeded from that commit with three nonempty installers, `SHA256SUMS.txt`, annotated tag, and prerelease flag verified for Studio `v2.3.1-rc.2`.
- Automation candidate PR #208 merged as `ae4c04618106d5e613a925597880c48d9b16f01d`; post-merge Tests and ShellCheck #1569 passed. Release run #35940591720 succeeded from that commit with four archives, checksums, inventories, annotated tag, and prerelease flag verified.
- Studio candidate PR #420 merged as `d0fb6990674090066f9054edcf08210ca3cd34b6`; post-merge full CI #2114 passed. Release run #35940624927 succeeded from that commit with three installers, `SHA256SUMS.txt`, annotated tag, and prerelease flag verified. The later documentation-only status PR #421 merged as `2db73ede93fa0d22b7d35d5a95505616efae83a4`; post-merge full CI #2116 passed. The Studio package is built from `d0fb699`, not the status commit.
- Studio release-preparation PR #416 merged at `f28ea5650f7d84b0de6a4606f45aefaefabe305a`; PR CI #2107 and post-merge CI #2108 passed. Status PR #417 merged at `7b02d3dbc29da8a93f518460346ed5d17abbfd10`; PR CI #2109 and post-merge CI #2110 passed.
- Automation release-preparation PR #205 merged at `8f6ef06da98e78e20dba0b8d4518eaee5b8951d5`; Tests and ShellCheck #1560 and post-merge #1561 passed.

## Remaining release work

1. Review the user-reported full Studio/Automation RC1 matrix and focused installed Studio RC2 #423 fix check, keeping each result attached to the tested build.
2. Determine and record the required Studio RC2 smoke/regression scope, exact platform/build details, and any Apple Silicon deferral before qualifying this exact pair for stable release.
3. Prepare stable `v2.3.1` only after packaged qualification and explicit approval.

## Known and deferred items

- Per-region loudness matching (#396) remains deferred until after v2.3; v2.3 retains fixed full-source gain per candidate.
- Application signing, macOS notarization, provider-specific media/cloud APIs, and cascading deletion of non-empty clients remain future work.

## Immediate next action

Review and integrate the acceptance results from `docs/419-rc1-installed-acceptance`, preserving the RC1 full matrix and RC2 focused #423 verification separately. Record exact environment evidence and decide the remaining RC2 qualification checks before any stable release. #396 remains deferred until after v2.3.
