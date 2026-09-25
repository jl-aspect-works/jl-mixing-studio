# JL Mixing Studio Release Checklist

`VERSION` is the single release-version source of truth. Do not hand-edit version values in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, or `src-tauri/tauri.conf.json`.

## Prepare the release

- [ ] For a new release line or patch, prepare and publish a prerelease candidate first. Do not dispatch a stable version until packaged acceptance is recorded for the exact coordinated Studio and Automation candidates.
- [ ] Confirm the intended `VERSION` has an `-rc.N` suffix for a candidate. For stable, confirm the acceptance record identifies qualified builds, platform results, blocker dispositions, and explicit approval to promote.
- [ ] Confirm all intended release changes are merged to `main` and no release-blocking PR remains open.
- [ ] Update `VERSION` to the intended SemVer value (for example `2.1.0-rc.3` or `2.1.0`).
- [ ] Run `npm run version:sync` and commit the generated manifest/lockfile changes with the `VERSION` change.
- [ ] Update release notes only when release content or installation guidance actually changed; do not edit them solely to change an RC number.
- [ ] Before a stable release, perform a final documentation-only pass: remove RC/prerelease wording from the release notes, describe completed qualification in past tense, verify installation/version examples match the stable release, and convert the release acceptance document from an active candidate-test plan into the final qualification record.
- [ ] Run `npm run version:verify`.
- [ ] Open the release-preparation PR.
- [ ] Confirm the full PR CI matrix is green before merge.
- [ ] Merge the release-preparation PR to `main`.

## Build and publish

- [ ] From GitHub Actions, run the **Release** workflow on `main`. Do not create the release tag manually.
- [ ] The workflow must read `VERSION`, build the exact dispatched `main` commit, and create `v${VERSION}` only after all platform builds succeed.
- [ ] Monitor the workflow through completion. If a job fails, inspect all failed jobs before changing code and rerun only after the complete failure set is understood.
- [ ] Confirm Windows x64 NSIS succeeds.
- [ ] Confirm macOS Intel DMG succeeds.
- [ ] Confirm macOS Apple Silicon DMG succeeds.
- [ ] Confirm `SHA256SUMS.txt` is generated and verified.
- [ ] Confirm the GitHub release is published and marked prerelease for an `-rc.N` `VERSION`. Stop if the tag, version, or prerelease flag differs from the intended dispatch.

## Acceptance

For the active 2.3.2 release, use [`RELEASE_ACCEPTANCE_V2.3.2.md`](RELEASE_ACCEPTANCE_V2.3.2.md) as the packaged acceptance matrix. Preserve [`RELEASE_ACCEPTANCE_V2.3.md`](RELEASE_ACCEPTANCE_V2.3.md) and earlier records as historical qualification evidence. Release Automation first, then Studio, and record exact tagged builds and platform results.

- [ ] Install the published package on Windows and perform the release acceptance pass.
- [ ] Install the appropriate published package on macOS and perform the release acceptance pass.
- [ ] Record release-blocking findings as issues/PRs and do not advance to the next RC or stable release until resolved or explicitly deferred.
- [ ] Before a stable dispatch, verify the exact coordinated candidate packages passed required installed-platform checks, with any deferrals and user approval recorded in the acceptance record.
