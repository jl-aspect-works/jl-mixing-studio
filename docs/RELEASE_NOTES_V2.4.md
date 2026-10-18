# JL Mixing Studio v2.4 — unreleased draft

This is a development scope summary, not a published release or installer.
Current stable packages remain v2.3.3; no release tag/version is changed here.

- Windows Reveal now uses native Shell selection, including the shared file
  tables. User-reported Windows/macOS verification is recorded in
  [Reveal acceptance](WINDOWS_REVEAL_ACCEPTANCE.md).
- Project Overview Recent Revisions displays the existing cumulative TOP badge
  when available, matching the compact neighboring pills. UI approved in #439.
- Native macOS preview/compact/comparison playback is proposed in #513 using
  the shared rodio/CPAL provider. [Dante setup](NATIVE_AUDIO_DANTE.md) explains
  individual-source publication and explicit output-loss recovery. Installed
  discovery, receiver/isolation, controls and Windows regression acceptance
  remain pending in [#514's matrix](NATIVE_AUDIO_ACCEPTANCE.md).
- Six reviewed dependency proposals were integrated in #518. Their source CI
  passed; the next installed RC must still qualify the updated packages.

Screenshot automation (#363) and the user guide (#362) remain deferred.
This draft does not claim stable-release approval or completion of #513/#514.
