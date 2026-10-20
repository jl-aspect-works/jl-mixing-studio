# Native playback / Dante acceptance (#513 / #514)

Status: **Partial installed acceptance — implementation under review**. Target: Studio v2.4.
This record does not inherit #512 diagnostic or older release acceptance.
Record exact test-build commit, package, OS/architecture, Via/Controller versions,
system default, receiver and test file for every run. Compilation is not an
installed pass. Development packages retain 2.3.3 version metadata and include
BUILD.txt; identify the package by commit, not the displayed version alone.

| Installed case | Intel macOS 12.7.6 | Apple Silicon macOS | Windows 11 |
| --- | --- | --- | --- |
| Install and launch correct architecture | Pass | Not run | Pass |
| Ordinary file preview and compact preview across app surfaces | Partial pass (reported preview and compact transport; not all surfaces) | Pass (ordinary and compact previews; not all surfaces itemized) | Pass (reported ordinary and compact preview; not every surface itemized) |
| WAV16/44.1k mono, WAV24/48k stereo, float32/96k, AIFF, MP3, FLAC, AAC, M4A, MP4 | Not run | Not run | Not run |
| Pause/play, seek, end/replay, mute/volume, file release | Partial pass (all reported transport/volume/mute; file release not reported) | Partial pass (transport/seek/volume/mute; end/replay/file release not separately itemized) | Pass (feature-level transport reported; file release not separately checked) |
| Comparison candidate/region changes, looping and shortcuts | Partial pass (candidate/region/loop/seek; shortcuts not separately reported) | Partial pass (candidate/region/loop; shortcuts not separately reported) | Pass (feature-level Blind Comparison; individual shortcuts not itemized) |
| Per-region loudness matching and ranking/results unchanged | Pass (functional, not measured gain tolerance) | Pass (functional, not measured gain tolerance) | Pass (functional, not measured gain tolerance) |
| Exclusive preview/comparison ownership | Not run | Pass | Pass |
| Via individual Studio source and Controller transmitter | Pass | Deferred this run (Via unavailable; earlier reported discovery pass preserved below) | Pass (discovery only) |
| Receiver audio and stereo L/R integrity | Pass (Mac → Windows laptop Dante endpoint); physical Dante-to-analog receiver Deferred | Not run | Pass (Windows → Mac laptop Dante endpoint); physical Dante-to-analog receiver Not run |
| Chrome, notification and microphone excluded | Pass (reported end-to-end laptop Dante isolation; macOS notifications) | Not run | Pass (reported unrelated-source isolation; Windows notification case not itemized) |
| Via stop, output-device disconnect, explicit recovery | Via Stop: accepted limitation; device unplug and detailed Retry retention: accepted as built, not individually tested | Via tests deferred; unplug and detailed Retry retention: accepted as built, not individually tested | Via Stop/explicit Play: Pass; device unplug and detailed Retry retention: accepted as built, not individually tested |
| Controller route removal / receiver unavailable | Pass (subscription remove/restore to Windows laptop); physical receiver loss Not run | Not run | Pass (subscription remove/restore to Mac laptop); physical receiver loss Not run |
| Sleep/wake, no automatic restart or speaker fallback | Partial pass (sleep/wake, no auto-resume or speaker fallback in Via Stop/quit diagnostic) | Not run | Not run |
| Ordinary default-output playback without Via | Pass | Pass | Pass |

## Reported installed results and explicit v2.4 disposition

Results below are user-reported against PR #523 development package at
`0344a1838f4eb2ea41de3671ca0170b3785cb547` (not the stable 2.3.3 release).
Source check and headless tests do not establish installed acceptance.

- **Intel macOS 12.7.6:** install/launch, audible ordinary preview, individual
  Dante Via Studio source, Controller transmitter, ordinary/compact transport,
  volume/mute, candidate and region transitions, loops, functional per-region
  LUFS matching, and ranking/results passed. Sleep/wake and deliberately using
  system speakers without Via passed. Exact codecs, all app surfaces, output
  disconnect/reconnect, independent Retry candidate/region/gain/volume retention,
  exclusive playback, measured gain tolerance and physical Dante-to-analog
  receiver remain **Not run / not individually reported**; network laptop endpoint
  stereo/isolation tests passed separately below.
- **Apple Silicon macOS 27.0.1:** user-reported functional passes against
  `0344a183` for ordinary/compact previews, transport/seek/volume/mute,
  candidate/region switching and looping, functional LUFS matching and
  ranking/results, exclusive playback, and intentional non-Via speakers.
  The **install/launch qualification was explicitly Not run**, even though
  playback was exercised; do not infer installer verification. **Via discovery
  and Via stop/recovery are Deferred for this round because Dante Via was
  unavailable** on that host. An earlier Apple Silicon Studio/Via discovery
  and Controller TX pass had been reported in #514; retain that as a distinct
  historical observation, not a current-run pass. Receiver signal/isolation,
  all-codec installed testing, hardware disconnect and individual comparison
  Retry state checks remain Not run/unreported.
- **Windows 11:** user-reported nine feature-level passes on installed
  `0344a183`: installer/launch, ordinary and compact previews, Blind
  Comparison, functional per-region loudness and ranking/results, exclusive
  playback ownership, Dante Via routing, output recovery and normal Windows
  default speakers without Via. When Via stopped, Studio displayed an error
  icon/message and stopped playback; restarting Via did not automatically
  resume, and explicit Play resumed successfully. Exact codec-by-codec
  coverage, Windows sleep/wake, physical device disconnect, downstream
  physical Dante-to-analog receiver/stereo outputs, and itemized comparison
  Retry state retention remain **Not run/unreported**. Network laptop endpoint
  stereo/isolation tests passed separately below. Do not propagate results between platforms.
