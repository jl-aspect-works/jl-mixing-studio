# JL Mixing Studio 2.3

Studio 2.3 adds Blind Revision Comparison and improves everyday project work. This Studio `v2.3.1-rc.2` candidate is coordinated with JL Mixing Automation `v2.3.1-rc.1` for packaged qualification. Studio still uses Automation API `1.0` and workspace metadata schema `1.1.0`; compatibility is determined by advertised capabilities and supported schemas, not matching product version numbers.

## Installation

Download the installer for your platform from the Assets section of the Studio `v2.3.1-rc.2` prerelease. Verify it against `SHA256SUMS.txt` before bypassing an operating-system security warning.

- Intel Mac: `JL-Mixing-Studio_2.3.1-rc.2_macos_x86_64.dmg`
- Apple Silicon Mac: `JL-Mixing-Studio_2.3.1-rc.2_macos_aarch64.dmg`
- Windows x64: `JL-Mixing-Studio_2.3.1-rc.2_windows_x86_64.exe`

On macOS, open the DMG and drag **JL Mixing Studio** to **Applications**. Studio is unsigned and not notarized. After verifying the checksum, Control-click the app, choose **Open**, and confirm **Open**. If still blocked, launch once, then use **System Settings → Privacy & Security → Open Anyway**.

On Windows, run the installer. Studio is unsigned; after verifying the checksum, select **More info → Run anyway** if SmartScreen blocks it and approve the normal User Account Control prompt.

Install Automation separately. For coordinated candidate acceptance, use Automation `v2.3.1-rc.1`. Its macOS bundled runtime requires the documented recursive quarantine removal after checksum verification; see its release notes.

## What's new

- **Blind Revision Comparison:** Compare two or more normal revisions, define overlapping timestamp regions, loop a region, switch candidates while preserving timeline position, explicitly rank every candidate with ties or No Preference, and add per-candidate notes. The built-in Full Song region is optional for a session. Completed sessions reveal revision identities, retain region snapshots, and contribute to cumulative standings; only the Full Song leader receives the TOP indicator. Unfinished sessions are not saved.
- **Unequal-length comparison:** A candidate can play a selected region when its audio extends past the region start. If it ends before the region's defined end, playback and looping use that candidate's actual end; switching from beyond its end restarts it at the region start.
- **Loudness Match:** Optional playback-only matching analyzes each candidate's full source, uses the quietest candidate as the reference, and attenuates louder candidates with a fixed gain. The original audio is never changed. Per-region matching is deferred to #396.
- **Playback and performance:** Compact preview controls appear in project and delivery contexts. Comparison setup, candidate preparation, and results show progress; Dashboard Today’s Work has an updated empty state.
- **Project management:** Project Files Rename/Delete actions work where supported. Permanent project deletion requires an authoritative summary and typing the exact Project Name. Empty-client deletion requires an authoritative summary and typing the exact Client Name; it cannot cascade into projects. External Listening copies are retained. These deletions have no built-in recovery.
- **Workflow details:** Audio Prep Reset reports real count-based progress when supported by Automation. Dialog primary actions respond to Enter where appropriate. Creative Direction supports persisted multiline text. New Client derives a read-only, filesystem-safe Client ID from its display name, with Automation retaining authoritative validation and collision checks.

## Compatibility and scope

- Automation API: `1.0`; workspace metadata schema: `1.1.0`.
- Existing valid v1.1+ workspaces remain compatible. No workspace migration is introduced.
- Provider-specific cloud/media APIs, signing/notarization, broad file/folder deletion (#270), and per-region loudness matching (#396) remain future work.

## Verification record

Implementation issues received feature-level approval; the merged Studio and Automation commits passed CI. Automation #206 fixes a Windows NAS client-deletion blocker from the initial `v2.3.0` packages; Studio #423 fixes blind comparison of shorter final-region candidates from `v2.3.1-rc.1`. The separate [2.3 release acceptance record](RELEASE_ACCEPTANCE_V2.3.md) tracks this candidate's packaged qualification without treating unrun checks as passed.
