# Native playback and Dante Via (v2.4 development)

This change is under review for #513; it is not in the published v2.3.3 packages.
Ordinary file previews, compact previews and Blind Comparison use the same
native rodio/CPAL provider on macOS and Windows. No additional audio driver,
output selector or microphone permission is required for normal playback.
Non-Dante users leave their usual system-default output selected.

## Dante setup

1. Connect the transmitting computer to wired Ethernet and start Dante Via
   before Studio. Select Dante Via as the operating system's default audio output.
2. Start the test build of Studio and play a revision or file preview.
3. In Via's Local Applications, enable **JL Mixing Studio** as an individual
   source with **Enable Dante**. Do not enable a system/all-applications mix or
   add a microphone to this route. Discovery alone does not prove isolation.
4. In Dante Controller, subscribe the Studio transmitter's left/right channels
   to the intended receiver. Start with the receiver volume low.
5. Verify actual receiver audio and stereo orientation. Independently play
   Chrome audio and a notification; neither should reach this Studio route.
   Verify the Sound Effects output separately from the default playback output.

If Studio is absent, stop playback, quit Studio, restart Via and then Studio,
then retry active playback. Record the exact source name and host/Via versions
if discovery still fails. The #512 feasibility pass used Intel macOS 12.7.6
with Via 1.4.1.3; full installed production acceptance is still pending.

## Output changes and recovery

The default device is selected when a preview/comparison session is created.
Changing the system default does not request a live Studio reroute. Stop the
preview or close the comparison before changing outputs, then start a new session.
Alternative configurations of that same device may be tried at creation; other
output devices are never tried automatically if the selected default fails.

A reported stream failure stops the session and displays an error. Restore the
intended output and Via service, then explicitly click Play again for a preview
or use the comparison's Retry action. Playback never restarts automatically.
Check the intended system default before retrying: a new session uses that
current default, which may have changed while Via was unavailable.

Studio cannot guarantee receiver delivery or know a downstream Controller
subscription was removed while the local output device continues to operate.
For that condition, inspect Via/Controller and the receiver. Device/service
loss, sleep/wake and physical isolation still require installed tests.

## Implementation and qualification

The existing command contract, exclusive playback coordination, ranking,
transport and per-region loudness gain timing are retained. Native audio uses
Symphonia decoding through rodio 0.22.2 and CPAL 0.17.3; these versions are
retained in Cargo.lock. Web media is not used as a recovery path.

Headless qualification checks nine one-second formats (WAV PCM16/44.1k mono,
WAV PCM24/48k stereo, WAV float32/96k stereo, AIFF PCM24/48k stereo, MP3,
FLAC, AAC, M4A and MP4), reported channels/duration, seek with nonzero samples,
and play/pause/mute/teardown controls. It does not prove audible signal,
bit-perfect conversion or measured device latency. The installed acceptance
record is [NATIVE_AUDIO_ACCEPTANCE.md](NATIVE_AUDIO_ACCEPTANCE.md).