- **Via Stop / quit diagnostics on Intel Mac:** Via Stop silenced audio and froze
  the playhead while the Play/Pause button continued to indicate Playing, with
  no displayed error. Playback did **not** automatically resume on Via restart.
  During the specific diagnostic, fully quitting Via did not change the macOS
  default output or cause speaker audio, and clicking Via Stop did not cause
  speaker audio. A prior apparent fallback during another comparison recovery
  scenario remains *unresolved*, not established as a permitted behavior.

### End-to-end Dante laptop endpoint and source-isolation verification (2026-10-19)

User reports **Pass** for six checks using two directions: **Intel macOS
12.7.6 MacBook → Windows laptop** and **Windows laptop → Intel MacBook**:
audible receiver signal, correct stereo L/R, ordinary/compact/comparison
playback, exclusion of Chrome and macOS notifications, exclusion of microphone
and unrelated application audio, and receiver audio stop/restore when removing
and restoring the Dante Controller subscription.

These are **real network receiver endpoint and isolation passes**, not just
transmitter publication. The receiving endpoint was a **laptop**, not a physical Dante-to-analog
receiver. Therefore the **Dante AVIO / Turtle AV analog receiver and downstream
Sonos path remain untested and are explicitly Deferred until the full system
is available**. This is a user-approved non-blocking v2.4 disposition, not a
hardware Pass or a claim that the final analog path works.
The exact receiving monitor method, software versions and stereo fixture were
not separately supplied. Windows notification-specific coverage was not
individually reported. Keep the physical-hardware and other acceptance cases
independent from the successful laptop-to-laptop test.

**Physical Dante receiver deferral (2026-10-19):** User approved deferring
Dante AVIO / physical Dante-to-analog receiver and complete downstream playback
qualification until the full audio system is available. This test is **Deferred
/ not a blocker for Studio v2.4 software acceptance**. The two-way MacBook ↔
Windows laptop Dante audio, stereo identity, source isolation and Controller
subscription tests passed and provide strong software/interoperability evidence,
but **do not verify the eventual physical analog receiver, wiring or Sonos line-in**.
Revisit these exact hardware checks upon system installation; do not infer a
hardware Pass or require purchasing/configuring hardware solely for this PR.

**Additional user-confirmed v2.4 scope disposition (2026-10-19):**
Physical output-device disconnect/reconnect and detailed Blind Comparison Retry
state retention (candidate/position/region/gains/volume/mute) are **accepted as
built without additional installed qualification for v2.4**, rather than release
blockers. The implementation and existing automated recovery tests are retained
unchanged. These subcases remain **Not individually tested** on each platform;
acceptance as built is a user-approved risk disposition, **not a Pass** and not
proof of reliable behavior under every device-loss scenario. The documented
manual recovery remains the fallback. Do not schedule new code fixes, runtime
stall detection, or mandatory hands-on disconnect/Retry tests solely for this
release. This disposition does not change the intent to avoid unintended
speaker routing, and does not imply acceptance of future observed regressions.

**User-approved v2.4 acceptance exception (2026-10-19):** Retain the existing
native rodio/CPAL implementation and explicit CPAL stream-error handling.
The Via Stop case may leave a frozen playhead and stale Playing indicator
without a Studio error. This narrow behavior is **Accepted limitation**, not
Pass or a fixed bug. No progress-timeout/stall detector will be added because
false detections could disrupt comparison listening. User-approved manual
recovery: stop/close the Studio preview or comparison, restore Via and intended
system default, verify individual source/route, reopen or Retry as applicable,
and explicitly restart playback. See [recovery guidance](NATIVE_AUDIO_DANTE.md).
This Via Stop exception and the separate accepted-as-built disposition do not
change intentional no-fallback behavior or any observed functional Pass/Fail.
Physical receiver/analog output qualification remains distinct from software
routing between the two tested laptops.

## Procedure and acceptance criteria

Use [Dante setup](NATIVE_AUDIO_DANTE.md). Test ordinary, compact and comparison
playback separately, initially at low receiver volume. Without a receiving
endpoint, record discovery/TX only; signal, L/R and isolation stay Not run.
Use a stereo fixture alternating left-only and right-only passages; mono should
reach both intended stereo outputs without cross-channel swapping.

For deterministic codec fixtures, automated checks require a reported duration
within 0.9–1.2 seconds (container padding allowed), expected mono/stereo channel
count, a successful 500ms seek and nonzero samples afterward. For installed
transport, use known time markers and compare with the existing controls: paused
position must remain stable within one UI tick (250ms), and a seek should settle
within 250ms of the requested position after normal decoder preroll. Record
actual switching delay/dropouts; no measured latency or sample-accurate switching
claim is made by this release.

For gain, compare a measured -6.0206dB attenuation with an expected 0.5 amplitude
scalar (automated tolerance 0.000001); receiver measurements should agree within
0.5dB after accounting for receiver/meter resolution. Mute must produce silence.
Per-region gains change on region/candidate selection, not mid-region.

During active audio, stop Via and disconnect the selected device separately.
For Via Stop on Intel macOS 12.7.6, apply the specifically approved accepted
limitation above (stale Playing indicator/no error); manually recover using the
Dante setup guide. For a genuinely reported output stream error, require a
useful message, no automatic resume and no unintended speaker output. Restore
routing and explicitly retry. Hardware disconnect and detailed Retry state retention are documented as
accepted as built / not individually tested for v2.4, not as Pass. Also remove
only the downstream Controller subscription: Studio may continue local playback
because downstream receiver availability is not reported by the local device.
Record this distinction rather than calling it a detected-device-loss pass.

Run non-Dante default-output and Windows comparison regressions independently.
Apple Silicon needs its own installed result or an explicit user disposition;
an older hardware-unavailable disposition does not establish a v2.4 pass.
