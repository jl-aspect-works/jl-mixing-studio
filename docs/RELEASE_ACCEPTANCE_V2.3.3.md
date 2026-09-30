# JL Mixing Studio 2.3.3 Candidate Acceptance

This is the installed-package acceptance record for Studio `v2.3.3-rc.1`, a dependency and build-toolchain maintenance candidate based on the qualified `v2.3.2` product behavior. It pairs with Automation `v2.3.2`. No Automation API or workspace metadata schema change is introduced.

The prior stable qualification is recorded in [`RELEASE_ACCEPTANCE_V2.3.2.md`](RELEASE_ACCEPTANCE_V2.3.2.md). Platform results are independent; **Not run** is not a pass.

## Source and package evidence

| Item | Commit / workflow / assets | State |
| --- | --- | --- |
| GitHub Actions hardening / Dependabot rollout | Studio PRs #446 and #448 merged; full applicable CI passed | Source pass |
| Routine dependency batch | Studio PR #462 merged; full CI passed | Source pass |
| Cargo lock normalization / locked resolution | Studio PR #464 merged; full CI passed | Source pass |
| Rust patch updates | Studio PR #466 merged; full CI passed | Source pass |
| jsonschema 0.58 migration | Studio PR #468 merged; full CI passed | Source pass |
| ESLint 10 migration | Studio PR #470 merged; full CI passed | Source pass |
| Vite 8 / plugin-react 6 / Vitest 5 migration | Studio PR #472 merged as `ed96d5da106216df046773faf67abc1e5361e628`; full PR and post-merge CI passed | Source pass |
| Studio `v2.3.3-rc.1` package | Release preparation PR #474 merged as `640c83bf8b5da830b023992c312abc1e0e4e442a`; post-merge CI #36612887417 passed. Release run #36614168635 completed successfully; tag `v2.3.3-rc.1` points to that commit. Prerelease contains nonempty Windows x64, macOS Intel, and macOS Apple Silicon installers plus `SHA256SUMS.txt`. | Package publication pass; installed Windows x64 and macOS Intel acceptance passed |

## Installed acceptance

| ID | Test | Windows x64 | macOS Intel | macOS Apple Silicon | Evidence / finding |
| --- | --- | --- | --- | --- | --- |
| A01 | Verify checksum; install/upgrade; launch; confirm Studio `2.3.3-rc.1` and Automation `2.3.2` | Pass | Pass | **Not run** (not available) | |
| A02 | Open an existing workspace; navigate Client/Project/Revision screens; restart and confirm existing data remains readable | Pass | Pass | **Not run** (not available) | |
| A03 | Preview audio and exercise ordinary transport/playback, revision playback, and Listening workflow | Pass | Pass | **Not run** (not available) | |
| A04 | Create or open a Blind Revision Comparison; switch candidates/regions, rank candidates, complete/reveal results, and confirm saved results reload | Pass | Pass | **Not run** (not available) | |
| A05 | Exercise one representative file/workflow action (for example Audio Prep or Delivery) and confirm Automation integration remains functional | Pass | Pass | **Not run** (not available) | |
| A06 | Confirm no new visual/startup/build-toolchain regressions are apparent in normal Studio use | Pass | Pass | **Not run** (not available) | |

Windows x64 and macOS Intel installed checks are required for this candidate. If Apple Silicon hardware is unavailable, record **Not run** and the reason. The known Windows Reveal-action issue #441 remains nonblocking unless behavior regresses beyond the existing defect.

Because `v2.3.3-rc.1` is dependency/toolchain maintenance only, the installed matrix is intentionally focused on broad application sanity rather than re-running every v2.3.2 feature-specific acceptance case. The prior v2.3.2 qualification remains the behavioral baseline for unchanged features.

## Release gates

- [x] Release-preparation PR passes full Studio CI.
- [x] Release-preparation PR is approved and merged.
- [x] Post-merge Studio `main` CI passes.
- [x] Studio Release workflow from `main` publishes `v2.3.3-rc.1` as a prerelease.
- [x] Windows x64 installer is present and nonempty.
- [x] macOS Intel installer is present and nonempty.
- [x] macOS Apple Silicon installer is present and nonempty.
- [x] `SHA256SUMS.txt` is present and verifies the published installers.
- [x] Windows x64 installed acceptance is recorded.
- [x] macOS Intel installed acceptance is recorded.
- [x] Apple Silicon result or explicit Not run reason is recorded.
- [x] Any blocker is resolved or explicitly deferred.
- [ ] User explicitly approves or rejects the candidate for stable promotion.

**Qualification decision:** Pending. Do not promote `v2.3.3-rc.1` to stable until the required installed checks are recorded and the user explicitly approves the candidate.
