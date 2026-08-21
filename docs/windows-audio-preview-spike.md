# Windows Native Audio Preview Technical Spike (#247)

## Status

**Candidate under validation: rodio 0.22 + CPAL + Symphonia.**

The v2.1 spike evaluates a native Rust playback path for Windows rather than retrying WebView2/HTML media or introducing proxy/transcoding. macOS remains on the existing WKWebView/HTML-media provider.

## Candidate architecture

- **Playback/control:** rodio `Player`
- **Windows audio output:** CPAL using the native Windows audio backend (WASAPI)
- **Decode/container support:** Symphonia through rodio
- **Required enabled features:** playback, AIFF, MP3, PCM, WAV
- **External codec/player installation:** none intended
- **Proxy/transcoding:** none

The production architecture, if this spike passes, should keep one shared Studio playback controller with platform providers:

- macOS provider: existing HTML media/WKWebView path
- Windows provider: native Rust provider backed by rodio/CPAL/Symphonia

Screens should continue consuming shared playback state rather than adding platform checks independently.

## Why this candidate

Rodio exposes play/pause, position, seek, source queues, and output-device integration. CPAL supplies native Windows output. Symphonia supports AIFF and WAVE containers plus PCM and MP3 decoding, covering the required JL project matrix without relying on WebView2 codecs.

Primary references:

- https://docs.rs/rodio/
- https://docs.rs/symphonia/
- https://github.com/RustAudio/cpal

## Automated Windows probe

The spike adds a Windows-only Rust probe and deterministic fixtures covering:

- WAV 16-bit PCM / 44.1 kHz / mono
- WAV 24-bit PCM / 48 kHz / stereo
- WAV 32-bit float / 96 kHz / stereo
- AIFF 24-bit PCM / 48 kHz / stereo
- MP3 / 44.1 kHz / stereo

For every fixture the probe requires:

1. successful native decode;
2. non-zero reported duration;
3. successful seek to the middle of the file;
4. decoded samples after the seek;
5. file handle release proven by rename-and-restore after decoder teardown.

The probe also exercises rodio `Player` play/pause state and verifies that dropping the player releases the source file.

When the GitHub-hosted Windows runner exposes a usable default output device, the probe additionally exercises native output playback, pause/resume, seek/progress, clear/stop, and file release. Hosted runners are not guaranteed to expose a physical/usable audio endpoint, so lack of an output device is recorded as a CI limitation rather than a codec/backend failure. Packaged Windows acceptance must require a real output device.

## Packaging/runtime fit

The candidate is included as a Windows-target Rust dependency inside the existing Tauri crate. It does not require a separately installed media application or codec pack. The spike builds the probe in release mode on `windows-latest`; the normal Studio Windows compile check simultaneously verifies compatibility with the Tauri crate.

Full production packaging integration belongs to #248 after this spike reaches a pass decision.

## Licensing

- rodio: MIT OR Apache-2.0
- CPAL: Apache-2.0
- Symphonia: MPL-2.0

Symphonia's MPL-2.0 license is compatible with use as a dependency in this open-source application, but its license notice/source obligations must be preserved in distribution documentation. No paid dependency is introduced.

## Pass/defer decision

Pending Windows CI results. The spike passes only if the required format matrix, seek/duration behavior, file release, Windows compilation/runtime probe, and dependency/licensing review all succeed without proxy/transcoding.
