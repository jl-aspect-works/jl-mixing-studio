# JL Mixing Studio 2.0

JL Mixing Studio 2.0 is the Daily Workflow desktop release for macOS and Windows. It is designed to run with a compatible JL Mixing Automation API `1.0` provider; the coordinated stable provider release is JL Mixing Automation 2.0.

## Installation

Download the installer for your platform from the Assets section of this release and verify it against `SHA256SUMS.txt` before bypassing any operating-system security warning.

### macOS

Choose the installer that matches your Mac:

- `JL-Mixing-Studio_2.0.0_macos_x86_64.dmg` for Intel Macs.
- `JL-Mixing-Studio_2.0.0_macos_aarch64.dmg` for Apple Silicon Macs.

Open the DMG and drag **JL Mixing Studio** to **Applications**.

JL Mixing Studio 2.0 is currently unsigned and not notarized. macOS Gatekeeper may report that Apple cannot verify the developer or may otherwise block the first launch.

After verifying the installer checksum:

1. In **Applications**, Control-click or right-click **JL Mixing Studio.app** and choose **Open**. Choose **Open** again if macOS offers that option.
2. If macOS still blocks the application, attempt to open it once, then open **System Settings → Privacy & Security**. In the Security section, find the message for JL Mixing Studio, choose **Open Anyway**, authenticate if prompted, and confirm **Open**.

The recursive `xattr -dr com.apple.quarantine` workaround documented for JL Mixing Automation is normally **not required for Studio**. That Automation workaround is needed because the Automation archive contains a bundled Python framework/runtime.

### Windows

Run:

```text
JL-Mixing-Studio_2.0.0_windows_x86_64.exe
```

The Windows installer is currently unsigned. Microsoft Defender SmartScreen may show **Windows protected your PC** or identify the publisher as unknown.

After verifying the installer checksum:

1. Choose **More info**.
2. Choose **Run anyway**.
3. Approve the normal Windows User Account Control prompt if it appears.

### Automation requirement

JL Mixing Automation is installed separately. Studio discovers Automation through API `1.0` and advertised capabilities; product version equality is not the compatibility contract. The coordinated 2.0 release pair is:

- JL Mixing Studio `2.0.0`
- JL Mixing Automation `2.0.0`

## Highlights

- Daily Workflow navigation centered on Dashboard, Studio, Clients, Projects, Tasks, Activities, and Settings.
- Purpose-built project workspaces for Overview, Client Files, Audio Prep, References, Revisions, Delivery, and Files.
- Workspace creation, selection, health, reconnect behavior, and storage visibility directly in Studio.
- Structured cached Client Files validation with per-file findings and technical metadata.
- Audio Prep validation and exact-content provenance with safe inline rename and delete operations.
- Project-owned reference file management.
- Revision history, editable descriptions, Markdown Revision Notes, approval workflow, and managed revision files.
- Delivery readiness/status, Markdown Delivery Notes, package current/stale state, and authoritative package build/rebuild workflow.
- Controlled project-wide Files navigation with area-specific permissions rather than unrestricted filesystem mutation.
- Shared-workspace refresh/resilience for local, NAS, and OS-mounted synchronized paths.
- Embedded audio preview on macOS for supported project audio; Windows embedded preview remains deferred.
- Compact Daily Workflow UI, transient success feedback, consistent action hierarchy, and the Windows Revision History layout correction validated in RC3.

## Compatibility

- Automation API: `1.0`
- Workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Existing valid v1.1-schema workspaces remain compatible; no workspace migration is introduced by Studio 2.0.
- Studio and Automation remain independently versioned products. Compatibility is based on API version, advertised capabilities, and supported metadata schemas.

## Explicitly deferred beyond 2.0

- Windows embedded audio preview/playback.
- Audio Prep Fix/Convert, repair, normalization, or format conversion.
- Generic Add/Import Files in Files or Audio Prep.
- Client Files import/re-import workflow and mutation of Original Delivery.
- Provider-specific OneDrive/iDrive/NAS APIs.
- Real-time simultaneous multi-machine conflict merging.
- Unrestricted generic filesystem browsing.
- Waveform editing, playlists, A/B comparison, and DAW-like transport.

## Validation

Studio 2.0 stable is promoted from the coordinated RC cycle after the complete Studio CI matrix passed and the final RC3 package was verified on macOS and Windows with no remaining release-blocking defect.
