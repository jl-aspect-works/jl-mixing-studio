# macOS Dante Via discovery spike (#512)

## Status and recommendation

**In progress; host verification required.** No Studio shipping behavior changes.
The leading hypothesis is macOS WebKit audio-process attribution, not network
discovery. Root cause and a production remedy are **not yet proven**.

The user completed the native/HTML/Web Audio comparison on macOS 12.7.6:
Via detects AVAudioPlayer but detects neither web mode. The simple Web Audio
graph remedy therefore failed on this host. Via version and chip architecture
remain unrecorded. Next test the isolated rodio/CPAL app described below. Prefer a supported
remedy preserving HTML playback if these controls establish one. If native audio
is independently discoverable while both web paths fail, the preferred next
experiment is an isolated rodio/CPAL macOS provider prototype, reusing the existing
Windows architecture. AVAudioPlayer success alone does not qualify rodio or #513.

Release: v2.4, tracked in #515. User approved starting #512 before dependency
qualification and the other scoped issues on 2026-10-17. #513 design approval
and #514 installed acceptance remain required.

## Evidence and limits

| Observation | Evidence/state | Implication |
| --- | --- | --- |
| macOS Studio audible through Via default output, but absent as a local application | User report, #512 | Rendering works; isolated publication does not |
| Chrome discoverable and publishes a transmitter on wired Mac | User report, #512 | Via/network discovery can work on that host |
| Restarting Studio did not fix discovery | User report, #512 | Repeated restart alone is not an established remedy |
| Windows Studio appears in Via and enables transmitter discovery | User report, #512 comment | Preserve Windows provider; receiver audio not yet tested |
| Full Via stop/quit/start plus Studio restart sequence | Not run as a controlled recorded case | Complete Audinate's documented sequence once |
| First diagnostic compile on both architectures | CI #2256 passed; CodeQL #50 passed | Compilation is not Via discovery or audible acceptance |
| Native vs HTML vs Web Audio diagnostic discovery | User-tested on macOS 12.7.6: native detected, both web modes absent | Proceed to isolated rodio/CPAL discovery test |
| Installed receiver signal and notification isolation | Not run | Requires physical receiving endpoint; belongs to #514 |

Record exact Mac model, architecture, macOS, Studio, Via, and Controller versions
with results. The target macOS 12.7.6 host needs its own run; macOS 15 CI does not
prove runtime compatibility on macOS 12.7.6. No Audinate support response or
vendor-confirmed WebKit limitation has been obtained.

## Repository findings

Baseline: `3f3f9c3` on `main` (already includes reviewed October dependencies).

- `src-tauri/src/commands/project_file_open_command.rs` supplies asset-authorized
  file URLs on macOS. Other desktop targets choose the native preview path.
- `src-tauri/src/commands/comparison_sources.rs` similarly selects web on macOS.
- `src/comparison/comparisonPlaybackService.ts` uses one HTMLAudioElement per
  candidate, or the existing native command interface. Region gain updates happen
  on region transitions; preserve that timing and candidate identity isolation.
- `src/project/files/AudioPreviewPlayer.tsx` and `CompactAudioPreview.tsx` already
  consume web/native provider results. Avoid independent screen-specific fixes.
- `src-tauri/src/audio_preview.rs`, `audio_preview/comparison_audio.rs`, and
  `commands/native_audio_preview_command.rs` gate native playback to Windows.
  Enabling a Cargo feature alone cannot enable native macOS Studio playback.
- `src-tauri/Cargo.toml` enables rodio decoding generally and playback only on
  Windows. A native macOS experiment must enable the playback backend and audit
  command guards, synchronization, status, and teardown; no production changes
  to these guards are made in this spike.
- The existing `scripts/macos-wkwebview-audio-probe.swift` validates metadata,
  not sustained audible playback, application discovery, or Dante routing.

## Supported non-engine remedies considered first

1. **Discovery lifecycle:** Audinate requires active playback, recommends starting
   Via before the application, and documents stopping/quitting/restarting both.
   Run this exact sequence once. Capture all source names, including helper names.
2. **Application output selection:** Via documents that selecting Via inside an
   application may be necessary. Studio currently has no such selector. WebKit
   announced HTMLMediaElement speaker selection in Safari 18.4; feature-detect
   `setSinkId` on the actual embedded WebKit. Presence alone does not prove device
   enumeration, permission, routing, or isolation on Studio's asset origin.
3. **Web Audio routing:** The diagnostic adds MediaElementAudioSourceNode and an
   AudioContext, using public APIs. It may change capture behavior but has no
   established attribution guarantee. Do not ship it merely because audio plays.
4. **Tauri configuration:** No documented application-attribution/capture switch
   was identified in the reviewed configuration reference. `macOSPrivateApi` is
   not a documented audio remedy. Do not disable process isolation or use hidden
   WebKit preferences as a production workaround.

