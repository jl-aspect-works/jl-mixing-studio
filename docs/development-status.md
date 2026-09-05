# JL Mixing Studio Development Status

Last updated: 2026-09-04

## Current release

- Stable release being prepared: JL Mixing Studio `v2.2.0`
- Coordinated provider release: JL Mixing Automation `v2.2.0`
- Supported Automation API: `1.0`
- Supported workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Acceptance source of truth: `docs/RELEASE_ACCEPTANCE_V2.2.md`
- Status: **Studio RC1 qualified on Windows x64 and macOS Intel; stable release preparation is in progress**

Studio and Automation remain independently versioned products. Compatibility is based on Automation API version/capabilities plus supported metadata schemas, not matching product versions.

No feature expansion or application-behavior change is permitted in the stable release-preparation commits unless a release-blocking defect is discovered.

## Studio 2.2 release scope

Studio 2.2 adds:

- Delivery Notes capture during Create Delivery (#336);
- filesystem-based Revision and Delivered Listening (#356);
- independent Listening destinations, canonical naming, metadata, artwork, and continuous self-healing;
- contextual publish activity and production diagnostics;
- delivery-source provenance compatibility with Automation 2.2;
- active-project monitor performance and environment-neutral timing diagnostics (#365);
- coordinated integration and release documentation (#361, #369).

The stable release retains Automation API `1.0`, workspace metadata schema `1.1.0`, the application identifier, and compatibility with existing valid v1.1+ workspaces and Studio 2.1 settings.

## Completed qualification

- Studio `v2.2.0-rc.1` was published from commit `d17740b68dacbe8f7f9e2d8760e9563bc7902376` (#373).
- Automation `v2.2.0-rc.1` was published from commit `01df878650a4131c0305f92f037dff3713f03409`.
- Windows x64 and macOS Intel 12.7.6 packaged acceptance passed 40 tests each.
- E05 legacy-delivery-manifest testing is Deferred with completed #356 manual legacy checks and #361 integration coverage.
- macOS Apple Silicon manual testing is Deferred because suitable hardware is unavailable; required package, compile, Listening regression, and WKWebView evidence passed.
- No release-blocking finding remains open from RC1 qualification (#382).

## Active work

- Automation stable preparation PR #198 is merged; its PR and post-merge Tests/ShellCheck workflows passed.
- Studio stable preparation is updating `VERSION`, generated manifests/lockfiles, release notes, README, this status, and the final qualification record.

## Remaining release work

1. Complete Studio stable-preparation validation and PR CI.
2. Obtain approval and merge the Studio stable-preparation PR.
3. Run the Automation **Release** workflow from `main` and verify all `v2.2.0` artifacts, checksums, and release state.
4. Run the Studio **Release** workflow from `main` and verify Windows x64, macOS Intel, macOS Apple Silicon, `SHA256SUMS.txt`, and release state.
5. Perform a short installed-stable smoke test on Windows x64 and macOS Intel.

## Known and deferred items

- E05 legacy-delivery-manifest packaged testing remains Deferred for 2.2 as recorded in the acceptance document.
- macOS Apple Silicon manual acceptance remains Deferred; automated architecture gates remain required.
- Application signing, macOS notarization, provider-specific media/cloud APIs, generic project/client deletion, and additional playback controls remain future work.
- Open PR #381 is a post-2.2 Blind Revision Comparison wireframe reference and is not a release blocker; other non-release feature/design issues also remain outside stable promotion.

## Immediate next action

Finish the Studio `v2.2.0` stable-preparation PR, poll its complete CI matrix, and submit it for approval.
