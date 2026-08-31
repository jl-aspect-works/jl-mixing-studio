# JL Mixing Studio Release Checklist

`VERSION` is the single release-version source of truth. Do not hand-edit version values in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, or `src-tauri/tauri.conf.json`.

## Prepare the release

- [ ] Confirm all intended release changes are merged to `main` and no release-blocking PR remains open.
- [ ] Update `VERSION` to the intended SemVer value (for example `2.1.0-rc.3` or `2.1.0`).
- [ ] Run `npm run version:sync` and commit the generated manifest/lockfile changes with the `VERSION` change.
- [ ] Update release notes only when release content or installation guidance actually changed; do not edit them solely to change an RC number.
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
- [ ] Confirm the GitHub release is published and is marked prerelease when `VERSION` contains a prerelease suffix.

## Acceptance

For the 2.1 release, use [`RELEASE_ACCEPTANCE_V2.1.md`](RELEASE_ACCEPTANCE_V2.1.md) as the high-level packaged sanity acceptance matrix.

- [ ] Install the published package on Windows and perform the release acceptance pass.
- [ ] Install the appropriate published package on macOS and perform the release acceptance pass.
- [ ] Record release-blocking findings as issues/PRs and do not advance to the next RC or stable release until resolved or explicitly deferred.
