# JL Mixing 2.3.2 Candidate Acceptance

This is the active installed-package acceptance record for Studio `v2.3.2-rc.1` with Automation `v2.3.2-rc.1`. The prior stable `v2.3.1` qualification is recorded in [`RELEASE_ACCEPTANCE_V2.3.md`](RELEASE_ACCEPTANCE_V2.3.md). Mark each platform independently; **Not run** is not a pass. Record tester, date, OS version, workspace type/path, build tags and source commits, and concise evidence or issue links when results arrive.

## Source and package evidence

| Item | Commit / workflow / assets | State |
| --- | --- | --- |
| Automation #270 implementation | PR #211 merged as `b7a5310f7fb493b55b6a81482d69115e48eef6ca`; PR Tests and ShellCheck passed | Source pass |
| Studio #270 implementation | PR #430 merged as `93e38560af2d792a7f73c1ba93599bdecaa53564`; full PR CI passed | Source pass |
| Studio #396 implementation | PR #431 merged as `d32d926ac9eef0333e77c7c5e21ffce63fd984b8`; rebased head `1446978f4aa043c0a22dbbf9b200a9e719dd625a` passed full CI #2145 | Source pass |
| Automation `v2.3.2-rc.1` package | Release preparation PR #212 merged as `651cd587a410b91787b9e8665266d22c26cac6cc`; PR Tests/ShellCheck #1589 and post-merge #1590 passed. [Release run #36193607159](https://github.com/jl-aspect-works/jl-mixing-automation/actions/runs/36193607159) succeeded on that commit; `v2.3.2-rc.1` points to it. Release marked prerelease, with four nonempty archives, four `.sha256` files, and four inventories | Package publication pass; installed tests pending |
| Studio `v2.3.2-rc.1` package | Release preparation PR #432 merged as `e16eccff28e4b4656e6cb326057c246f5d7fcf37`; complete PR CI #2147 and post-merge CI #2148 passed. [Release run #36194342663](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/36194342663) succeeded on that commit; `v2.3.2-rc.1` points to it. Release marked prerelease, with nonempty Windows x64, macOS Intel, and Apple Silicon installers and `SHA256SUMS.txt` | Package publication pass; installed tests pending |

## Installed acceptance

| ID | Test | Windows x64 | macOS Intel | macOS Apple Silicon | Evidence / finding |
| --- | --- | --- | --- | --- | --- |
| A01 | Verify both checksums; install/upgrade; launch; confirm exact Studio and Automation `2.3.2-rc.1` versions | Not run | Not run | Not run | |
| A02 | Open existing workspace, discover Automation API/capabilities, navigate, restart, and confirm existing data | Not run | Not run | Not run | |
| A03 | Ordinary preview, revision, comparison, delivery, Listening, and project/client deletion smoke | Not run | Not run | Not run | |
| D01 | In Client Files, Working Audio, and Rejected Files: delete a file with summary and exact-name confirmation; cancel and wrong-name paths retain content | Not run | Not run | Not run | |
| D02 | Recursively delete a folder; inspect file/folder counts; reject protected roots, symlinks/special files, unsafe paths and dependent managed content; no unintended sibling deletion | Not run | Not run | Not run | |
| D03 | Delete imported Original Delivery content with paired Automation; confirm lineage removal, Working Audio copy retention, stale-plan rejection, and safe refresh/restart | Not run | Not run | Not run | |
| L01 | Full-source default remains unchanged with Loudness Match on/off; custom-only session and optional Full Song both play | Not run | Not run | Not run | |
| L02 | Select Each selected region; verify distinct gain when regions differ, fixed gain during playback/loop/seek and candidate switch, and cache invalidation after boundary change | Not run | Not run | Not run | |
| L03 | Confirm blind screen hides identity/measurements, completed results reveal per-region values, no source modification, and session history reload | Not run | Not run | Not run | |

Windows and macOS Intel installed checks are required for this pairing. If Apple Silicon is unavailable, record the reason and its Not run disposition. Focused 2.3.2 checks may rely on the prior 2.3.1 baseline for unaffected behavior, provided A01–A03 and D01–L03 are run on the exact new packages.

## Release gates

- [x] Automation release preparation passes Tests and ShellCheck, merges, and post-merge checks pass.
- [x] Studio release preparation passes full CI, merges, and post-merge checks pass.
- [x] Automation Release workflow from `main` publishes `v2.3.2-rc.1` as a prerelease with all archives, checksums, and inventories verified.
- [x] Studio Release workflow from `main` publishes `v2.3.2-rc.1` as a prerelease with all installers and checksum file verified.
- [ ] Windows x64 installed results recorded for the exact pair.
- [ ] macOS Intel installed results recorded for the exact pair.
- [ ] Apple Silicon result or reason for deferral recorded.
- [ ] Blockers resolved or explicitly deferred; user explicitly approves stable promotion of the exact pair.

**Qualification decision:** Pending installed acceptance. Do not dispatch stable `v2.3.2` until the results and explicit approval above are recorded.
