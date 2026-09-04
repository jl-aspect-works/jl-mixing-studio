# JL Mixing Studio 2.2 Release Acceptance Matrix

This is the source of truth for Studio 2.2 release-candidate acceptance. It supplements automated CI with packaged testing of installation, upgrade compatibility, Delivery Notes, and filesystem-based Revision and Delivered Listening on representative local/shared storage.

The first published candidate is Studio `v2.2.0-rc.1` with Automation `v2.2.0-rc.1`. The immutable release commits and packaged acceptance results are recorded below.

## Result definitions

- **Pass** — exercised using the listed packaged candidate on that platform with the expected result.
- **Fail** — exercised and did not meet the expected result; record a blocking issue.
- **Not run** — not yet exercised using the packaged candidate.
- **Deferred** — cannot practically be exercised; record the reason and supporting automated or prior evidence. Deferred does not mean Pass.

Branch/runtime verification is useful pre-RC evidence but does not automatically qualify the packaged candidate.

## Candidate test environment

| Item | Windows x64 | macOS Intel | macOS Apple Silicon |
| --- | --- | --- | --- |
| Studio candidate | `v2.2.0-rc.1` | `v2.2.0-rc.1` | `v2.2.0-rc.1` |
| Studio commit | `d17740b68dacbe8f7f9e2d8760e9563bc7902376` | `d17740b68dacbe8f7f9e2d8760e9563bc7902376` | `d17740b68dacbe8f7f9e2d8760e9563bc7902376` |
| Automation version/build | `v2.2.0-rc.1` / `01df878650a4131c0305f92f037dff3713f03409` | `v2.2.0-rc.1` / `01df878650a4131c0305f92f037dff3713f03409` | `v2.2.0-rc.1` / `01df878650a4131c0305f92f037dff3713f03409` |
| OS version | Windows 11 Pro | macOS 12.7.6 | Deferred — hardware unavailable |
| Workspace type/path | Record local/NAS/shared | Record local/NAS/shared | Deferred |
| Listening destination type/path | m:/media/Mixes | /Volumes/Media/Mixes | Deferred |
| Tester/date | Manual acceptance / 2026-09-04 | Manual acceptance / 2026-09-04 | Deferred |

At least one practically testable platform pass must use a NAS/shared workspace and NAS/shared Listening destination. Do not use Plex's displayed library metadata as the authoritative metadata test; inspect the published file directly because server agents may overlay online metadata.

Manual macOS acceptance is limited to Intel hardware for this release. All macOS Apple Silicon manual rows are **Deferred** because suitable hardware is unavailable; the published Apple Silicon package and required automated compile, Listening regression, and WKWebView evidence remain release gates.

## Pre-RC evidence already completed

| Evidence | Status | Source |
| --- | --- | --- |
| Listening settings, contextual activity, canonical filenames, metadata/artwork, legacy compatibility, and Revision/Delivered self-healing | Pass — branch/runtime | #356 manual tests 1–6 and #361 integration coverage |
| Delivery package filesystem-noise handling, including `.DS_Store` | Pass — branch/runtime | Coordinated Automation fix/verification |
| Active-project monitor performance and environment-neutral logging | Pass — branch/runtime | #365 manual tests 1–4 and CI |
| Windows, macOS Intel, and macOS Apple Silicon compile/Listening regression matrix | Pass — automated | Studio CI on merged `main` |

## A. Package, upgrade, and baseline workflow

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | Verify package checksum, install, and launch | Checksum matches; installation succeeds; Studio launches and displays the exact candidate version. | Pass | Pass | Deferred | User-reported packaged checks 1–3 |
| A02 | Upgrade from Studio 2.1.0 | Existing workspace selection and Studio settings remain intact; no unexpected reset or migration occurs. | Pass | Pass | Deferred | User-reported packaged check 2 |
| A03 | Automation discovery | Studio discovers the recorded compatible Automation provider without API/schema errors. | Pass | Pass | Deferred | User-reported packaged checks 3 and 5 |
| A04 | Existing workspace compatibility | Representative existing clients/projects/revisions/deliveries load correctly with no mutation. | Pass | Pass | Deferred | User-reported packaged checks 4 and 5 |
| A05 | Baseline Daily Workflow sanity | Create/open a project, navigate all project tabs, create/approve a revision, and inspect Delivery. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| A06 | Audio preview regression | Representative supported audio plays; pause/seek/stop and file release behave normally. | Pass | Pass | Deferred | User-reported packaged check 6 |
| A07 | Restart/persistence | Relaunch Studio; workspace, Listening configuration, and project context reload correctly. | Pass | Pass | Deferred | User-reported packaged check 6 |

## B. Delivery note capture

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| B01 | Create Delivery with a note | The dialog accepts the note; successful delivery stores and displays it in Delivery Notes. | Pass | Pass | Deferred | #336; user-verified on Windows and macOS Intel |
| B02 | Cancel Create Delivery | No delivery or note mutation occurs. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| B03 | Delivery failure safety | A failed delivery attempt preserves prior authoritative delivery/package state and does not change Delivered Listening. | Pass | Pass | Deferred | Required release gate; user-verified on Windows and macOS Intel |

## C. Listening configuration

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | Configure separate publish classes | Revision and Delivered destinations save independently and persist after restart. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| C02 | Multiple destinations/formats | Multiple enabled destinations publish only their configured required format. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| C03 | Enable/disable destination | Disabled destination is not modified; re-enabled destination reconciles from authoritative state. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| C04 | Destination validation | Empty, missing, inaccessible, unreadable, or unwritable paths show non-blocking actionable status. | Pass | Pass | Deferred | Practical cases user-verified on Windows and macOS Intel |
| C05 | Missing configured format | Destination is skipped quietly; no fallback/transcoding occurs and no error-level activity is shown. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |

