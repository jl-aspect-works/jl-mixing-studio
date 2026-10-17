# Windows Reveal acceptance — issue #441

Target: v2.4. User-reported Windows and macOS Reveal behavior passed on 2026-10-17. PR #519 merged as `579eda630cc6542908f0b6d666dee42a22d33e68`; source head `8422624a7725e604d786cc23a0e06af6ecb43ec0` passed CI #2270 and CodeQL #64. Post-merge check results are tracked in #441.

## Build and implementation

The focused PR's CI provides Windows x64 NSIS and macOS Intel DMG development packages, with a `BUILD.txt` identifying the tested commit. These are development test builds using the current application version metadata, not published releases or new release tags.

All file tables use `reveal_project_file`. It still validates project containment and rejects unsafe entries before handing the canonical path to the OS. Windows now converts canonical drive/UNC paths to Shell paths and uses `SHParseDisplayName` plus `SHOpenFolderAndSelectItems` to select the file or folder in its parent. Shell work runs off the UI thread; errors retain Windows diagnostics and reconnect/retry guidance. macOS retains `open -R`.

Automated coverage includes drive/UNC conversion, spaces/commas/Unicode, preservation of non-Unicode UTF-16 names, rejection of embedded nulls and unsupported device paths, Windows resolution of real canonical files/folders, and UI failure/retry behavior. Native parsing tests do not open Explorer and do not prove installed selection or NAS access.

## Installed verification — 2026-10-17

The user stopped a local `npm run tauri dev` instance, installed the PR #519 Windows test package, and reported that verification passes and Reveal works on all Windows tables. The user then confirmed: Reveal is working on both Windows and macOS. These reports establish the following behavior results:

| Platform / surface | Reported result |
| --- | --- |
| Windows — Client Files | Pass |
| Windows — Audio Prep | Pass |
| Windows — Revisions | Pass |
| Windows — Delivery | Pass |
| Windows — Files | Pass |
| macOS — Reveal / Finder behavior | Pass |
| Apple Silicon — installed verification | Not run — hardware unavailable |

The earlier screenshot's generic error came from the local development instance. After switching to the installed test package, the Windows report passed. No follow-up source change was needed.

Test packages from CI #2270: [Windows x64](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/39073265947/artifacts/12116218242) and [macOS Intel](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/39073265947/artifacts/12115823614). Artifact metadata identifies source head `8422624`; each package contains BUILD.txt and retains the existing 2.3.3 application version metadata. These are development packages; no release tag or stable artifact was changed.

## Detailed release-candidate coverage

The user did not separately enumerate local vs direct UNC/mapped-drive paths, file vs folder cases, names with spaces/commas/Unicode, or disconnected-share failure/recovery. Their individual installed results are **Not separately reported**; do not convert the overall behavior reports into individual matrix passes. Preserve these cases in the v2.4 RC acceptance checklist, together with the existing dependency-installed acceptance requirements. Automated path and native Shell parsing tests passed but do not independently establish installed NAS or Finder behavior.

## Acceptance result

Reported Windows and macOS Reveal behavior: **Pass**, accepted from the user's verification reports for #441 closeout. Detailed v2.4 RC coverage and Apple Silicon installed disposition remain separate release requirements. No claim of full v2.4 release acceptance is made.