WKWebView's separate web-content process is documented by Apple. Inferring that
this causes this Via discovery failure is a hypothesis; Chrome's differing
behavior is not proof of the specific capture mechanism or process responsible.

## Option comparison

Effort estimates are preliminary engineering days, excluding user/hardware waits.

| Option | Buildability / effort | Fidelity, latency, isolation | Dependencies / compatibility | Disposition |
| --- | --- | --- | --- | --- |
| Via lifecycle/configuration | Low; less than 1 day | Existing signal path; isolation only if source capture works | Existing Via install | Test first |
| HTML media through Web Audio | Medium; 1–3 days prototype/qualification | Additional graph; validate rate conversion, gain, switching and latency; attribution uncertain | No paid dependency; requires actual older-host test | Test diagnostic; preserve engine if successful |
| HTML output device selection | Medium; 2–4 days if supported | Dedicated destination can isolate output only if unrelated apps use another route; capture must still be proved | Embedded WebKit API and permission support; unavailable APIs need another path | Not an established macOS 12 baseline solution |
| Native rodio/CPAL provider | Medium/high; 4–8 days plus acceptance | Native Core Audio backend; test decoding, conversion, stereo, gain, seeks, buffering and transitions | Existing rodio/Symphonia; CPAL supports Core Audio; playback features/guards need work | Preferred next prototype if native control succeeds and web controls fail |
| Native AVFoundation provider | High; 5–10 days plus acceptance | Native output with Apple APIs; separate transport/gain implementation to qualify | System framework, but additional platform bridge/provider maintenance | Alternative if rodio experiment fails |
| App capture into virtual loopback | Medium setup/support; 1–3 days feasibility | App-specific capture may isolate; extra buffers, routing and feedback risks | Additional capture software/driver, licensing and OS-version constraints; no paid requirement approved | Fallback only; exact Studio capture must be demonstrated |
| System-wide virtual loopback | Low setup, poor fit | Captures unrelated apps/notifications if used as system output | Extra driver and configuration; virtual device alone does not provide app selection | Reject as default isolated solution |

Via's network format is 24-bit/48 kHz; remote hardware must use 48 kHz without
pull-up. Do not claim bit-perfect playback of 44.1/96 kHz sources through Via.
Measure/observe conversion quality, channel order, gain and switching artifacts.
CPAL/rodio output latency is device/buffer dependent; no latency measurements
have been made. A selectable Core Audio device and a published Dante source are
different capabilities; test both.

## Isolated attribution proof of concept

The app uses a distinct bundle ID and generates a quiet 48 kHz stereo test WAV
in memory: two seconds of left 440 Hz followed by two seconds of right 880 Hz,
looping. No microphone, network capture, Studio preferences or real files are
opened. It uses only public AppKit, AVFoundation and WebKit APIs.

Build on a Mac with Xcode Command Line Tools:

```bash
probe_app="$(bash scripts/build-macos-dante-probe.sh)"
open -W -n "$probe_app" --args native
open -W -n "$probe_app" --args web
open -W -n "$probe_app" --args webaudio
```

Close the app between modes; click Play for each web mode. Native begins playing
on launch. Start at a low listening level. The local build is ad-hoc signed and
targets macOS 12.0 or later; actual 12.7.6 runtime acceptance remains Not run.
CI supplies architecture-specific ZIP artifacts, containing a second ZIP with
the app. Those downloads remain unsigned for distribution/not notarized; normal
documented unsigned-app handling applies. Building locally avoids treating an
unqualified download as a production installer. Delete the generated temporary
app directory after testing; no installation or preference migration is needed.

If desired, run the app executable directly with a mode argument to see console
messages. A STARTED message is **not** a Dante PASS. The web UI initially reports
`setSinkId` and secure-context availability; record it before pressing Play.

### Controlled test sequence

1. Record host and software versions; use wired Ethernet. Leave Studio unchanged.
2. Quit Studio and the probe. Stop Via, quit its UI, reopen/start it. Ensure
   Dante Via is the default playback device. Record the selected Sound Effects
   output separately; do not assume it follows default playback.
3. Start Chrome playback as the positive control. Record the local source and
   transmitter channels after Enable Dante. Stop Chrome; avoid leaving routes
   that could be mistaken for the diagnostic source.
4. Run installed Studio playback. Record source names and whether Enable Dante
   is possible. Inspect ordinary preview and blind comparison separately.
5. Quit Studio. Run each probe mode in a fresh process. While it is playing,
   record Via source name/helper name, enable availability, Controller transmitter
   channel names, and any playback error. Inspect native, web and webaudio alike.
