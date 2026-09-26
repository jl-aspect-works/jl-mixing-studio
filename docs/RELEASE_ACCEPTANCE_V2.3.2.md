# JL Mixing 2.3.2 Candidate Acceptance

This is the active installed-package acceptance record for Studio `v2.3.2-rc.2` with Automation `v2.3.2-rc.1`. The prior stable `v2.3.1` qualification is recorded in [`RELEASE_ACCEPTANCE_V2.3.md`](RELEASE_ACCEPTANCE_V2.3.md). Studio RC1 findings remain below as historical evidence. Mark each platform independently; **Not run** is not a pass. Record tester, date, OS version, workspace type/path, build tags and source commits, and concise evidence or issue links when results arrive.

## Source and package evidence

| Item | Commit / workflow / assets | State |
| --- | --- | --- |
| Automation #270 implementation | PR #211 merged as `b7a5310f7fb493b55b6a81482d69115e48eef6ca`; PR Tests and ShellCheck passed | Source pass |
| Studio #270 implementation | PR #430 merged as `93e38560af2d792a7f73c1ba93599bdecaa53564`; full PR CI passed | Source pass |
| Studio #396 implementation | PR #431 merged as `d32d926ac9eef0333e77c7c5e21ffce63fd984b8`; rebased head `1446978f4aa043c0a22dbbf9b200a9e719dd625a` passed full CI #2145 | Source pass |
| Automation `v2.3.2-rc.1` package | Release preparation PR #212 merged as `651cd587a410b91787b9e8665266d22c26cac6cc`; PR Tests/ShellCheck #1589 and post-merge #1590 passed. [Release run #36193607159](https://github.com/jl-aspect-works/jl-mixing-automation/actions/runs/36193607159) succeeded on that commit; `v2.3.2-rc.1` points to it. Release marked prerelease, with four nonempty archives, four `.sha256` files, and four inventories | Package publication pass; installed Windows x64 and macOS Intel with RC2 pair passed |
| Studio `v2.3.2-rc.1` package | Release preparation PR #432 merged as `e16eccff28e4b4656e6cb326057c246f5d7fcf37`; complete PR CI #2147 and post-merge CI #2148 passed. [Release run #36194342663](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/36194342663) succeeded on that commit; `v2.3.2-rc.1` points to it. Release marked prerelease, with nonempty Windows x64, macOS Intel, and Apple Silicon installers and `SHA256SUMS.txt` | Package publication pass; superseded by Studio RC2 for installed acceptance |
| Studio #434 / #436 correction | PR #435 merged as `6c8df821e849409e43a60146a2c97fcdc5e41639`; full PR CI #2152 passed; user confirmed save fix in macOS dev mode and approved PR | Source pass; installed RC2 retest passed on Windows x64 and macOS Intel |
| Studio `v2.3.2-rc.2` package | Release preparation PR #438 merged as `20957627712da9d1775bb21ce5578e939141a94f`; full PR CI #2154 and post-merge CI #2155 passed. [Release run #36244504126](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/36244504126) passed on that commit; tag `v2.3.2-rc.2` points to it. [Prerelease](https://github.com/jl-aspect-works/jl-mixing-studio/releases/tag/v2.3.2-rc.2) contains nonempty Windows x64, macOS Intel, and Apple Silicon installers and `SHA256SUMS.txt`; checksum entries match the published asset SHA-256 digests | Package publication pass; installed Windows x64 and macOS Intel tests passed |

## Installed acceptance

| ID | Test | Windows x64 | macOS Intel | macOS Apple Silicon | Evidence / finding |
| --- | --- | --- | --- | --- | --- |
| A01 | Verify both checksums; install/upgrade; launch; confirm Studio `2.3.2-rc.2` and Automation `2.3.2-rc.1` versions | Pass | Pass | Not run | |
| A02 | Open existing workspace, discover Automation API/capabilities, navigate, restart, and confirm existing data | Pass | Pass | Not run | |
| A03 | Ordinary preview, revision, comparison, delivery, Listening, and project/client deletion smoke | Pass | Pass | Not run | Windows Reveal actions in Client Files, Audio Prep, Revisions, Delivery, and Files do not work; user classified as nonblocking; tracked in [#441](https://github.com/jl-aspect-works/jl-mixing-studio/issues/441). |
| D01 | In Client Files, Working Audio, and Rejected Files: delete a file with summary and exact-name confirmation; cancel and wrong-name paths retain content | Pass | Pass | Not run | |
| D02 | Recursively delete a folder; inspect file/folder counts; reject protected roots, symlinks/special files, unsafe paths and dependent managed content; no unintended sibling deletion | Pass | Pass | Not run | |
| D03 | Delete imported Original Delivery content with paired Automation; confirm lineage removal, Working Audio copy retention, stale-plan rejection, and safe refresh/restart | Pass | Pass | Not run | |
| L01 | Per-region matching defaults on, with no scope selector; Loudness Match off works; custom-only session and optional Full Song both play | Pass | Pass | Not run | RC2 default verified on both required platforms. |
| L02 | With per-region matching on, verify distinct gain when regions differ, fixed gain during playback/loop/seek and candidate switch, and cache invalidation after boundary change | Pass | Pass | Not run | |
| L03 | Confirm blind screen hides identity/measurements, completed results reveal per-region values, no source modification, and session history reload | Pass | Pass | Not run | RC2 passes on both required platforms; RC1 Windows failure tracked in #434 and resolved by #435. |

Windows and macOS Intel installed checks are required for this pairing. If Apple Silicon is unavailable, record the reason and its Not run disposition. Focused 2.3.2 checks may rely on the prior 2.3.1 baseline for unaffected behavior, provided A01–A03 and D01–L03 are run on the exact new packages.

Apple Silicon: Not run because Apple Silicon hardware was unavailable for testing. The user committed Windows and macOS Intel results to `release/232-rc2` in `f4588206f7822821e6950edace4e111e0aa8772f` on 2026-09-26. OS versions and workspace paths were not included in that record.

## Release gates

- [x] Automation release preparation passes Tests and ShellCheck, merges, and post-merge checks pass.
- [x] Studio release preparation passes full CI, merges, and post-merge checks pass.
- [x] Automation Release workflow from `main` publishes `v2.3.2-rc.1` as a prerelease with all archives, checksums, and inventories verified.
- [x] Studio Release workflow from `main` publishes `v2.3.2-rc.1` as a prerelease with all installers and checksum file verified.
- [x] Studio RC2 release preparation passes full CI, merges, and post-merge checks pass.
- [x] Studio Release workflow from `main` publishes `v2.3.2-rc.2` as a prerelease with all installers and checksum file verified.
- [x] Windows x64 installed results recorded for the exact pair.
- [x] macOS Intel installed results recorded for the exact pair.
- [x] Apple Silicon result or reason for deferral recorded.
- [ ] Blockers resolved or explicitly deferred; user explicitly approves stable promotion of the exact pair.

**Qualification decision:** The required installed checks for Studio `v2.3.2-rc.2` with Automation `v2.3.2-rc.1` passed on Windows x64 and macOS Intel. RC1 Windows L03 failed on #434; RC2 L03 passed after #435. Apple Silicon is unavailable, so its checks remain Not run. Windows Reveal actions (#441) were classified by the user as nonblocking for this release. Explicit user approval to promote this exact pair to stable remains pending; do not dispatch stable until that approval is recorded.
