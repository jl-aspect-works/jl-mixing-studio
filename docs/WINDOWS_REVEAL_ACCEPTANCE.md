# Windows Reveal acceptance — issue #441

Target: v2.4. Source CI and installed acceptance are separate gates. Keep #441 open until the required installed checks pass and the user approves the result.

## Build and implementation

The focused PR's CI provides Windows x64 NSIS and macOS Intel DMG development packages, with a `BUILD.txt` identifying the tested commit. These are development test builds using the current application version metadata, not published releases or new release tags.

All file tables use `reveal_project_file`. It still validates project containment and rejects unsafe entries before handing the canonical path to the OS. Windows now converts canonical drive/UNC paths to Shell paths and uses `SHParseDisplayName` plus `SHOpenFolderAndSelectItems` to select the file or folder in its parent. Shell work runs off the UI thread; errors retain Windows diagnostics and reconnect/retry guidance. macOS retains `open -R`.

Automated coverage includes drive/UNC conversion, spaces/commas/Unicode, preservation of non-Unicode UTF-16 names, rejection of embedded nulls and unsupported device paths, Windows resolution of real canonical files/folders, and UI failure/retry behavior. Native parsing tests do not open Explorer and do not prove installed selection or NAS access.

## Installed verification

Install the package from the passing PR CI and record its `BUILD.txt` commit, OS, workspace path type and results in the PR or #441. Use an existing project with representative content; include names with spaces, commas and Unicode. Confirm that Reveal opens the actual containing folder and highlights the selected item, without a false error or a stuck busy state. A folder should be highlighted in its parent rather than opened as the target directory.

| Windows surface | Local file | Local folder, where offered | NAS/UNC file | NAS/UNC folder, where offered |
| --- | --- | --- | --- | --- |
| Client Files | Not run | Not run | Not run | Not run |
| Audio Prep | Not run | Not run | Not run | Not run |
| Revisions | Not run | Not run | Not run | Not run |
| Delivery | Not run | Not run | Not run | Not run |
| Files | Not run | Not run | Not run | Not run |

Mark a folder case N/A only if that table does not offer folder rows; record why. Include a mapped drive if that is part of the normal workspace setup, separately from a direct UNC path.

- Windows failure/recovery: disconnect a test network workspace or remove a selected test entry after listing it. Reveal should report a useful error and permit retry after reconnection/refresh; do not modify production content for this check. **Not run.**
- macOS Intel 12.7.6: Reveal a file and a folder, including a name with spaces, and confirm Finder selects the correct item in its parent. **Not run.**
- Apple Silicon: automated compile and regression checks run independently; installed verification is **Not run — hardware unavailable**, carried forward for explicit release disposition.

## Acceptance result

Installed Windows local/NAS and macOS Intel results: **Not run**. User approval: **Pending**. CI results and artifact links belong in the focused PR; passing source checks alone do not close #441.
