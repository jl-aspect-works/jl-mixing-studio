# JL Mixing Studio 2.3

Studio `v2.3.2-rc.1` is a prerelease candidate that adds guarded Client Files deletion (#270) and optional per-region loudness matching (#396). A follow-up Studio candidate is being prepared to make per-region matching the default and correct result saving. It pairs with Automation `v2.3.2-rc.1` for managed Original Delivery deletion. Studio still uses Automation API `1.0` and workspace metadata schema `1.1.0`; compatibility is determined by advertised capabilities and supported schemas.

## Installation

Download the installer for your platform from the Assets section of the Studio `v2.3.2-rc.1` prerelease. Verify it against `SHA256SUMS.txt` before bypassing an operating-system security warning.

- Intel Mac: `JL-Mixing-Studio_2.3.2-rc.1_macos_x86_64.dmg`
- Apple Silicon Mac: `JL-Mixing-Studio_2.3.2-rc.1_macos_aarch64.dmg`
- Windows x64: `JL-Mixing-Studio_2.3.2-rc.1_windows_x86_64.exe`

On macOS, open the DMG and drag **JL Mixing Studio** to **Applications**. Studio is unsigned and not notarized. After verifying the checksum, Control-click the app, choose **Open**, and confirm **Open**. If still blocked, launch once, then use **System Settings → Privacy & Security → Open Anyway**.

On Windows, run the installer. Studio is unsigned; after verifying the checksum, select **More info → Run anyway** if SmartScreen blocks it and approve the normal User Account Control prompt.

Install Automation `v2.3.2-rc.1` separately before testing managed Original Delivery deletion. Its macOS bundled runtime requires the documented recursive quarantine removal after checksum verification; see its release notes.

## What's new

- **Client Files deletion (#270):** Delete individual files or recursively delete folders within Client Files, Working Audio, and Rejected Files after a pre-delete summary and exact-name confirmation. Protected roots, symbolic links, and unsafe managed dependencies are rejected. Imported Original Delivery deletion uses Automation `v2.3.2-rc.1` to reconcile managed lineage and retain Working Audio copies. Deletion is permanent and has no built-in recovery.
- **Per-region Loudness Match (#396, #436):** In the follow-up candidate, Loudness Match is on by default and analyzes each selected region using its precise boundaries. The on/off switch remains, and the matching-scope choice is removed. Custom-only sessions are supported. Gain stays fixed throughout each region and changes when the region changes, without modifying source audio. The blind screen hides measurements; revealed results include per-region values. Older full-source sessions remain readable.
- **Blind Revision Comparison:** Compare two or more normal revisions, define overlapping timestamp regions, loop a region, switch candidates while preserving timeline position, explicitly rank every candidate with ties or No Preference, and add per-candidate notes. The built-in Full Song region is optional for a session. Completed sessions reveal revision identities, retain region snapshots, and contribute to cumulative standings; only the Full Song leader receives the TOP indicator. Unfinished sessions are not saved.
- **Unequal-length comparison:** A candidate can play a selected region when its audio extends past the region start. If it ends before the region's defined end, playback and looping use that candidate's actual end; switching from beyond its end restarts it at the region start.
- **Loudness Match:** Playback-only matching uses the quietest candidate in each selected region as the reference and attenuates louder candidates with fixed gain. It can be turned off. The original audio is never changed.
- **Playback and performance:** Compact preview controls appear in project and delivery contexts. Comparison setup, candidate preparation, and results show progress; Dashboard Today’s Work has an updated empty state.
- **Project management:** Project Files Rename/Delete actions work where supported. Permanent project deletion requires an authoritative summary and typing the exact Project Name. Empty-client deletion requires an authoritative summary and typing the exact Client Name; it cannot cascade into projects. External Listening copies are retained. These deletions have no built-in recovery.
- **Workflow details:** Audio Prep Reset reports real count-based progress when supported by Automation. Dialog primary actions respond to Enter where appropriate. Creative Direction supports persisted multiline text. New Client derives a read-only, filesystem-safe Client ID from its display name, with Automation retaining authoritative validation and collision checks.

## Compatibility and scope

- Automation API: `1.0`; workspace metadata schema: `1.1.0`.
- Existing valid v1.1+ workspaces remain compatible. No workspace migration is introduced.
- Provider-specific cloud/media APIs and signing/notarization remain future work.

## Verification record

The preceding stable `v2.3.1` qualification is preserved in the [2.3.1 record](https://github.com/jl-aspect-works/jl-mixing-studio/blob/main/docs/RELEASE_ACCEPTANCE_V2.3.md). The [2.3.2 candidate record](https://github.com/jl-aspect-works/jl-mixing-studio/blob/main/docs/RELEASE_ACCEPTANCE_V2.3.2.md) tracks this exact pairing and its installed platform results. This prerelease has not yet passed installed acceptance.
