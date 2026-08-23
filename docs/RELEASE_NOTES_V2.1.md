# JL Mixing Studio 2.1

JL Mixing Studio 2.1 expands the Daily Workflow desktop application for macOS and Windows with editable workspace metadata, managed Client Files and Audio Prep workflows, revision lifecycle controls, Windows embedded audio playback, search/filter improvements, and a substantial responsiveness pass.

Studio remains a client of JL Mixing Automation API `1.0`; compatibility is determined by API version and advertised capabilities rather than requiring matching application version numbers. The coordinated release-candidate pair is:

- JL Mixing Studio `2.1.0-rc.2`
- JL Mixing Automation `2.1.0-rc.2`

Packaged Studio acceptance for this RC should be performed with the coordinated Automation `2.1.0-rc.2` provider installed so all new capability-backed workflows are exercised against the intended release candidate.

## Installation

Download the installer for your platform from the Assets section of this release and verify it against `SHA256SUMS.txt` before bypassing any operating-system security warning.

### macOS

Choose the installer that matches your Mac:

- `JL-Mixing-Studio_2.1.0-rc.2_macos_x86_64.dmg` for Intel Macs.
- `JL-Mixing-Studio_2.1.0-rc.2_macos_aarch64.dmg` for Apple Silicon Macs.

Open the DMG and drag **JL Mixing Studio** to **Applications**.

JL Mixing Studio 2.1 is currently unsigned and not notarized. macOS Gatekeeper may report that Apple cannot verify the developer or may otherwise block the first launch.

After verifying the installer checksum:

1. In **Applications**, Control-click or right-click **JL Mixing Studio.app** and choose **Open**. Choose **Open** again if macOS offers that option.
2. If macOS still blocks the application, attempt to open it once, then open **System Settings → Privacy & Security**. In the Security section, find the message for JL Mixing Studio, choose **Open Anyway**, authenticate if prompted, and confirm **Open**.

The recursive `xattr -dr com.apple.quarantine` workaround documented for JL Mixing Automation is normally **not required for Studio**. That Automation workaround is needed because the Automation archive contains a bundled Python framework/runtime.

### Windows

Run:

```text
JL-Mixing-Studio_2.1.0-rc.2_windows_x86_64.exe
```

The Windows installer is currently unsigned. Microsoft Defender SmartScreen may show **Windows protected your PC** or identify the publisher as unknown.

After verifying the installer checksum:

1. Choose **More info**.
2. Choose **Run anyway**.
3. Approve the normal Windows User Account Control prompt if it appears.

### Automation requirement

JL Mixing Automation is installed separately. Studio discovers Automation through API `1.0` and advertised capabilities. For the coordinated 2.1 RC validation cycle, install JL Mixing Automation `2.1.0-rc.2` before testing Studio `2.1.0-rc.2`.

## Highlights

- **Editable workspace metadata:** edit supported Studio defaults, client metadata, and project metadata directly in Studio through Automation-owned update operations.
- **Client and project refinement:** improved search, editing, navigation, and consistent action layouts across Studio, Clients, and Projects.
- **Dashboard refinement:** improved Workspace Summary and Current Work presentation, with cached startup hydration for faster useful first paint.
- **Managed Client Files import:** import additional Client Files through a plan/execute workflow with per-file Add/Skip choices plus Add All and Skip All; import is also available while creating a new project.
- **Managed Audio Prep reset:** rebuild the managed Working Audio set from current Client Files without exposing unrestricted filesystem mutation.
- **Revision lifecycle controls:** Close/Reopen revisions that should no longer be current without deleting their history, and Unapprove a previously approved revision when the approval must be reversed.
- **Project health semantics:** Client Files findings remain visible on the Client Files screen, while project-level Needs Attention reflects Audio Prep / Audio Files validation readiness rather than non-blocking Client Files findings.
- **Windows embedded audio playback:** native in-app preview eligibility follows Studio's broad audio-format recognition instead of a WAV/AIFF/MP3-only whitelist; the bundled player/decoder determines whether the actual file contents can be decoded.
- **Tasks and Activities search/filter:** usable search and compact filter controls for both workflow lists.
- **Project Files refinement:** full-width controlled Files browser with the obsolete Project Structure navigator removed.
- **Delivery refinement:** faster status/notes hydration, cached authoritative reads, responsive package controls, and preserved Automation-owned package safety.
- **Responsiveness pass:** reduced duplicate workspace scans and validation calls, faster project-tab navigation, cached project-file and revision/delivery reads, faster Dashboard startup, and faster Studio editing readiness while preserving shared-workspace correctness.
- **UI polish:** consistent compact dialog actions and responsive Studio, Delivery, and Settings layouts.

## Compatibility

- Automation API: `1.0`
- Workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Existing valid v1.1+ workspaces remain compatible; no workspace migration is introduced by Studio 2.1.
- Studio and Automation remain independently versioned products. Compatibility is based on API version, advertised capabilities, and supported metadata schemas.

## Explicitly deferred beyond 2.1

- Application signing and macOS notarization.
- Generic project file/folder deletion outside the explicitly managed workflows.
- Audio Prep repair, normalization, Fix/Convert, or format conversion.
- Provider-specific OneDrive, iDrive, or NAS APIs.
- Real-time simultaneous multi-machine conflict merging.
- DAW-like waveform editing, playlists, A/B comparison, or transport features.

## Release-candidate validation

`2.1.0-rc.2` is intended for coordinated packaged acceptance on Windows and macOS. Acceptance should cover installation/launch, Automation provider discovery, Studio/Client/Project editing, managed Client Files import and Audio Prep reset, revision Close/Reopen and Approve/Unapprove flows, Delivery creation, shared-workspace refresh behavior, Tasks/Activities filters, Windows UNC/NAS workflows, and embedded audio playback across representative supported audio formats.
