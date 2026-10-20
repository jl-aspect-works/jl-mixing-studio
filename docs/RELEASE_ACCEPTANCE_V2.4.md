# Studio v2.4.0-rc.1 installed acceptance

Status: **RC1 published; installed results awaiting entry, with user-reported findings tracked below**.
Release tracker: [#515](https://github.com/jl-aspect-works/jl-mixing-studio/issues/515).
Prior development results: [native audio acceptance](NATIVE_AUDIO_ACCEPTANCE.md);
these do not automatically qualify this candidate.

## Build identity and integrity

### Verified release information

| Field | Value |
| --- | --- |
| Product / candidate | JL Mixing Studio **2.4.0-rc.1** |
| Release tag | `v2.4.0-rc.1` |
| Release URL | [Published RC1](https://github.com/jl-aspect-works/jl-mixing-studio/releases/tag/v2.4.0-rc.1) |
| Published | 2026-10-20 07:41:30 EDT / 2026-10-20 11:41:30 UTC |
| Release classification | Published prerelease; native release immutability enabled |
| Tagged source commit | `bbb238b87428be1492258faf8aa93a69795841b3` |
| Release preparation | [PR #533](https://github.com/jl-aspect-works/jl-mixing-studio/pull/533), merged |
| Release build / publication | [Release #43, run 39412640692](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/39412640692), **Pass**, exact tagged source |
| Post-merge source CI | [Run 39411243231](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/39411243231), **Pass**, including Required CI |
| Post-merge CodeQL | [Run 39411243230](https://github.com/jl-aspect-works/jl-mixing-studio/actions/runs/39411243230), **Pass** |
| Build provenance | [Attestation 57768665](https://github.com/jl-aspect-works/jl-mixing-studio/attestations/57768665), all three installers plus checksum manifest |
| Release immutability attestation | [57768691](https://github.com/jl-aspect-works/jl-mixing-studio/attestations/57768691) |
| macOS signing policy | Complete ad-hoc application signing; **not Developer ID signed or notarized** (#50 deferred) |
| Installed app path for macOS checks | `/Applications/JL Mixing Studio.app` (adjust command if installed elsewhere) |
| Studio stable baseline | `v2.3.3`; RC publication does not promote stable |
| Automation reference baseline | [Automation v2.3.3](https://github.com/jl-aspect-works/jl-mixing-automation/releases/tag/v2.3.3); fill actual installed version below |

Both released DMGs passed strict application-bundle signature verification inside
the DMG in the Release workflow. All installer checksums and attestation generation
passed in that workflow. These are **publication/source checks**, not installed
acceptance results on the user's three hosts.

### Published packages and expected hashes

The links and SHA-256 values below identify the immutable RC1 assets. An expected
hash is not a claim that the user has verified their downloaded copy.

| Target | Published asset | Size (bytes) | Expected SHA-256 |
| --- | --- | ---: | --- |
| Intel macOS | [JL-Mixing-Studio_2.4.0-rc.1_macos_x86_64.dmg](https://github.com/jl-aspect-works/jl-mixing-studio/releases/download/v2.4.0-rc.1/JL-Mixing-Studio_2.4.0-rc.1_macos_x86_64.dmg) | 13,000,378 | `d4ab9b5f1b84bac300d9940aed90d04966f72ab555cc398258dd1928e4aed5bb` |
| Apple Silicon macOS | [JL-Mixing-Studio_2.4.0-rc.1_macos_aarch64.dmg](https://github.com/jl-aspect-works/jl-mixing-studio/releases/download/v2.4.0-rc.1/JL-Mixing-Studio_2.4.0-rc.1_macos_aarch64.dmg) | 12,482,421 | `6b2a2499b94adf268889d1ccc5f364e4138a141339bfab4dd52f177c7aafdbd7` |
| Windows x64 | [JL-Mixing-Studio_2.4.0-rc.1_windows_x86_64.exe](https://github.com/jl-aspect-works/jl-mixing-studio/releases/download/v2.4.0-rc.1/JL-Mixing-Studio_2.4.0-rc.1_windows_x86_64.exe) | 7,870,248 | `a282c16b976f9380406ba52d93c6deccfaa4b3d173b26d312db29ef7622ab1a9` |
| Checksum manifest | [SHA256SUMS.txt](https://github.com/jl-aspect-works/jl-mixing-studio/releases/download/v2.4.0-rc.1/SHA256SUMS.txt) | 336 | `d59dd55418ee65296723268daaae71ccdffd0c25f8b9a1d07493407a143d1265` |

### Test setup — user to complete independently for each platform

Replace each `[TO FILL: ...]` entry with the actual value, or `N/A — reason`.
The column headings identify target hosts; confirm the actual tested OS and
architecture rather than treating a heading as a test result.

| Field | Intel macOS 12.7.6 target | Apple Silicon macOS 27.0.1 target | Windows 11 x64 target |
| --- | --- | --- | --- |
| Tester and test date/time | [TO FILL: tester, date/time] | [TO FILL: tester, date/time] | [TO FILL: tester, date/time] |
| Host description / hardware | [TO FILL: host/model] | [TO FILL: host/model] | [TO FILL: host/model] |
| Actual OS version/build and architecture | [TO FILL: confirm OS/build, x86_64] | [TO FILL: confirm OS/build, arm64] | [TO FILL: Windows version/build, x64] |
| Installer used | Intel DMG linked above; [TO FILL: confirm exact file used] | Apple Silicon DMG linked above; [TO FILL: confirm exact file used] | Windows x64 EXE linked above; [TO FILL: confirm exact file used] |
| Install method and installed location | [TO FILL: fresh/upgrade, location] | [TO FILL: fresh/upgrade, location] | [TO FILL: fresh/upgrade, location] |
| Studio displayed version | [TO FILL: observed version; expected 2.4.0-rc.1] | [TO FILL: observed version; expected 2.4.0-rc.1] | [TO FILL: observed version; expected 2.4.0-rc.1] |
| Downloaded checksum / attestation verification | [TO FILL: actual result/evidence] | [TO FILL: actual result/evidence] | [TO FILL: actual result/evidence] |
| Installed signature / first-launch behavior | [TO FILL: codesign result, Gatekeeper behavior] | [TO FILL: codesign result, Gatekeeper behavior] | [TO FILL: installer/launch prompts, if any] |
| Actual Automation version/API | [TO FILL: actual version/API] | [TO FILL: actual version/API] | [TO FILL: actual version/API] |
| Workspace / project fixture | [TO FILL: fixture/reference] | [TO FILL: fixture/reference] | [TO FILL: fixture/reference] |
| Dante Via version / availability | [TO FILL: actual version] | Deferred while Via unavailable; [TO FILL: confirm availability] | [TO FILL: actual version] |
| Dante Controller version | [TO FILL: actual version] | [TO FILL: actual version or N/A] | [TO FILL: actual version] |
| Default audio output at session start | [TO FILL: device] | [TO FILL: device] | [TO FILL: device] |
| Network and receiving endpoint | [TO FILL: Ethernet, receiver laptop, monitoring method] | [TO FILL: actual setup or N/A] | [TO FILL: Ethernet, receiver laptop, monitoring method] |
| Audio fixtures / formats / sample rates | [TO FILL: actual test files/specs] | [TO FILL: actual test files/specs] | [TO FILL: actual test files/specs] |
| UI viewport / display scaling | [TO FILL: window dimensions, scaling] | [TO FILL: window dimensions, scaling] | [TO FILL: window dimensions, scaling] |

### Ready-to-run verification commands

Run from the directory containing the downloaded installer. Compare the checksum
output with the expected hash above or the downloaded `SHA256SUMS.txt`.
GitHub CLI (`gh`) is required for the provenance commands. Record actual outcomes
in the setup table and candidate matrix.

Intel macOS:

```bash
shasum -a 256 "JL-Mixing-Studio_2.4.0-rc.1_macos_x86_64.dmg"
gh attestation verify "JL-Mixing-Studio_2.4.0-rc.1_macos_x86_64.dmg" --repo jl-aspect-works/jl-mixing-studio
codesign --verify --deep --strict --verbose=2 "/Applications/JL Mixing Studio.app"
```

Apple Silicon macOS:

```bash
shasum -a 256 "JL-Mixing-Studio_2.4.0-rc.1_macos_aarch64.dmg"
gh attestation verify "JL-Mixing-Studio_2.4.0-rc.1_macos_aarch64.dmg" --repo jl-aspect-works/jl-mixing-studio
codesign --verify --deep --strict --verbose=2 "/Applications/JL Mixing Studio.app"
```

Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath ".\JL-Mixing-Studio_2.4.0-rc.1_windows_x86_64.exe"
gh attestation verify "JL-Mixing-Studio_2.4.0-rc.1_windows_x86_64.exe" --repo jl-aspect-works/jl-mixing-studio
```

- Run the macOS `codesign` check **after installation**, against the installed app.
- Gatekeeper **Open Anyway** may be needed under the approved ad-hoc signing policy.
- Record actual results independently; do not copy prior development-build passes.

## Candidate matrix

| Check | Intel macOS 12.7.6 | Apple Silicon macOS 27.0.1 | Windows 11 x64 |
| --- | --- | --- | --- |
| Checksum and provenance verified | Not Run | Not Run | Not Run |
| Correct installer, upgrade/install, launch, version, relaunch | Not Run | Not Run | Not Run |
| Strict installed bundle signature | Not Run | Not Run | N/A |
| Workspace discovery, client/project load and schema validation | Not Run | Not Run | Not Run |
| Native open/save/folder dialogs; clipboard copy/paste | Not Run | Not Run | Not Run |
| Reveal selects intended file across Client Files, Audio Prep, Revisions, Delivery and Files; spaces/Unicode paths | Not Run | Not Run | Not Run |
| Recent Revisions TOP pill present when applicable, consistent style; non-TOP unchanged | Not Run | Not Run | Not Run |
| Ordinary and compact previews across app surfaces: audible, play/pause/seek/end/replay, mute/volume, file release | Not Run | Not Run | Not Run |
| Exclusive preview/comparison playback ownership | Not Run | Not Run | Not Run |
| Blind Comparison: candidate/region changes, loops, seek, shortcuts, ranking/results save/reopen | Not Run | Not Run | Not Run |
| Per-region loudness matching on candidate/region transitions | Not Run | Not Run | Not Run |
| Normal default-output playback without Via | Not Run | Not Run | Not Run |
| Via Studio source and Controller stereo transmitter; wired routing to laptop endpoint | Not Run | Deferred while Via unavailable | Not Run |
| Receiver audibility, L/R identity and unrelated-app/microphone isolation | Not Run (laptop endpoint) | Deferred while Via unavailable | Not Run (laptop endpoint) |
| Controller subscription remove/restore | Not Run | Deferred while Via unavailable | Not Run |
| Via interruption and explicit recovery without automatic replay | Accepted Limitation: Via Stop may freeze playhead/Playing; record manual recovery | Deferred while Via unavailable | Not Run |
| Sleep/wake, no automatic replay or unintended speaker output | Not Run | Not Run | Not Run |

Dependency regression coverage includes the dialogs, clipboard, schema/discovery,
frontend operation and playback/comparison rows. Exercise representative WAV/AIFF/
compressed files; record exact formats and any untested codec cases separately.
The detailed nine-format development matrix remains in NATIVE_AUDIO_ACCEPTANCE.md;
do not mark all codecs passed based on one file.

## Preserved approved dispositions

- Intel Via Stop frozen playhead/stale Playing: **Accepted Limitation**.
  Stop/close playback, restore Via/default output and routing, then explicitly restart.
  No new timeout/stall detector is required.
- Physical output unplug/replug and itemized comparison Retry state retention:
  **Accepted as built / Not individually tested** on all hosts.
- Physical Turtle AV/Dante AVIO analog receiver, wiring and downstream Sonos:
  **Deferred until complete system installation; non-blocking**.
- Apple Silicon Via checks remain **Deferred while unavailable**; earlier discovery
  observations remain historical evidence, not candidate passes.
- Other unexecuted checks remain Not Run/Partial until reported or explicitly dispositioned.
- Stable v2.4.0 requires completed candidate qualification and separate explicit user approval.

## Results and decision

### User-reported RC1 findings

| Issue | Reported observation | Platform / retest details |
| --- | --- | --- |
| [#534](https://github.com/jl-aspect-works/jl-mixing-studio/issues/534) | Recent Revisions TOP pill repeatedly disappears and reappears | [TO FILL: affected host, reproduction details and retest result] |
| [#535](https://github.com/jl-aspect-works/jl-mixing-studio/issues/535) | Mixed pill capitalization; user requires all pills uppercase to match Revision History | [TO FILL: affected views/host and retest result] |
| [#536](https://github.com/jl-aspect-works/jl-mixing-studio/issues/536) | Main content stops expanding on large desktop displays | [TO FILL: affected host, viewport/scaling and retest result] |

These findings were reported against RC1. The affected platforms were not specified
in those reports, so they have not been copied into all platform result cells.
`Not Run` in the matrix means a result has not yet been recorded there; it does
not dismiss the reported findings.

### User result entry and release decision

- Intel macOS summary: [TO FILL: results, evidence and remaining cases].
- Apple Silicon macOS summary: [TO FILL: results, evidence and remaining cases].
- Windows summary: [TO FILL: results, evidence and remaining cases].
- Additional failures / issue references: [TO FILL: details or None reported].
- Remaining Not Run / Partial cases requiring disposition: [TO FILL: cases and decision].
- RC acceptance recommendation: [TO FILL: accept, reject or pending, with reasons].
- Explicit stable-promotion approval: **Not granted**; [TO FILL: user approval reference/date only when explicitly provided].

Publication is not installed acceptance. Preserve all approved dispositions above.
Any fixes must use a subsequent candidate; the published RC1 tag and assets remain immutable.