6. If a route appears, send it to a second Via host or receiver at 48 kHz when
   available. Verify actual tone, L/R alternation, and absence of unrelated audio
   while Chrome and a notification are deliberately played. Do not include a
   microphone in the route. Without an endpoint mark signal/isolation Not run.
7. Close the probe and restore the previous output/routing choices.

The diagnostic deliberately removes project/backend complexity. Its data URL and
plain WKWebView are not Studio's asset URL/Tauri environment. A successful web
mode must be repeated in an isolated Tauri prototype before claiming a Studio
fix; a successful native AVAudioPlayer mode must be repeated using rodio/CPAL
before approving that implementation.

| Mode | Playback | Via source / name | Controller TX | Signal / L-R | Other audio excluded |
| --- | --- | --- | --- | --- | --- |
| Chrome positive control | User-reported pass | User-reported pass | User-reported pass | Not run | Not run |
| Installed Studio preview | User-reported audible | User-reported absent | No Studio source reported | Not run | Not run |
| Installed Studio comparison | Not separately recorded | Not separately recorded | Not separately recorded | Not run | Not run |
| Native AVAudioPlayer diagnostic | Discovery reported; audibility not separately recorded | Detected (user report) | Not run | Not run | Not run |
| WKWebView HTML diagnostic | Not separately recorded | Not detected (user report) | Not run | Not run | Not run |
| WKWebView Web Audio diagnostic | Not separately recorded | Not detected (user report) | Not run | Not run | Not run |

### Second experiment: rodio/CPAL

`scripts/build-macos-dante-rodio-probe.sh` builds a separate temporary Cargo
crate with exact rodio 0.22.2 and CPAL 0.17.3, seeded from Studio's lockfile.
It does not enable macOS playback in Studio or change the production lockfile.
The generated app includes its resolved Cargo.lock and dependency tree for review.
CI compiles it on both Mac architectures and runs a decode-only fixture check.
This is a prototype resolution, not approval of a dependency update.

Start Via, select its default output, then open **JL Dante Rodio Probe.app**.
There is no window: it plays the same quiet alternating stereo tone for 60
seconds and exits. Check Local Applications while it plays and record the exact
source name. If discovered, check Enable Dante and Controller TX separately.
Log output is written to the macOS temporary directory as
`jl-dante-rodio-<PID>.log`; launching the executable from Terminal prints its path.
No microphone or user audio files are opened. Missing-device errors terminate
playback and are logged. This plain Rust bundle is not a full Tauri application;
a negative result needs an embedded-Tauri check before rejecting native Rust.

The target is macOS 12.0, but 12.7.6 runtime compatibility remains unverified for
this second app. Do not infer audible playback, discovery, or isolation from
compilation or the decode-only CI check. The current CPAL main-branch minimum
OS policy must not be substituted for the locked 0.17.3 source requirements;
review the exact dependency versions before any future upgrade.

### Decision gate

- If the documented restart sequence fixes installed Studio, qualify repeatability
  before deciding whether documentation alone satisfies #513.
- If Web Audio alone fixes discovery, prototype that change in Studio and compare
  duration, seek, gain and region/candidate transitions before design approval.
- If only native works, prototype rodio/CPAL in a separate test app/bundle first;
  evaluate all existing preview formats and comparison gain/control operations.
- If neither works, keep #512 open; collect exact versions/process evidence and
  prepare a minimal reproduction for Audinate. No support request has been sent.

For #513 design review define numeric position/gain tolerances, acceptable
switching/latency behavior, missing-device recovery and fallback policy. Do not
silently route isolated playback to speakers after a device disconnect. #514
must cover packaged preview, compact preview, comparison, loudness matching,
sleep/wake, service/device loss and Windows regressions.

## Primary references (reviewed 2026-10-17)

- [Audinate application discovery troubleshooting](https://dev.audinate.com/GA/via/userguide-1-4/webhelp/content/troubleshooting/software_sources_not_appearing.htm)
- [Audinate devices and applications](https://dev.audinate.com/GA/via/userguide-1-4/webhelp/content/devices_and_applications.htm)
- [Audinate audio format](https://dev.audinate.com/GA/via/userguide-1-4/webhelp/content/audio_format.htm)
- [Apple WKWebView process model](https://developer.apple.com/videos/play/wwdc2020/10188/)
- [WebKit Safari 18.4 features](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- [Tauri configuration reference](https://v2.tauri.app/reference/config/)
- [CPAL 0.17.3 supported platforms](https://docs.rs/crate/cpal/0.17.3/source/README.md)
- [Apple AVAudioPlayer](https://developer.apple.com/documentation/avfaudio/avaudioplayer)
- [Loopback sources and routing](https://www.rogueamoeba.com/support/manuals/loopback/?page=sources)

These sources establish supported APIs/product behavior, not the root cause of
the user's specific Studio/Via failure. Product licensing and supported versions
must be checked again before choosing a third-party capture dependency.
