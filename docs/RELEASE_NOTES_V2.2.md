# JL Mixing Studio 2.2

JL Mixing Studio 2.2 adds filesystem-based Revision and Delivered Listening workflows for local, NAS/shared, and mounted synchronized folders. It also captures the delivery note while creating a delivery and reduces the steady-state workspace work performed by the active-project monitor.

Studio 2.2.0 was qualified through packaged acceptance on Windows x64 and macOS Intel. Apple Silicon manual acceptance was deferred because suitable hardware was unavailable; the published Apple Silicon candidate and required automated compile, Listening regression, and WKWebView checks passed.

Studio remains a client of JL Mixing Automation API `1.0`. Compatibility is determined by API version, advertised capabilities, and supported workspace metadata rather than requiring matching Studio and Automation product versions.

## Installation

Download the installer for your platform from the Assets section of the release and verify it against `SHA256SUMS.txt` before bypassing an operating-system security warning. Replace `<version>` below with the version shown on the release (`2.2.0` for this stable release).

### macOS

Choose the installer that matches the Mac:

- `JL-Mixing-Studio_<version>_macos_x86_64.dmg` for Intel Macs.
- `JL-Mixing-Studio_<version>_macos_aarch64.dmg` for Apple Silicon Macs.

Open the DMG and drag **JL Mixing Studio** to **Applications**.

Studio is currently unsigned and not notarized. After verifying the checksum, Control-click or right-click **JL Mixing Studio.app**, choose **Open**, and confirm **Open** if offered. If macOS still blocks the application, attempt one launch and then use **System Settings → Privacy & Security → Open Anyway**.

The recursive `xattr -dr com.apple.quarantine` workaround documented for JL Mixing Automation is normally not required for Studio.

### Windows

Run:

```text
JL-Mixing-Studio_<version>_windows_x86_64.exe
```

Studio is currently unsigned. After verifying the checksum, use **More info → Run anyway** if Microsoft Defender SmartScreen blocks the installer, then approve the normal User Account Control prompt if it appears.

### Automation requirement

JL Mixing Automation is installed separately. Studio `2.2.0` is coordinated with Automation `2.2.0`. Stable qualification used the accepted `2.2.0-rc.1` pair, and Automation 2.2.0 includes the delivery `source_path` provenance required for precise Delivered Listening source selection. Existing delivery manifests without that field remain supported through Studio's conservative legacy fallback.

## Highlights

### Revision Listening

- Configure one or more Revision Listening destinations in **Settings → Listening**.
- Each destination has its own name, enabled state, folder, required file format, metadata policy, and artwork policy.
- Stable current-revision audio publishes as `<destination>/<client>/<project>-rev-XX.<ext>`.
- The active-project monitor continuously verifies the managed audio, metadata, and artwork and republishes missing or stale content.
- Source audio must remain unchanged for three observations before a new or changed source is published, reducing the risk of copying an incomplete DAW export.

### Delivered Listening

- Configure Delivered Listening independently from Revision Listening.
- A successful delivery can publish immediately, and the active-project monitor continues reconciling it without requiring the Delivery screen to remain open.
- Delivered audio publishes as `<destination>/<client>/<project>.<ext>` without a revision suffix.
- New delivery provenance selects the same authoritative source used by the package. Older manifests use a conservative fallback and never guess when multiple candidates are ambiguous.
- Failed delivery creation does not replace Delivered Listening content.

### Metadata and artwork

- Listening-copy metadata can be preserved or replaced per destination.
- Replacement metadata includes the project title, artist, album artist, album, and JL Mixing genre.
- Revision Listening titles include the revision; Delivered Listening titles do not.
- Studio-branded embedded artwork and media-server-neutral `artist.png` / `folder.png` sidecars are supported.
- Metadata and artwork changes apply only to Listening copies; authoritative revision and delivery source artifacts remain unchanged.

### Contextual observability

- Revision and Delivery screens show contextual Published, Skipped, or Failed activity and destination details.
- Normal missing-format/missing-source conditions remain quiet rather than being treated as application errors.
- Settings remains configuration-only; there is no manual Retry/Republish control because reconciliation is self-healing.
- Production diagnostics record actual failures and recoveries at normal levels. Per-scan phase timings are available at debug level without classifying device- or NAS-dependent duration against a fixed threshold.

### Delivery and performance refinements

- Delivery notes are captured as part of the Create Delivery workflow.
- The active monitor uses stable IDs to discover only the selected project instead of rebuilding the complete workspace and deriving global Tasks/Activities on every scan.
- Unchanged quiet publish snapshots no longer cause recurring frontend state updates/renders.
- Revision and Delivered reconciliation are serialized within the monitor, while safe immediate post-build/view-entry paths remain available.

## Monitor timing model

The monitor completes one active-project scan, waits one second, and then begins the next scan. Scans do not overlap. The one-second value is an inter-scan delay, not a fixed end-to-end repair guarantee.

Actual scan and repair time varies with the selected project, source/destination count, device speed, filesystem, and network/NAS performance. Source-stability sampling and failed-publish retry backoff can intentionally add further delay. These timing differences affect latency, not the self-healing correctness contract.

## Compatibility

- Automation API: `1.0`
- Workspace metadata schema: `1.1.0`
- Application identifier: `com.jlaudio.jlmixingstudio`
- Existing valid v1.1+ workspaces remain compatible; Studio 2.2 introduces no workspace migration.
- Existing Studio 2.1 settings remain compatible. Listening settings are additive and local to Studio.
- Studio and Automation remain independently versioned products.

## Explicitly deferred beyond 2.2

- Provider-specific cloud APIs, OAuth, and managed share links.
- Plex, Navidrome, or OpenSubsonic server APIs, scan requests, playlist creation, and item linking.
- JL-hosted streaming, accounts, storage, or public URLs.
- Transcoding, resampling, normalization, and required-format fallback.
- Dynamic per-project artwork generation and revision feedback workflows.
- Filesystem-watcher redesign, a persistent workspace index, or reduced self-healing cadence without production evidence.
- Generic project/client deletion and unrestricted project file management.
- Application signing and macOS notarization.

## Release qualification

Branch/runtime feature and performance checks passed. Published `v2.2.0-rc.1` packages passed the required Windows x64 and macOS Intel acceptance matrix with no release-blocking findings. E05 legacy-manifest testing and macOS Apple Silicon manual testing were explicitly deferred with supporting automated and prior evidence, as recorded in [`RELEASE_ACCEPTANCE_V2.2.md`](RELEASE_ACCEPTANCE_V2.2.md).