## D. Revision Listening

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | Stable current-revision publish | A completed source publishes after stability observation with canonical `<project>-rev-XX.<ext>` naming. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| D02 | In-progress source change | A changing/growing source is not published until its fingerprint is stable for three observations. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| D03 | Source selection | Deterministic primary selection is used and `Variants/` is excluded from automatic selection. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| D04 | Delete published audio | The active-project monitor restores the missing Revision Listening file without a source change. | Pass | Pass | Deferred | Self-healing gate; user-verified on Windows and macOS Intel |
| D05 | Stale published audio | Replacing/changing the authoritative stable source causes the managed copy to update. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| D06 | Metadata/artwork repair | Remove or alter managed metadata/artwork/sidecars; reconciliation restores configured values. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| D07 | Contextual activity | Revision shows accurate Published/Skipped/Failed destination details only when state changes. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |

## E. Delivered Listening

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| E01 | Successful delivery publish | Successful package creation publishes canonical `<project>.<ext>` Delivered Listening content. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| E02 | Continuous self-healing | Delete the Delivered Listening file while any project tab remains open; the monitor restores it without visiting Delivery. | Pass | Pass | Deferred | Self-healing gate; user-verified on Windows and macOS Intel |
| E03 | Re-delivery replacement | Create a later valid delivery; Delivered Listening changes to the new authoritative delivery source. | Pass | Pass | Deferred | Required release gate; user-verified on Windows and macOS Intel |
| E04 | Provenance-backed source identity | New delivery `source_path` provenance selects the same primary source used by the package. | Pass | Pass | Deferred | Coordinated Automation build; user-verified on Windows and macOS Intel |
| E05 | Legacy delivery manifest | A legacy manifest uses explicit `main_mix` or a single matching top-level candidate; multiple ambiguous candidates are skipped. | Not run | Not run | Deferred |  |
| E06 | Metadata title distinction | Direct file inspection shows Revision title contains `Rev XX`; Delivered title does not contain a revision suffix. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| E07 | Contextual activity | Delivery shows accurate Published/Skipped/Failed details without recurring quiet refresh churn. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |

## F. Metadata, artwork, and source safety

Use `ffprobe` or another direct tag reader against the published Listening file. Example:

```bash
ffprobe -v error -show_entries format_tags=title,artist,album_artist,album,genre -of json "<published-file>"
```

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Replace metadata policy | Published-copy tags match project/client metadata and the Revision/Delivered title rules. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| F02 | Preserve/off metadata policy | Existing policy behavior is honored without unintended replacement. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| F03 | Embedded Studio artwork | Configured Listening copies contain the approved Studio artwork. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| F04 | Artwork sidecars | `artist.png` and `folder.png` exist under the client destination and self-heal independently. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| F05 | Source immutability | Hash/timestamp/tag inspection confirms revision sources and delivery artifacts were not modified by Listening publication. | Pass | Pass | Deferred | Required release gate; user-verified on Windows and macOS Intel |
| F06 | Media-server sanity | Optional Plex/Navidrome/folder scan sees canonical files; any server metadata overlay is recorded as a server behavior, not accepted as source-tag evidence. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |

## G. Monitor, performance, and diagnostics

| ID | Test | Expected result | Windows x64 | macOS Intel | macOS Apple Silicon | Notes / issue |
| --- | --- | --- | --- | --- | --- | --- |
| G01 | Active-project scope | Monitoring one project does not require unrelated projects to be valid and does not cause visible workspace refresh churn. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| G02 | Non-overlapping behavior | Slow NAS operations do not start concurrent monitor scans or duplicate publishers. | Pass | Pass | Deferred | Practical run/logs user-verified on Windows and macOS Intel |
| G03 | Normal info logging | Normal monitoring emits no periodic scan-duration warnings or repeated unchanged success activity. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |
| G04 | Debug timing evidence | With debug logging enabled, `listening_monitor_scan_completed` records configuration, project discovery, Revision, Delivered, and total durations. | Not run | Not run | Deferred | No fixed slow threshold |
| G05 | Failure/recovery diagnostics | Make a destination temporarily unavailable where practical; one actionable failure state and recovery are recorded without per-scan spam. | Not run | Not run | Deferred | May be Deferred with reason |
| G06 | Responsiveness sanity | Normal navigation remains responsive while monitoring a representative NAS/shared project. | Pass | Pass | Deferred | User-verified on Windows and macOS Intel |

## Release-blocking findings

Record every packaged-candidate failure before advancing. A fix requires a new immutable candidate; do not alter or reuse an existing RC tag.

| Platform | Issue | Summary | Disposition |
| --- | --- | --- | --- |
| — | — | None recorded yet | Acceptance in progress |

## Qualification decision

### Required gates

- [x] Exact Studio and Automation candidate/builds recorded.
- [x] Candidate artifacts and `SHA256SUMS.txt` published successfully.
- [ ] Windows x64 packaged acceptance passes.
- [ ] At least one packaged macOS architecture acceptance passes; unavailable architecture is explicitly Deferred with CI evidence.
- [ ] Normal NAS/shared-workspace Listening behavior passes on at least one platform.
- [ ] Revision and Delivered deletion/metadata/artwork self-healing passes.
- [ ] Failed delivery produces no Delivered Listening change.
- [ ] Re-delivery replacement passes.
- [ ] Source revision/delivery artifacts remain unchanged.
- [ ] No release-blocking finding remains open.
- [x] Final CI/release workflows are green.

**Current decision:** Not yet qualified. Published `v2.2.0-rc.1` artifacts passed baseline packaged checks 1–6 on Windows x64 and macOS Intel; feature-specific packaged acceptance is in progress.
