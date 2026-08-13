# Audio Preview Technical Spike (#197)

## Decision

**Recommendation: defer audio preview from the Studio 2.0 Daily Workflow release.**

The simplest architecture, HTML `<audio>` inside the existing Tauri WebView, does not provide a reliable cross-platform path for the required JL project format matrix. The blocking case is normal 24-bit PCM WAV on Windows/WebView2; AIFF is also not part of Chromium's documented container support. A native Rust playback layer can cover the required formats, but it introduces a separate audio-device/output subsystem and dependency surface that is materially larger than the intended preview feature and crosses the issue's defer threshold.

This decision does not affect the rest of the approved Daily Workflow screen redesigns. Playback controls shown in approved wireframes remain illustrative/provisional and should be omitted from Studio 2.0 implementation unless this decision is deliberately reopened.

## Architecture evaluated

### 1. Existing Tauri WebView + HTMLMediaElement

This is the preferred low-complexity approach.

Tauri 2 can expose local files to the WebView with `convertFileSrc` and the asset protocol. The asset protocol can be scoped to individual files or directories, including paths added at runtime by Rust, so local/NAS/mounted-cloud project files do not require copying or transcoding merely to make them addressable by the WebView.

Relevant Tauri references:

- https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc
- https://v2.tauri.app/security/asset-protocol/
- https://docs.rs/tauri/latest/tauri/trait.Manager.html#method.asset_protocol_scope

Addressability is therefore not the blocker. Decode compatibility is.

On Windows, Tauri uses Microsoft Edge WebView2. Microsoft documents WebView2 as using the Microsoft Edge rendering engine. Chromium's current media support documentation lists WAV and MP3 containers/codecs but its PCM support is limited to 8-bit unsigned integer, 16-bit signed integer little-endian, and 32-bit float little-endian. Chromium's current WAV handler source likewise accepts integer PCM at 8, 16, or 32 bits and floating-point PCM at 32 or 64 bits; 24-bit integer PCM is not accepted. AIFF is not listed as a supported Chromium container.

Relevant primary references:

- https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- https://chromium.googlesource.com/website/+/HEAD/site/audio-video/index.md
- https://chromium.googlesource.com/chromium/src/+/HEAD/media/audio/wav_audio_handler.cc

Because 24-bit PCM WAV is a normal JL Mixing project/bounce format and is explicitly required by #197, WebView-only playback does not meet the release gate even if macOS WebKit accepts a broader set of files.

### 2. Native Rust playback

A native Rust path was evaluated far enough to establish feasibility and cost.

`rodio` provides playback through `cpal` and decoding through Symphonia. Symphonia supports WAV, AIFF, MP3 and PCM, which makes a native path technically capable of covering the required file types without a proxy/transcode workflow.

Relevant primary references:

- https://docs.rs/rodio/latest/rodio/
- https://docs.rs/rodio/latest/rodio/decoder/
- https://docs.rs/symphonia/latest/symphonia/

A production implementation would need to own at least:

- output-device and stream lifetime;
- one global player across Studio;
- file decode/open errors;
- play/pause/seek/duration state;
- synchronization between the Rust player and React UI;
- stop/release-before-mutation semantics;
- device-loss/output errors;
- macOS and Windows packaged-runtime acceptance;
- additional Rust audio dependencies and their maintenance/licensing review.

That is a real native playback subsystem, not a thin WebView convenience wrapper. It is feasible, but it is disproportionate to the preview feature for the current Daily Workflow release and matches #197's explicit defer criterion for native audio-device management / platform complexity.

## Required format matrix

| Format / characteristic | WebView-only assessment | Studio 2.0 decision |
| --- | --- | --- |
| WAV 16-bit PCM | Supported by Chromium media stack | Would play, but insufficient alone |
| WAV 24-bit PCM | **Not supported by Chromium WAV PCM handler** | **Blocking** |
| WAV 32-bit float | Supported by Chromium media stack | Would play, but insufficient alone |
| 44.1 kHz | No identified sample-rate blocker for otherwise supported PCM | Not independently blocking |
| 48 kHz | No identified sample-rate blocker for otherwise supported PCM | Not independently blocking |
| 96 kHz | No identified sample-rate blocker for otherwise supported PCM | Not independently blocking |
| mono | No identified channel-count blocker | Not independently blocking |
| stereo | No identified channel-count blocker | Not independently blocking |
| AIFF | Not in Chromium's documented container matrix | Cross-platform reliability not established |
| MP3 | Supported by Chromium media stack | Would play, but insufficient alone |

## Platform findings

### Windows

Tauri's WebView2 path inherits the Chromium/Edge media stack. The required 24-bit integer PCM WAV case prevents the WebView-only architecture from satisfying the release matrix. AIFF support is also not established by the Chromium container matrix.

### macOS

WKWebView/WebKit provides HTML media playback and can use the platform media stack. macOS may accept more professional audio formats than Chromium/WebView2, but a macOS-only success does not solve the release requirement: the implementation must be reliable on both supported desktop platforms with the same normal JL project formats.

No macOS-only workaround is recommended because it would create inconsistent Studio behavior.

## Packaging / runtime implications

### WebView-only

- no new package dependency;
- no external runtime dependency;
- local file access can be safely scoped through Tauri's asset protocol;
- **fails required cross-platform decode coverage**.

### Native Rust

- no separate end-user executable such as ffmpeg is inherently required;
- adds Rust decoder/output dependencies and native audio stream ownership;
- requires cross-platform packaged-device testing and lifecycle/error handling;
- materially increases implementation and maintenance scope.

## Why proxy/transcode is rejected

Transcoding unsupported files to a WebView-friendly temporary format would add:

- additional I/O for large project bounces;
- temporary-file lifecycle and disk-space handling;
- latency before preview;
- NAS/cloud read amplification;
- dependency on a conversion engine;
- risk of previewing a derivative instead of the actual managed artifact.

That is explicitly outside the intended lightweight preview behavior.

## Release recommendation

**Defer preview for Studio 2.0.**

For #189, #191, #192, #193, #194 and #195:

- omit Play/Pause/progress controls during Studio 2.0 implementation;
- do not add waveform UI;
- do not add proxy/transcode playback;
- keep file rows and selected-file layouts capable of receiving playback later without redesigning the information architecture.

If preview is pursued after 2.0, create a focused native-playback feature issue that treats playback as a first-class subsystem rather than hiding it inside the common file browser.

## Validation status / caveat

This spike intentionally stops before implementing a native playback subsystem. The WebView decision is based on the authoritative rendering-engine/media support and source-code constraints above rather than claiming runtime success for unsupported formats.

A future native-playback feature must perform packaged runtime acceptance on representative real project/bounce files on both macOS and Windows, including the full #197 format matrix, before shipping.
