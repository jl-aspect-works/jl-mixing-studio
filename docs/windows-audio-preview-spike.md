# Windows Native Audio Preview Technical Spike (#247)

## Status

**PASS candidate: rodio 0.22 + CPAL + Symphonia.**

The v2.1 spike validates a native Rust playback path for Windows rather than retrying WebView2/HTML media or introducing proxy/transcoding. macOS remains on the existing WKWebView/HTML-media provider.

## Candidate architecture

- **Playback/control:** rodio `Player`
- **Windows audio output:** CPAL using the native Windows audio backend (WASAPI)
- **Decode/container support:** Symphonia through rodio
- **Required enabled features:** playback, AIFF, MP3, PCM, WAV
- **External codec/player installation:** none
- **Proxy/transcoding:** none

The production architecture should keep one shared Studio playback controller with platform providers:

- macOS provider: existing HTML media/WKWebView path
- Windows provider: native Rust provider backed by rodio/CPAL/Symphonia

Screens should consume shared playback state rather than adding platform checks independently. The shared controller remains responsible for allowing only one active preview stream at a time.

## Why this candidate

Rodio exposes play/pause, position, seek, source clearing, and output-device integration. CPAL supplies native Windows output. Symphonia supports AIFF and WAVE containers plus PCM and MP3 decoding, covering the required JL project matrix without relying on WebView2 codecs.

Primary references:

- https://docs.rs/rodio/
- https://docs.rs/symphonia/
- https://github.com/RustAudio/cpal

## Automated Windows probe

The Windows-only Rust probe uses deterministic fixtures covering:

- WAV 16-bit PCM / 44.1 kHz / mono
- WAV 24-bit PCM / 48 kHz / stereo
- WAV 32-bit float / 96 kHz / stereo
- AIFF 24-bit PCM / 48 kHz / stereo
- MP3 / 44.1 kHz / stereo

For every supported fixture the probe requires:

1. successful native decode;
2. non-zero reported duration;
3. successful seek to the middle of the file;
4. decoded samples after the seek;
5. file-handle release proven by rename-and-restore after decoder teardown.

The probe also requires:

- unsupported/non-audio input to fail decoding cleanly;
- rodio `Player` play/pause state changes;
- explicit clear/stop behavior;
- an empty player after clear;
- file-handle release after player teardown.

When a Windows runner exposes a usable default output device, the same probe additionally exercises native output playback, pause/resume, seek/progress, clear/stop, and file release. `--require-device` makes this a hard requirement for packaged/manual acceptance.

## CI evidence

Initial Windows validation in Studio CI run #1427 passed the entire codec/control probe and release-mode build:

- `wav16-44100-mono.wav`: PASS, 1 channel, 44.1 kHz, 1000 ms, seek to 500 ms
- `wav24-48000-stereo.wav`: PASS, 2 channels, 48 kHz, 1000 ms, seek to 500 ms
- `wavf32-96000-stereo.wav`: PASS, 2 channels, 96 kHz, 1000 ms, seek to 500 ms
- `aiff24-48000-stereo.aiff`: PASS, 2 channels, 48 kHz, 1000 ms, seek to 500 ms
- `mp3-44100-stereo.mp3`: PASS, 2 channels, 44.1 kHz, 1000 ms, seek to 500 ms
- rodio play/pause/drop control surface: PASS
- release-mode Windows probe build: PASS
- normal Studio Windows compile check with the candidate dependency: PASS
- Rust formatting, clippy, and tests: PASS
- existing macOS Intel and Apple Silicon WKWebView probes: PASS

The GitHub-hosted Windows runner reported no default output device, so audible device playback was correctly skipped. This is an infrastructure limitation, not a decode/control failure. Packaged Windows acceptance must still exercise `--require-device` or the production equivalent on a real Windows audio device.

A generated Cargo lockfile was captured as a CI artifact for dependency review.

## Packaging/runtime fit

The candidate is a Windows-target Rust dependency inside the existing Tauri crate. It requires no separately installed media application or codec pack. The probe builds successfully in optimized release mode on `windows-latest`, and the normal Studio Windows compile check verifies compatibility with the Tauri crate.

Full production integration and packaged-device acceptance belong to #248.

## Licensing

- rodio: MIT OR Apache-2.0
- CPAL: Apache-2.0
- Symphonia: MPL-2.0

Symphonia's MPL-2.0 license is compatible with use as a dependency in this open-source application, with its notice/source obligations preserved in distribution documentation. No paid dependency is introduced.

## Pass/defer decision

**PASS. Proceed with #248 using rodio + CPAL + Symphonia as the Windows-native provider.**

The spike has established the required decode matrix, duration/seek behavior, unsupported-input failure, stop/release semantics, Windows compilation and optimized-build viability, packaging shape, and licensing path without proxy/transcoding. The remaining real-device audible playback check is appropriately deferred to Windows packaged acceptance because GitHub-hosted runners do not expose an output device.
