# JL Mixing Studio v2.4.0-rc.1 — Release Candidate

**Pre-release / installed-acceptance candidate.** This is not the v2.4 stable release; the current stable baseline remains v2.3.3 until final release approval. Source of truth for qualification: [v2.4 scope issue #515](https://github.com/jl-aspect-works/jl-mixing-studio/issues/515) and [native audio acceptance](NATIVE_AUDIO_ACCEPTANCE.md). Release availability depends on successful GitHub Actions publication.

## Changes from v2.3.3

- **Dante Via / native playback (#513, #514):** File previews, compact previews and Blind Comparison now share native rodio/CPAL audio on macOS and Windows. Studio can be enabled as a dedicated application transmitter in Dante Via, rather than routing other application audio through a system mix. Dante Controller can route its stereo channels independently. Uses the operating system's default audio output when starting a session; switching outputs requires ending and restarting playback. No automatic fallback to speakers.
- **File Reveal (#441):** Correctly select/reveal files in Windows Explorer from the Studio file tables; macOS behavior also checked.
- **Recent Revisions TOP (#439):** Show the TOP status pill on Project Overview recent revisions when applicable, styled consistently with neighboring pills.
- **Dependency qualification (#518):** Integrates the six approved compatibility-preserving updates. Four other proposed upgrades remain deferred.
- **macOS packaging (#521):** Intel and Apple Silicon application bundles receive complete ad-hoc signatures; the released DMGs undergo strict bundle-signature validation. The packages are **not Apple Developer ID signed or notarized**.

## Known limitations and acceptance boundaries

- On Intel macOS 12.7.6, stopping Dante Via during playback can silence audio/freeze the playhead without updating Studio's Playing status. This is an **accepted limitation**. Stop or close playback, restore Via/default device and Controller routing, and explicitly restart; do not rely on automatic failover. See [Dante recovery guide](NATIVE_AUDIO_DANTE.md).
- Physical Dante-to-analog receiver, Turtle AV and Sonos end-to-end testing is **Deferred**, by approval, until the full audio system is installed. Two-way laptop-to-laptop Dante receiver audio, stereo orientation and source isolation were tested; this is not a physical receiver validation.
- Actual output-device unplug/replug and itemized comparison Retry-state retention were **accepted as built, not individually installed-tested** for v2.4. The existing automated checks and manual recovery path remain.
- Exact installed codec-by-codec and all-app-surface results vary by platform. The [acceptance matrix](NATIVE_AUDIO_ACCEPTANCE.md) preserves **Pass / Partial / Not Run / Deferred** distinctions.
- Screenshot automation (#363), user guide (#362), Apple Developer ID signing/notarization (#50), and the four deferred dependency upgrades are out of scope.

## Installation and security

Get the appropriate package for **macOS Intel (x86_64)**, **macOS Apple Silicon (aarch64)**, or **Windows x64**. Verify the downloaded asset against `SHA256SUMS.txt` attached to this release; checksums establish downloaded-byte integrity, not independent developer identity. The release also provides GitHub Actions provenance attestations.

Because macOS packages are ad-hoc signed, **Gatekeeper may block first launch** and say Apple cannot verify the app is free of malware. If you trust and intentionally installed this Studio build, after a failed launch visit **System Settings → Privacy & Security → Open Anyway**, and confirm. On older macOS, select the relevant **More info** security options if offered. Do not globally disable Gatekeeper. Strict bundle signature validation has passed on development builds, but unsigned/unnotarized apps are not approved by Apple.

## Candidate acceptance and release decision

This RC must be independently installed-qualified for macOS Intel 12.7.6, Apple Silicon macOS 27.0.1 and Windows 11 using its **exact published artifacts**, including application launch and signing behavior, file dialogs/reveal, playback/comparison, Dante Via where available, dependencies, and source isolation. Automated CI and earlier development-build passes do not substitute for candidate-level testing.

**This is a candidate for testing, not approval of the v2.4 stable release.**
