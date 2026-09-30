# JL Mixing Studio 2.3.3 Candidate Acceptance

This record tracks the JL Mixing Studio 2.3.3 maintenance candidates. Studio `v2.3.3-rc.1` established the installed dependency/toolchain baseline with Automation `v2.3.2`. Studio `v2.3.3-rc.2` pairs with Automation `v2.3.3-rc.1` to qualify the completed GitHub security hardening and release-provenance work. No Automation API or workspace metadata schema change is introduced.

The prior stable qualification is recorded in [`RELEASE_ACCEPTANCE_V2.3.2.md`](RELEASE_ACCEPTANCE_V2.3.2.md). Platform results are independent; **Not run** is not a pass.

## RC1 qualified checkpoint

Studio `v2.3.3-rc.1` release preparation PR #474 merged as `640c83bf8b5da830b023992c312abc1e0e4e442a`; post-merge CI #36612887417 passed and release run #36614168635 completed successfully. The prerelease contained nonempty Windows x64, macOS Intel, and macOS Apple Silicon installers plus `SHA256SUMS.txt`.

Installed acceptance for RC1:

| ID | Test | Windows x64 | macOS Intel | macOS Apple Silicon |
| --- | --- | --- | --- | --- |
| A01 | Verify checksum; install/upgrade; launch; confirm expected Studio/Automation versions | Pass | Pass | **Not run** (not available) |
| A02 | Open existing workspace; navigate Client/Project/Revision screens; restart and confirm data remains readable | Pass | Pass | **Not run** (not available) |
| A03 | Preview audio and exercise ordinary transport/playback, revision playback, and Listening workflow | Pass | Pass | **Not run** (not available) |
| A04 | Exercise Blind Revision Comparison through ranking, completion/reveal, and saved-results reload | Pass | Pass | **Not run** (not available) |
| A05 | Exercise one representative file/workflow action and confirm Automation integration remains functional | Pass | Pass | **Not run** (not available) |
| A06 | Confirm no new visual/startup/build-toolchain regressions in normal Studio use | Pass | Pass | **Not run** (not available) |

The known Windows Reveal-action issue #441 remained nonblocking. Stable promotion was intentionally deferred while the GitHub security audit/hardening continued.

## RC2 source and package evidence

| Item | Commit / workflow / assets | State |
| --- | --- | --- |
| Studio CodeQL scanning | PR #476 merged as `90077867db6a736b2e9f43b77a45e976386ece0c`; post-merge CI and CodeQL passed | Source pass |
| Studio security policy | PR #477 merged as `1535c40cf5b737d083984d0ce80c643d5e7408a9`; post-merge CI and CodeQL passed | Source pass |
| CI change-scope hardening | Studio PR #478 merged as `af7e2dbf0ead0f52d275f85be45bd45d0293c5ab`; Automation PR #227 merged as `f873d370b4da68108560e9a5b0aa18162f447517`; post-merge checks passed | Source pass |
| Release artifact attestations | Studio PR #479 merged as `0a9ef4753b10f90e68430fa2462338f7d3debcec`; Automation PR #228 merged as `cf7005ffff1c6b6850b1d0fdb485ff47fa533b23`; post-merge checks passed | Source pass; end-to-end release verification pending |
| Listening artwork provenance documentation | Studio PR #481 merged as `583cc13e4d9622f87e42a10015bf261112f2b13e`; post-merge CI and CodeQL passed | Source pass |
| Studio `v2.3.3-rc.2` + Automation `v2.3.3-rc.1` package pair | Release-preparation PRs, post-merge CI, release workflows, tags, assets, checksums, and attestations pending | Not run |

## RC2 qualification focus

Because the changes after Studio RC1 do not intentionally alter product behavior, RC2 qualification is focused on release/security integrity rather than repeating the full installed matrix already passed by RC1.

Required RC2 checks:

| ID | Check | State / evidence |
| --- | --- | --- |
| R01 | Automation `v2.3.3-rc.1` release workflow succeeds from `main`; expected platform assets are present and nonempty | Not run |
| R02 | Verify at least one Automation release artifact using GitHub artifact attestation verification | Not run |
| R03 | Studio `v2.3.3-rc.2` release workflow succeeds from `main`; three installers plus `SHA256SUMS.txt` are present and nonempty | Not run |
| R04 | `SHA256SUMS.txt` verifies the three Studio installers | Not run |
| R05 | Verify at least one Studio release artifact using GitHub artifact attestation verification | Not run |
| R06 | Install/upgrade Studio RC2 with Automation RC1 on Windows x64 and confirm launch/version plus a brief existing-workspace sanity check | Not run |
| R07 | Install/upgrade Studio RC2 with Automation RC1 on macOS Intel and confirm launch/version plus a brief existing-workspace sanity check | Not run |
| R08 | Record Apple Silicon result or explicit **Not run** reason | Not run |

If RC2 reveals a product-behavior regression, expand acceptance as needed. Otherwise the completed RC1 A01-A06 matrix remains the behavioral qualification baseline.

## Release gates

- [ ] Automation RC1 release-preparation PR passes required Tests and ShellCheck.
- [ ] Automation RC1 release-preparation PR is approved and merged.
- [ ] Automation post-merge Tests and ShellCheck pass.
- [ ] Automation Release workflow publishes `v2.3.3-rc.1` as a prerelease.
- [ ] Automation expected release assets are present and nonempty.
- [ ] Automation artifact attestation verification succeeds.
- [ ] Studio RC2 release-preparation PR passes full Studio CI and CodeQL.
- [ ] Studio RC2 release-preparation PR is approved and merged.
- [ ] Studio post-merge CI and CodeQL pass.
- [ ] Studio Release workflow publishes `v2.3.3-rc.2` as a prerelease.
- [ ] Windows x64, macOS Intel, and macOS Apple Silicon Studio installers are present and nonempty.
- [ ] `SHA256SUMS.txt` is present and verifies the published Studio installers.
- [ ] Studio artifact attestation verification succeeds.
- [ ] Windows x64 RC2 sanity acceptance is recorded.
- [ ] macOS Intel RC2 sanity acceptance is recorded.
- [ ] Apple Silicon result or explicit **Not run** reason is recorded.
- [ ] Any blocker is resolved or explicitly deferred.
- [ ] User explicitly approves or rejects the candidate pair for final v2.3.3 stable preparation.

**Qualification decision:** Pending. RC1 remains the accepted behavioral baseline. RC2/Automation RC1 must prove the hardened release path, including artifact attestations, before final v2.3.3 stable preparation.
