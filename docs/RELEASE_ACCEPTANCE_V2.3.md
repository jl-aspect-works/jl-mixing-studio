# JL Mixing Studio 2.3 Release Acceptance Record

This record separates completed issue-level/manual and CI evidence from acceptance of the coordinated Automation `v2.3.1-rc.1` and Studio candidate packages. Automation and Studio `v2.3.0` were published as stable before a candidate acceptance pass; those builds are not qualified by this record. No unrun packaged result is represented as Pass.

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
| Published `v2.3.0` builds | Automation and Studio Release workflows generated platform assets on 2026-09-23 before RC acceptance; both pages marked prerelease on 2026-09-24 | Unqualified; existing tags/assets retained for historical identity, not counted as accepted RC builds |
| Automation NAS client deletion #206 | PR #207 merged as `1d38839b4db534478281b5c31f8d96e1865d6fd0`; post-merge Tests and ShellCheck #1565 | Automated Pass; user-reported installed RC1 C03 Pass below |
| `v2.3.1-rc.1` preparation | Automation PR #208 merged as `ae4c04618106d5e613a925597880c48d9b16f01d` (post-merge Tests/ShellCheck #1569); Studio PR #420 merged as `d0fb6990674090066f9054edcf08210ca3cd34b6` (post-merge full CI #2114) | Pass — source and metadata preparation; artifact evidence below |
| Automation `v2.3.1-rc.1` artifacts | [Release run #35940591720](https://github.com/jl-aspect-works/jl-mixing-automation/actions/runs/35940591720) succeeded on `ae4c04618106d5e613a925597880c48d9b16f01d`; annotated tag targets that commit; GitHub release is marked prerelease; four nonempty platform archives, four `.sha256` files, and four inventories present | Pass — workflow/artifact presence; user-reported installed matrix below |
| Studio `v2.3.1-rc.1` artifacts | [Release run #35940624927](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/35940624927) succeeded on `d0fb6990674090066f9054edcf08210ca3cd34b6`; annotated tag targets that commit; GitHub release is marked prerelease; nonempty Windows x64, macOS Intel, and Apple Silicon installers plus `SHA256SUMS.txt` present | Pass — workflow/artifact presence; user-reported installed matrix below |
| Studio #423 shorter final region | PR #424 passed manual verification and PR CI #2119; merged as `77d7a1d4feca7ddc8fb13e3c1624ab3e918a3432`; post-merge CI #2120 passed | Fixed in source after Studio RC1; packaged RC2 check recorded below |
| Studio `v2.3.1-rc.2` artifacts | [Release run #36064641938](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/36064641938) succeeded on `71e9c6f22ee24ae313302530deeaad10aaa2de91`; annotated tag targets that commit; GitHub release is marked prerelease; nonempty Windows x64, macOS Intel, and Apple Silicon installers plus `SHA256SUMS.txt` present | Pass — workflow and artifact presence; focused installed check below |

Issue-level acceptance is not a claim that an RC installer has been installed. Keep Windows and macOS results independent. **Not run** means no packaged test; **Deferred** requires a stated reason and supporting evidence; **Pass** requires an actual result on the named platform.

## Packaged acceptance

The matrix below is the user-reported installed pass on **Studio `v2.3.1-rc.1`** (`d0fb6990674090066f9054edcf08210ca3cd34b6`) with **Automation `v2.3.1-rc.1`** (`ae4c04618106d5e613a925597880c48d9b16f01d`). Tester: `jlevine456`; results committed 2026-09-24 on `docs/419-rc1-installed-acceptance` (`565f15cf966492a56040e6f546db48f975f6cbd7`). Windows x64 and macOS Intel were tested independently; Apple Silicon is Not run. OS versions, workspace paths, test dates, and per-row evidence were not included in the submitted matrix. Record these details when available. RC1 does not include Studio #423, so its passes cannot establish that fix or qualify the later RC2 package.

| ID | Test | Windows x64 | macOS Intel | macOS Apple Silicon | Evidence / finding |
| --- | --- | --- | --- | --- | --- |
| A01 | Verify both checksums, install/upgrade, launch, and exact Studio/Automation `2.3.1-rc.1` versions | Pass | Pass | Not run | |
| A02 | Existing workspace/settings, Automation discovery/API/capabilities, navigation, restart persistence | Pass | Pass | Not run | |
| A03 | Existing ordinary preview, revision, delivery, and Listening paths | Pass | Pass | Not run | |
| B01 | Create comparison with 2+ revisions, custom-only and optional Full Song, multiple regions, waveform/transport | Pass | Pass | Not run | |
| B02 | Candidate switching, region loop/seek, A–Z and transport shortcuts, no identity leak | Pass | Pass | Not run | |
| B03 | Loudness Match on/off, fixed full-source attenuation, analysis/cache reuse, no source change | Pass | Pass | Not run | |
| B04 | Rank every candidate, ties/No Preference, incomplete-region guard, notes, reveal/results/history, TOP | Pass | Pass | Not run | |
| B05 | Local and NAS/shared comparison preparation, playback, responsiveness, and progress | Pass | Pass | Not run | |
| C01 | Audio Prep Reset progress with Automation 2.3, safe failure/rollback, prior-provider fallback | Pass | Pass | Not run | |
| C02 | Project Files rename/delete, permanent project deletion summary/exact name, Listening copies retained | Pass | Pass | Not run | |
| C03 | Empty-client-only deletion summary/exact name and nonempty-client rejection; on Windows NAS, create a client with mapped-drive/UNC or stale ownership root and verify plan and execute, plus malformed-document and unsafe-content rejection | Pass | Pass | Not run | User-reported RC1 pass supersedes the `v2.3.0` Windows NAS ownership-root failure (Automation #206); exact NAS path and negative-case evidence not recorded |
| C04 | Dialog Enter defaults, multiline Creative Direction save/reload, generated Client ID/collision | Pass | Pass | Not run | |
| C05 | Compact playback controls, Dashboard empty/populated Today’s Work | Pass | Pass | Not run | |

## Studio RC2 focused verification

Studio `v2.3.1-rc.2` contains #423 and was published from `71e9c6f22ee24ae313302530deeaad10aaa2de91` after full post-merge CI #2122 passed. Automation remains `v2.3.1-rc.1`. On 2026-09-24, the user reported verifying on installed Windows and macOS Intel that RC2 loads a shorter candidate for the last region when its actual end is after the region start. Exact OS versions, workspace paths, and package checksums for this focused check were not reported.

| Check | Windows x64 | macOS Intel | Evidence |
| --- | --- | --- | --- |
| #423 — candidate ends within final region but past its start | Pass — user reported | Pass — user reported | RC2 installed check, reported 2026-09-24; no per-platform environment details recorded |

The user approved a **targeted RC2 pass** for stable qualification on Windows x64 and macOS Intel, retaining the full RC1 matrix as evidence for its exact earlier package. Run the following installed checks against Studio RC2 with Automation RC1 and record results independently. For C03, the mapped-drive/UNC or stale-root and unsafe-content negatives apply to Windows NAS; perform the available client-deletion checks on macOS. The #423 positive case above is already reported Pass. The following targeted checks were reported Pass on installed Studio RC2 with Automation RC1 by `jlevine456` in commit `8ad08dcc2baa955bd4d51c7b65a8b2731de23126` on 2026-09-24. Windows x64 and macOS Intel results were recorded independently:

| ID | Required RC2 check | Windows x64 | macOS Intel |
| --- | --- | --- | --- |
| A01 | Checksum, install/launch, and exact Studio RC2 / Automation RC1 versions | Pass | Pass |
| A02 | Existing workspace/settings, Automation discovery and restart | Pass | Pass |
| A03 | Ordinary preview, revision, delivery, and Listening smoke | Pass | Pass |
| B01 | Comparison setup with custom and optional Full Song regions | Pass | Pass |
| B02 | Candidate switching, seek, loop, shortcuts, blind identity, and unequal-length region | Pass | Pass |
| B05 | Local and NAS/shared comparison preparation, playback, responsiveness, and progress | Pass | Pass |
| C03 | Empty-client deletion and safety checks, including Windows NAS ownership-root case | Pass | Pass |

The committed RC2 matrix records B02 Pass independently of the earlier focused #423 result. Exact OS versions, workspace paths, per-row evidence, and the reason Apple Silicon was not tested are still missing from this record. Full RC2 matrix repetition is not required under the approved targeted plan. Stable qualification of the exact candidate pair requires review of this evidence and explicit approval.

RC2 info/evidence:

*OS Version: Win 11 Pro, macos 12.7.6
*Workspace path tested: \\nas-lev-02\media\Mixes-Test\Mixes-Test-2.1\Mixes\Clients\Test Client 2.3\Projects\Test Project 2.3
*Apple Silicon based machine not available for testing yet

## Release gates

- [x] Approved implementation scope merged; #396 explicitly deferred beyond 2.3.
- [x] Implementation baseline CI evidence recorded above.
- [x] Release preparation PRs pass their complete CI matrices and merge (Automation #205; Studio #416 and status #417).
- [x] Both historical `v2.3.0` release pages marked prerelease with tags/assets preserved; coordinated `v2.3.1-rc.1` preparation PRs #208/#420 merged and post-merge CI passed.
- [x] Automation `v2.3.1-rc.1` Release workflow on approved `main` succeeded; four platform packages, checksums, inventories, tag, and prerelease flag verified (run #35940591720).
- [x] Studio `v2.3.1-rc.1` Release workflow on approved candidate `main` commit succeeded; three platform installers, `SHA256SUMS.txt`, tag, and prerelease flag verified (run #35940624927). The later status-only merge `2db73ed` is not the packaged build.
- [x] Studio RC1 packaged Windows x64 and macOS Intel matrix results recorded; Apple Silicon Not run. RC1 remains unqualified because #423 required a new candidate.
- [x] Studio `v2.3.1-rc.2` Release workflow succeeded with prerelease tag and three installers; user reported focused #423 installed verification on Windows and Mac.
- [x] Targeted Studio RC2 installed acceptance scope approved; full RC1 matrix retained for that earlier candidate.
- [x] Targeted Studio RC2 checks A01–A03, B01–B02, B05, and C03 reported Pass on Windows x64 and macOS Intel in commit `8ad08dc`.
- [x] Record exact OS versions, workspace paths, per-row evidence for the Windows NAS deletion negatives, and the Apple Silicon Not run/deferral reason.
- [x] Review and explicitly approve qualification of Studio `v2.3.1-rc.2` with Automation `v2.3.1-rc.1` before preparing stable `v2.3.1`.

## Findings and disposition

| Platform | Issue | Finding | Disposition |
| --- | --- | --- | --- |
| Windows NAS | Automation #206 | Published `v2.3.0` blocks newly created empty-client deletion at plan with an ownership-root mismatch | Fixed in Automation PR #207; RC1 C03 recorded Pass on Windows, with exact NAS path and negative-case evidence still to record |
| Windows and Mac | Studio #423 | Studio RC1 rejects a shorter candidate whose audio ends within the custom final region | Fixed in PR #424; focused installed RC2 check reported Pass on Windows and Mac; exact test environments not recorded |
| All | Studio #419 | `v2.3.0` published without RC packaged acceptance | Both pages marked prerelease; recover through `v2.3.1-rc.1` without treating historical builds as qualified |

**Decision:** Studio RC1 and Automation RC1 full matrix passes are preserved for the earlier package. The installed Studio RC2 #423 fix and all approved targeted RC2 checks are reported Pass on Windows x64 and macOS Intel with Automation RC1. Exact platform/workspace details and negative-case evidence are not yet recorded, and explicit stable qualification has not been approved. Do not dispatch a stable workflow yet.
