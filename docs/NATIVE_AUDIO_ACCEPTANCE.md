# Native playback / Dante acceptance (#513 / #514)

Status: **Not run — implementation under review**. Target: Studio v2.4.
This record does not inherit #512 diagnostic or older release acceptance.
Record exact test-build commit, package, OS/architecture, Via/Controller versions,
system default, receiver and test file for every run. Compilation is not an
installed pass. Development packages retain 2.3.3 version metadata and include
BUILD.txt; identify the package by commit, not the displayed version alone.

| Installed case | Intel macOS 12.7.6 | Apple Silicon macOS | Windows 11 |
| --- | --- | --- | --- |
| Install and launch correct architecture | Not run | Not run | Not run |
| Ordinary file preview and compact preview across app surfaces | Not run | Not run | Not run |
| WAV16/44.1k mono, WAV24/48k stereo, float32/96k, AIFF, MP3, FLAC, AAC, M4A, MP4 | Not run | Not run | Not run |
| Pause/play, seek, end/replay, mute/volume, file release | Not run | Not run | Not run |
| Comparison candidate/region changes, looping and shortcuts | Not run | Not run | Not run |
| Per-region loudness matching and ranking/results unchanged | Not run | Not run | Not run |
| Exclusive preview/comparison ownership | Not run | Not run | Not run |
| Via individual Studio source and Controller transmitter | Not run | Not run | Not run |
| Receiver audio and stereo L/R integrity | Not run | Not run | Not run |
| Chrome, notification and microphone excluded | Not run | Not run | Not run |
| Via stop, output-device disconnect, explicit recovery | Not run | Not run | Not run |
| Controller route removal / receiver unavailable | Not run | Not run | Not run |
| Sleep/wake, no automatic restart or speaker fallback | Not run | Not run | Not run |
| Ordinary default-output playback without Via | Not run | Not run | Not run |

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
Require playback to stop with a useful error, no automatic resume and no
unintended speaker output. Restore routing and explicitly retry. Also remove
only the downstream Controller subscription: Studio may continue local playback
because downstream receiver availability is not reported by the local device.
Record this distinction rather than calling it a detected-device-loss pass.

Run non-Dante default-output and Windows comparison regressions independently.
Apple Silicon needs its own installed result or an explicit user disposition;
an older hardware-unavailable disposition does not establish a v2.4 pass.
