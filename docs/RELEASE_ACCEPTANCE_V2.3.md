# JL Mixing Studio 2.3 Release Acceptance Record

This record separates completed issue-level/manual and CI evidence from acceptance of the coordinated `v2.3.1-rc.1` packages. Automation and Studio `v2.3.0` were published as stable before a candidate acceptance pass; those builds are not qualified by this record. No unrun packaged result is represented as Pass.

## Evidence available before release

| Scope | Evidence | State |
| --- | --- | --- |
| Blind Comparison #374–#380 | Sequenced merged PRs, cross-platform acceptance and NAS performance work in #380 | Complete at feature level; packaged v2.3 retest pending |
| Dashboard #385 and compact playback #383 | Approved and merged PRs #399 and #400 | Complete at feature level |
| Project Files #368, Audio Prep Reset #337 | Manually accepted and merged; coordinated Automation PR #200, Studio PRs #402/#404 | Complete at feature level |
| Project deletion #367, empty-client deletion #366 | Manually accepted; Automation PRs #201/#202 and Studio PRs #406/#408 | Complete at feature level |
| Enter defaults #391, multiline Creative Direction #392, generated Client ID #401 | Manually accepted; Studio PRs #410/#412/#414 and Automation PR #204 | Complete at feature level |
| Studio implementation baseline | `f7ac6dad646f1a61fc5d66f61c642c349df67ae5`; CI #2106 | Pass — implementation baseline |
| Automation implementation baseline | `fe7251c0d81419af50315c4fb59d9a6e819469e6`; CI #1557 | Pass — implementation baseline |
| Automation release preparation PR #205 | `08af9ed9806d70fa4bd5f83abb5ad0818a702903`; Tests and ShellCheck #1560 | Pass — merged as `8f6ef06da98e78e20dba0b8d4518eaee5b8951d5`; post-merge Tests and ShellCheck #1561 passed |
| Studio release preparation PR #416 | `63c881d3cee2ae23ce697cf235e1e5acd1d60526`; complete CI #2107 | Pass — merged as `f28ea5650f7d84b0de6a4606f45aefaefabe305a`; post-merge CI #2108 passed |
| Published `v2.3.0` builds | Automation and Studio Release workflows generated platform assets on 2026-09-23 before RC acceptance | Unqualified; existing tags retained for historical identity |
| Automation NAS client deletion #206 | PR #207 merged as `1d38839b4db534478281b5c31f8d96e1865d6fd0`; post-merge Tests and ShellCheck #1565 | Automated Pass; installed Windows NAS retest pending |

Issue-level acceptance is not a claim that an RC installer has been installed. Keep Windows and macOS results independent. **Not run** means no packaged test; **Deferred** requires a stated reason and supporting evidence; **Pass** requires an actual result on the named platform.

## Packaged acceptance

Record exact Studio/Automation tags, commit SHAs, release workflow runs, tester/date, OS versions, and local/NAS workspace paths when executed. Use a fresh install or upgrade from 2.2 as appropriate. Automation is published first, then Studio.

| ID | Test | Windows x64 | macOS Intel | macOS Apple Silicon | Evidence / finding |
| --- | --- | --- | --- | --- | --- |
| A01 | Verify both checksums, install/upgrade, launch, and exact `2.3.1-rc.1` versions | Not run | Not run | Not run | |
| A02 | Existing workspace/settings, Automation discovery/API/capabilities, navigation, restart persistence | Not run | Not run | Not run | |
| A03 | Existing ordinary preview, revision, delivery, and Listening paths | Not run | Not run | Not run | |
| B01 | Create comparison with 2+ revisions, custom-only and optional Full Song, multiple regions, waveform/transport | Not run | Not run | Not run | |
| B02 | Candidate switching, region loop/seek, A–Z and transport shortcuts, no identity leak | Not run | Not run | Not run | |
| B03 | Loudness Match on/off, fixed full-source attenuation, analysis/cache reuse, no source change | Not run | Not run | Not run | |
| B04 | Rank every candidate, ties/No Preference, incomplete-region guard, notes, reveal/results/history, TOP | Not run | Not run | Not run | |
| B05 | Local and NAS/shared comparison preparation, playback, responsiveness, and progress | Not run | Not run | Not run | |
| C01 | Audio Prep Reset progress with Automation 2.3, safe failure/rollback, prior-provider fallback | Not run | Not run | Not run | |
| C02 | Project Files rename/delete, permanent project deletion summary/exact name, Listening copies retained | Not run | Not run | Not run | |
| C03 | Empty-client-only deletion summary/exact name and nonempty-client rejection; on Windows NAS, create a client with mapped-drive/UNC or stale ownership root and verify plan and execute, plus malformed-document and unsafe-content rejection | Not run | Not run | Not run | `v2.3.0` Windows NAS report: plan blocked by ownership-root mismatch (Automation #206); RC retest pending |
| C04 | Dialog Enter defaults, multiline Creative Direction save/reload, generated Client ID/collision | Not run | Not run | Not run | |
| C05 | Compact playback controls, Dashboard empty/populated Today’s Work | Not run | Not run | Not run | |

## Release gates

- [x] Approved implementation scope merged; #396 explicitly deferred beyond 2.3.
- [x] Implementation baseline CI evidence recorded above.
- [x] Release preparation PRs pass their complete CI matrices and merge (Automation #205; Studio #416 and status #417).
- [ ] Automation `v2.3.1-rc.1` Release workflow on approved `main` succeeds; four platform packages, checksums, inventories, tag, and prerelease flag verified.
- [ ] Studio `v2.3.1-rc.1` Release workflow on approved `main` succeeds; three platform installers, `SHA256SUMS.txt`, tag, and prerelease flag verified.
- [ ] Packaged Windows and available macOS acceptance completed or explicitly deferred with evidence.
- [ ] Blockers resolved in a new candidate if necessary; stable `v2.3.1` prepared only after explicit approval of exact candidate qualification.

## Findings and disposition

| Platform | Issue | Finding | Disposition |
| --- | --- | --- | --- |
| Windows NAS | Automation #206 | Published `v2.3.0` blocks newly created empty-client deletion at plan with an ownership-root mismatch | Fixed in Automation PR #207; installed coordinated RC verification pending |
| All | Studio #419 | `v2.3.0` published without RC packaged acceptance | Recover through `v2.3.1-rc.1`; do not reinterpret the historical tags as qualified |

**Decision:** Candidate preparation only. Update this record from actual RC workflow and manual results before declaring packaged qualification complete or dispatching a stable workflow.
