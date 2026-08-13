# Audio Preview Technical Spike (#197)

## Final Studio 2.0 decision

**Ship embedded audio preview on macOS in Studio 2.0. Defer embedded preview on Windows.**

The original cross-platform spike found that a single WebView-only implementation cannot cover the normal JL project format matrix on Windows because Tauri uses WebView2/Chromium there and Chromium's WAV handler does not support normal 24-bit integer PCM WAV. AIFF is also not in Chromium's documented container matrix.

The product decision was subsequently narrowed so macOS-only embedded preview is acceptable for Studio 2.0. A focused runtime spike now demonstrates that macOS WKWebView can load the required JL project formats through HTML media elements on both Intel and Apple Silicon GitHub-hosted macOS runners.

Windows preview remains deferred rather than introducing native playback or proxy/transcode complexity into the 2.0 release.

## Preferred architecture for macOS

Use the existing Tauri WebView and HTML `audio` / `HTMLMediaElement`.

Tauri 2 can expose local project files to the WebView through `convertFileSrc` and the asset protocol, with scope controlled by Rust. This supports local, NAS and OS-mounted cloud paths without copying or transcoding files merely for preview.

Relevant Tauri references:

- https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc
- https://v2.tauri.app/security/asset-protocol/
- https://docs.rs/tauri/latest/tauri/trait.Manager.html#method.asset_protocol_scope

No native Rust audio player is required for the macOS implementation.

## macOS runtime spike

PR #204 adds a focused WKWebView probe that:

1. generates deterministic representative audio fixtures;
2. creates a real visible `WKWebView` on the macOS runner;
3. loads the fixture directory through WebKit's file-access path;
4. assigns each file to an HTML media element;
5. requires `loadedmetadata` plus a valid non-zero duration;
6. fails CI on any unsupported fixture.

The first harness revision kept WKWebView unattached to a window and every format remained at media readyState 0. That was a harness limitation, not a codec result. After attaching WKWebView to an `NSWindow`, the required matrix passed on both architectures.

### Apple Silicon result

macOS 15.7.7 / `macos-15-arm64` runner:

- PASS WAV 16-bit PCM, 44.1 kHz, mono
- PASS WAV 24-bit PCM, 48 kHz, stereo
- PASS WAV 32-bit float, 96 kHz, stereo
- PASS AIFF 24-bit PCM, 48 kHz, stereo
- PASS MP3, 44.1 kHz, stereo

Each file reported a valid duration through WKWebView.

### Intel result

macOS 15.7.7 / `macos-15` Intel runner:

- PASS WAV 16-bit PCM, 44.1 kHz, mono
- PASS WAV 24-bit PCM, 48 kHz, stereo
- PASS WAV 32-bit float, 96 kHz, stereo
- PASS AIFF 24-bit PCM, 48 kHz, stereo
- PASS MP3, 44.1 kHz, stereo

Each file reported a valid duration through WKWebView.

## Required format matrix

| Requirement | macOS WKWebView | Windows WebView2 | Studio 2.0 |
| --- | --- | --- | --- |
| WAV 16-bit PCM | Pass | Supported | Preview on macOS only |
| WAV 24-bit PCM | **Pass** | **Blocked by Chromium WAV handler** | Preview on macOS only |
| WAV 32-bit float | Pass | Supported | Preview on macOS only |
| 44.1 kHz | Pass | No independent blocker identified | Preview on macOS only |
| 48 kHz | Pass | No independent blocker identified | Preview on macOS only |
| 96 kHz | Pass | No independent blocker identified | Preview on macOS only |
| mono | Pass | No independent blocker identified | Preview on macOS only |
| stereo | Pass | No independent blocker identified | Preview on macOS only |
| AIFF | **Pass** | Not in Chromium documented container matrix | Preview on macOS only |
| MP3 | Pass | Supported | Preview on macOS only |

## Windows finding

On Windows, Tauri uses Microsoft Edge WebView2. Chromium's media support and WAV handler do not cover 24-bit integer PCM WAV, a normal JL Mixing project/bounce format. AIFF cross-platform support is also not established.

Relevant primary references:

- https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- https://chromium.googlesource.com/website/+/HEAD/site/audio-video/index.md
- https://chromium.googlesource.com/chromium/src/+/HEAD/media/audio/wav_audio_handler.cc

A native Rust path using rodio/cpal/Symphonia remains technically feasible, but it would introduce a first-class audio-device/output subsystem. Proxy/transcode playback would add temporary files, extra I/O, latency and derivative-audio semantics. Both remain deferred for Windows.

## Studio 2.0 implementation requirements

For #189, #191, #192, #193, #194 and #195:

- show embedded preview controls on macOS;
- omit playback controls cleanly on Windows;
- expose playback through one shared platform capability rather than scattered OS checks;
- support Play/Pause, simple seek/progress and elapsed/total duration;
- allow volume only if inexpensive;
- enforce one playing file across Studio;
- stop/release playback before rename/delete/replacement of the playing file;
- surface unsupported/unreadable-file errors clearly;
- do not add waveform UI;
- do not add proxy/transcode playback.

The common file/browser foundation in #198 should expose hooks for the shared preview capability/component without owning platform-specific playback policy itself.

## Packaging/runtime implications

### macOS WebView path

- no new playback runtime dependency;
- no additional native audio library;
- no proxy/transcode dependency;
- uses the WebKit stack already shipped with macOS/Tauri;
- requires packaged-app acceptance on representative real project/bounce files before final 2.0 release.

### Windows

- no embedded preview in 2.0;
- no hidden fallback or partial-format playback UI;
- future Windows preview should be evaluated as a separate feature/subsystem.

## Validation caveat

The automated spike validates media-element loading, format recognition and valid duration through a real WKWebView. GitHub-hosted CI does **not** prove audible output through a physical audio device.

Before Studio 2.0 final release, packaged macOS acceptance should include actual audible Play/Pause/seek behavior using representative real files. The codec/decode gate itself is considered passed by the Intel and Apple Silicon WKWebView matrix above.
