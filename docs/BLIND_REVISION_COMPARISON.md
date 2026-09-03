# Blind Revision Comparison

Status: Design locked for issue #370.

## Purpose

Blind Revision Comparison gives a mixer a structured way to compare multiple revisions without knowing which revision is playing, rank them overall and by song section, and preserve the decision history alongside the existing revision lifecycle.

The feature is intentionally designed around **N-way comparison**. Comparing three or more revisions is expected to be a normal workflow. Two-revision A/B comparison is supported, but it is not the primary design case.

A project may be evaluated through multiple blind comparison sessions over time. Those sessions contribute to **cumulative comparison standings** so repeated blind evaluations build confidence in which revisions are consistently preferred.

This feature evaluates revisions; it does not replace revision approval, delivery, or listening publication.

## Core design principles

1. **N-way first** — the data model, playback controls, ranking model, and result visualization must work naturally with 3+ revisions.
2. **Blind by default** — revision number, filename, date, approval state, delivery state, and other identity clues stay hidden until results are explicitly revealed.
3. **Project timeline / region-centric evaluation** — regions belong to the project comparison timeline, not to an individual revision. Every result belongs to a defined project region, with Full Song as the normal overall preference.
4. **Compatible timeline required** — compared revisions must share a sufficiently compatible song structure/timeline for common timestamped regions to remain meaningful. Studio does not attempt structural alignment or region remapping.
5. **Normal revisions only** — Blind Revision Comparison candidates are normal project revisions, not Variants or other alternate candidate types.
6. **Complete rankings** — every candidate must receive an explicit rank in every completed region; partial rankings are not valid completed results.
7. **Single-session completion** — a blind comparison must be completed in the active session. Unfinished comparisons are not persisted or resumable.
8. **Immutable completed rankings** — once completed, ranking results are not edited. A changed judgment is represented by a new blind comparison; an obsolete ranking/session may be explicitly deleted.
9. **Cumulative evidence** — completed blind comparison sessions contribute to aggregate project-level standings rather than the newest session replacing older results.
10. **Simple cumulative ranking** — cumulative standings use straightforward placement averaging. When cumulative results are tied, the higher-numbered (most recent) revision wins the tie.
11. **Loudness-bias reduction** — blind comparison uses playback-only loudness matching by default so louder revisions do not receive an unfair perceptual advantage.
12. **Explicit reset** — the user can clear all comparison-ranking history for a project and return the project to an unranked state.
13. **Non-destructive to audio** — comparison never alters revision source audio.
14. **Approval remains explicit** — ranking a revision first never automatically approves it.
15. **Revision History remains useful at a glance** — the normal history shows only a compact cumulative TOP signal, with full comparison details available on demand.

## Comparison Session

A Comparison Session is one blind evaluation exercise for one project.

A session contains two or more candidate revisions, a stable blind identity mapping such as A/B/C/D, one or more project evaluation regions, ranking results for each region, optional per-candidate notes, timestamps, the session loudness-match setting, measured candidate loudness/application gain data, and the original blind mapping after results are revealed.

The underlying model must not assume a maximum of two candidates. The UI should be optimized for roughly **3–5 revisions**, while allowing larger sets without an architectural redesign.

A comparison session must be completed in one active session. Studio does not persist an unfinished blind comparison for later resume. Only a completed session becomes historical comparison data and contributes to cumulative rankings.

## Candidate selection and timeline compatibility

The normal workflow should allow the user to select multiple normal revisions from Revision History and create a new comparison session.

Blind comparison assumes the selected revisions share a common enough song structure and timeline that the same project timestamps refer to the same musical material.

Locked behavior:

- candidates are **normal revisions only**;
- Variants and other alternate playback candidates are excluded from Blind Revision Comparison;
- the **user is responsible for selecting structurally compatible revisions**;
- if a revision changes arrangement, intro length, offsets, edit points, section order, or other timing enough to make project regions invalid, that revision should be excluded from that comparison;
- Studio does **not** attempt automatic structural alignment, time-warping, section detection, or region remapping between incompatible revisions;
- compatible revisions may differ slightly in total duration, for example because of fade length or trailing silence, as long as the project regions being evaluated still refer to equivalent musical material;
- any normal revision whose selected audio cannot be played by Studio is excluded from the candidate list/session rather than degrading the comparison after it starts.

## Blind identities

Each selected revision is assigned a blind identity (`A`, `B`, `C`, `D`, ...). The mapping is randomized once when the comparison session is created and remains fixed for that session. Before reveal, Studio must avoid exposing revision number, filename, dates, lifecycle status, loudness-analysis values, applied gain, or other identifying metadata.

## Project evaluation regions

Regions are **project-level comparison definitions**, not revision-level metadata. This gives all compatible revision comparisons a common timeline and allows regional results to accumulate naturally across sessions.

### Default Full Song region

Every project comparison set has:

```text
Full Song: 0:00 -> End
```

Full Song is the default overall region and requires no setup. A session's Full Song ranking is its overall result and contributes to cumulative Full Song standings.

### Additional timestamped regions

The user can add project-level timestamped regions such as:

```text
Verse 1       0:24-0:58
Chorus        0:58-1:29
Bridge        2:18-2:46
Final Chorus  2:55-4:00
```

Region names are optional. The first implementation does not require waveform rendering; start/end can be set from playback position and manually edited.

Because regions belong to the project, repeated comparison sessions reuse the same region definitions by default rather than creating unrelated region copies for each revision or session.

### Overlapping regions

**Regions may overlap.** Overlap is valid and should not be treated as a conflict.

### Region equivalence across sessions

Because regions are project-level definitions, a reused project region is automatically the same region for cumulative ranking across sessions. Studio does not need fuzzy matching by region name or timestamps.

If song structure changes enough that a project region no longer refers to the same musical material in a revision, that revision is incompatible with that comparison and should be excluded rather than trying to translate the region.

## Comparison setup and workspace UI

Blind Revision Comparison uses a two-step UI flow:

1. **New Comparison setup** from Revision History.
2. **Dedicated full-screen Comparison workspace** for listening, looping, switching, ranking, notes, and completion.

### New Comparison setup

Before the blind session begins, the setup flow:

- lets the user select 2+ eligible normal revisions;
- checks playback eligibility and timeline compatibility constraints that Studio can validate;
- performs loudness analysis when Loudness Match is enabled;
- allows the user to use existing project regions and optionally define/edit project regions;
- shows Loudness Match as `On` by default;
- excludes candidates that cannot be played or analyzed when loudness matching is required, unless the user deliberately disables Loudness Match for the entire session;
- freezes the candidate set when the comparison starts.

Once the comparison begins, candidates cannot be added or removed. Blind identities are randomized once and remain stable for the session.

### Comparison workspace

The comparison itself is a dedicated full-screen workspace rather than a modal.

The workspace contains, from top to bottom:

- session header with candidate count, active region, Loudness Match state, and Cancel;
- project region strip/tabs, including immutable Full Song plus custom regions and Add/Edit Region controls;
- active-region bounds and Loop control;
- central playback transport and seek/progress control;
- large blind candidate switching controls (`A`, `B`, `C`, `D`, ...), with keyboard shortcuts where practical;
- a clear neutral indication of the currently playing blind candidate;
- per-region ranking editor for all blind candidates;
- optional per-candidate notes directly associated with each ranked blind candidate;
- region-completion status showing which required regions are complete;
- a single terminal **Reveal & Complete Comparison** action.

The screen must not expose revision identity clues while blind, including filenames, revision numbers, dates, lifecycle state, LUFS measurements, or applied gains.

Candidate switching is one of the primary interactions and should be visually prominent. Switching candidates preserves playback position within the active project region as closely as practical.

The workspace should use the same project region identities throughout the session. Selecting a region immediately updates the playback/loop bounds.

If the user cancels/exits after entering ranking work, Studio warns that unfinished rankings and notes will be discarded. Nothing is persisted unless the session is completed.

## Playback behavior

Playback controls should make rapid N-way switching first-class. Switching candidates should preserve approximately the same playback position within the active project region. Sample-accurate DAW switching is not required.

### Supported audio

Blind comparison uses the existing Studio playback support matrix. Any audio format Studio supports for revision playback is eligible.

If Studio cannot play the audio selected for a revision, that revision is not eligible for the comparison and must be excluded before the blind session begins.

### Loudness matching — baseline requirement

**Playback-only loudness matching is required in the first release and is enabled by default for Blind Revision Comparison.**

The purpose is to reduce loudness bias without changing the source audio or altering the musical dynamics being judged.

Locked behavior:

- analyze each candidate's **Full Song integrated loudness** before the comparison begins;
- choose the **quietest candidate as the reference level**;
- calculate one fixed playback gain for every other candidate so matching requires attenuation only;
- the quietest candidate receives `0 dB` matching gain and louder candidates receive negative gain values;
- apply the same fixed per-candidate gain for Full Song and every timestamped project region;
- do **not** calculate separate region-specific gains, because section-level gain changes would alter the revision's internal dynamics and could bias the comparison;
- do **not** add gain above the original candidate level as part of matching;
- do **not** introduce limiting, compression, normalization renders, or other dynamics processing;
- source audio and published/listening copies are never modified by comparison loudness matching;
- the normal playback/output-device volume remains available independently of the comparison matching gain.

The comparison UI exposes a simple **Loudness Match** control. It defaults to `On` and may be deliberately turned `Off` before/during a session to compare original levels.

While identities are blind, Studio must not expose candidate LUFS measurements or applied gain values because they could become identity clues. After Reveal Results, completed-session detail may show the measured integrated loudness and fixed gain applied to each candidate for transparency/reproducibility.

If any selected candidate cannot be analyzed reliably for loudness matching, Studio must not silently mix matched and unmatched candidates in the same session. The user must either exclude the unanalyzable candidate or deliberately run the entire session with Loudness Match `Off`.

The session history persists whether loudness matching was enabled and, when enabled, the measured loudness and applied fixed gain for each candidate so the listening conditions of the completed ranking remain explainable.

### Region looping — baseline requirement

**Active-region looping is required in the first release of Blind Revision Comparison.**

When a project region is active, the user must be able to loop that region continuously while switching among blind candidates.

Expected behavior:

- looping is available for every region, including Full Song where practical;
- switching A/B/C/D/... while the loop is active preserves the current relative playback position as closely as practical;
- reaching the region end returns playback to the region start and continues;
- changing the active region updates the loop bounds;
- stopping/disabling loop returns playback to normal comparison playback behavior.

## Ranking model

Ranking is recorded **per project region, per comparison session** and supports ordered preference, ties, no preference, and optional notes for each candidate.

### Complete ranking requirement

**Every candidate must receive an explicit rank before a region can be completed.**

Locked behavior:

- partial rankings such as `top 3 of 5` are not valid completed results;
- no candidate may remain unranked in a completed region;
- ties are allowed and count as explicit rankings for every tied candidate;
- if the user has no preference between candidates, that outcome must still be represented explicitly rather than by leaving candidates unranked;
- a comparison session cannot be completed while any required region contains an unranked candidate;
- ties use **competition ranking**: for example `1, 2, 2, 4`, not dense ranking such as `1, 2, 2, 3`.

Competition ranking preserves the actual ordinal positions occupied by tied candidates and avoids artificially improving the numeric placement of candidates below a tie. Those numeric placements are the values used by the cumulative arithmetic-mean calculation.

### Notes

Notes are **per candidate within a region** and remain optional.

### Ranking interaction

The comparison workspace should present ranking as an ordered candidate list rather than requiring users to type numeric ranks directly.

The preferred interaction is sortable/drag-and-drop ordering with explicit tie controls. Studio derives competition-rank numbers from the resulting order/tie structure, so users do not need to manually construct sequences such as `1, 2, 2, 4`.

An explicit region-level **No Preference** action is available and means all candidates are tied for that region. This still produces a complete explicit ranking for every candidate.

### Completed ranking immutability and deletion

Once a comparison ranking is completed, its ranking values cannot be edited.

If the user changes their mind or wants to re-evaluate the revisions, they create a **new blind comparison session**. That new session contributes independently to the cumulative ranking.

A completed comparison/session may be **deleted explicitly**. Deleting it removes that session's rankings and notes from history and immediately recomputes cumulative standings without that session.

## Cumulative ranking

Comparison rankings are cumulative across applicable completed sessions.

Baseline behavior:

- each completed applicable session contributes the numeric placement recorded for each participating revision;
- a revision's cumulative placement is the **arithmetic mean of its recorded placements across the applicable completed sessions in which that revision participated**;
- lower/better cumulative placement ranks ahead of higher/worse cumulative placement;
- when cumulative placements are equal, the **higher revision number wins the tie** because it is the more recent revision;
- revision number is only a deterministic tiebreaker and otherwise adds no weighting;
- cumulative standings are derived/recomputable from preserved completed sessions;
- cumulative Full Song standings are required;
- each reusable project region uses the same arithmetic rule for cumulative regional standings;
- the UI should expose the number of contributing sessions so evidence strength is visible;
- deleting one completed session recomputes cumulative standings without that session.

### Full Song as overall preference

Within a session, Full Song is the session's overall result. Across sessions, cumulative Full Song ranking is the project's aggregate overall comparison result. Regional rankings do not get averaged into a replacement Full Song winner.

## Clearing ranking history

The user must be able to **clear the cumulative rankings for a project**. This means removing the project's blind-comparison ranking history itself, not merely clearing a cache, hiding results, or recalculating derived standings.

Locked behavior:

- provide a project-level **Clear Ranking History** action inside the **Comparison Results** view;
- place it as a secondary/destructive action rather than a prominent primary action;
- clearing removes all saved Blind Revision Comparison sessions/results for that project, including Full Song rankings, regional rankings, blind mappings, comparison notes, and persisted session loudness-match analysis/application data;
- project region definitions themselves are not ranking history and are not deleted simply because rankings are cleared;
- cumulative Full Song standings are removed;
- cumulative regional standings are removed;
- the Revision History `TOP` indicator disappears;
- comparison-history drill-down becomes empty for that project;
- future comparisons begin a new cumulative ranking history from zero;
- revision audio, revision lifecycle state, approval/delivery status, project region definitions, and all other non-comparison-history project data are unaffected;
- the action requires a normal destructive confirmation dialog; typed/project-name confirmation is not required.

Confirmation copy:

```text
Clear all blind comparison ranking history for this project?

This permanently removes all completed comparison sessions, rankings,
blind mappings, and comparison notes for this project.

Cumulative Full Song and regional standings will be cleared, and the TOP
indicator will be removed.

Revision audio, approval/delivery status, and project region definitions
will not be changed.

[Cancel] [Clear Ranking History]
```

Individual completed-session Delete actions remain with the corresponding session and are distinct from clearing all ranking history.

## Reveal workflow and results screen

Blind identities remain hidden until **Reveal & Complete Comparison**. Reveal is the completion transition: the session is finalized/persisted, then blind identities are mapped back to real revisions.

The reveal/results screen replaces the blind workspace with a dedicated results state rather than appearing as a temporary modal.

The results screen shows:

- completed-session timestamp, candidate count, and Loudness Match state;
- **Revealed Identities** mapping each blind identity to its real revision;
- Full Song ranking for the completed session;
- clear distinction between the **session winner** and the **cumulative Full Song leader/TOP**;
- contributing completed-comparison count for cumulative standings;
- regional result tabs using the same project-region identities/order used during comparison;
- each region's revealed ranking and the per-candidate notes entered while blind;
- post-reveal loudness-analysis details when Loudness Match was enabled, including measured integrated loudness and applied fixed gain;
- cumulative regional standings/evidence where available;
- explicit navigation/actions such as Back to Revision History, Open preferred revision, and Approve preferred revision.

The reveal screen must preserve the original blind identity alongside the real revision, for example `Revision 06 (B)`, so the user can connect the revealed revision to what they heard during the comparison.

Session-level and cumulative results must never be conflated. A revision may win the just-completed session without being the cumulative TOP revision.

Ranking values are read-only on the reveal screen. If the user wants to re-evaluate after reveal, they create a new comparison session.

The same results component should be reusable when opening a completed historical comparison from Comparison Results; historical sessions are displayed read-only.

A completed/revealed ranking is immutable. Any subsequent re-evaluation is a new blind session rather than an edit to the revealed result.

## Comparison session completion and persistence

Blind comparison is a **single-session workflow**.

Locked behavior:

- an unfinished comparison is not persisted for later resume;
- the user must complete all required region rankings before the session can be finalized;
- **Reveal & Complete Comparison** remains disabled until every required region has a complete explicit ranking;
- completing the comparison warns that the ranking will be finalized and revision identities revealed;
- if the user cancels, leaves the comparison, closes Studio, or otherwise exits before completion, the unfinished ranking work is discarded;
- unfinished work does not appear in comparison history;
- unfinished work does not affect cumulative Full Song or regional standings;
- only a completed session is persisted as comparison history and contributes to cumulative results.

## Comparison history

Completed comparison sessions are historical records and do not overwrite one another during normal use. History preserves date/time, candidates, blind mapping, Full Song result, regional results, per-candidate notes, whether Loudness Match was enabled, and the associated candidate loudness/gain data when matching was used.

Individual completed sessions can be explicitly deleted. **Clear Ranking History** deletes all of them at once.

## Revision History integration

### Default Revision History: TOP indicator

The normal Revision History remains primarily a lifecycle/status view. Comparison results should not add cumulative rank numbers or comparison detail to every revision row.

The revision currently first in cumulative Full Song standings receives a lightweight **TOP** pill.

Locked behavior:

- only the cumulative Full Song leader displays TOP;
- TOP is based on cumulative Full Song results;
- new comparisons contribute rather than replace prior evidence;
- when cumulative rankings tie, only the higher-numbered revision receives TOP;
- TOP is informational only and does not mean Approved, Current, Delivered, or client-preferred;
- clicking the TOP pill opens the detailed **Comparison Results** view;
- deleting a contributing session recomputes TOP as needed;
- after ranking history is cleared, no revision displays TOP until new completed comparison results exist.

### Comparison Results view

Revision History provides one dedicated **Comparison Results** action/entry point in addition to the clickable TOP pill.

The Comparison Results view includes:

- cumulative Full Song standings for all ranked revisions;
- each revision's cumulative Full Song average placement;
- contributing completed-comparison count/evidence context;
- cumulative standings for each project region;
- completed comparison-session history;
- drill-down into an individual completed session using the same read-only results component as the reveal screen;
- per-session candidates, region rankings, and per-candidate notes;
- post-reveal loudness-match details for the session when applicable;
- delete action for an individual completed comparison session;
- secondary/destructive **Clear Ranking History** action.

The default Revision History intentionally does **not** show cumulative rank numbers on every revision row.

## Regional result visualization

Studio should provide summary, timeline/ranking-strip, and exact table views using the **project timeline**. Visual encoding must not rely solely on color.

For compatible revisions with small differences such as fade length or trailing silence, the project timeline remains authoritative. A revision that is too short to support a required project region is not compatible for that comparison and should be excluded rather than silently clipping or remapping the region.

## Approval and lifecycle separation

Comparison is an evaluation tool, not an automatic project-state transition. A first-place session result or cumulative TOP result never automatically approves a revision.

## Persistence model

Blind Revision Comparison data is **project-owned Studio metadata** stored alongside the project, not in workspace-global `Studio/studio.json` and not in OS/global application storage.

Locked behavior:

- use a dedicated project-local JSON document for comparison metadata, for example `Studio/comparison.json` under the project; if implementation identifies an existing project-local Studio metadata directory convention, use that convention while keeping comparison data in its own document;
- the document has its own explicit schema/version, beginning with a version such as `1.0`;
- persist project region definitions, stable region IDs, completed comparison sessions, stable session IDs, candidate revision references, blind mappings, region rankings, per-candidate notes, completion timestamps, session Loudness Match state, and per-candidate loudness/application gain values when matching was enabled;
- use Studio's stable revision identifiers/references rather than filenames as the primary candidate identity;
- use stable UUID-style IDs for project regions and completed sessions so renaming a region does not break historical references;
- do **not** persist cumulative standings as authoritative state;
- cumulative Full Song and regional standings are always derived from completed sessions when loaded/recomputed;
- deleting one session or clearing ranking history deterministically changes derived standings without synchronizing duplicate aggregate state;
- schema upgrades are migrated forward by Studio;
- unsupported/newer schemas fail safely without modifying revision audio, Automation metadata, or unrelated project state;
- because the metadata is project-local, comparison history travels with the project when the project/workspace is moved, copied, restored, or opened on another Studio machine.

Conceptual shape:

```text
Project Comparison Document
  Schema Version
  Regions
    Stable ID
    Name
    Start / End

  Completed Comparison Sessions
    Stable ID
    Candidates (stable normal revision references)
    Blind Mapping
    Loudness Match
      Enabled
      Candidate Integrated Loudness
      Candidate Applied Gain
    Region Results
      Project Region ID
      Rankings
      Per-candidate Notes
    Completed Timestamp

Derived at runtime
  Cumulative Full Song Standings
  Cumulative Project-Region Standings
```

Comparison data remains Studio-managed evaluation metadata and must not interfere with Automation revision/source-audio behavior.

## Baseline feature scope

The current baseline includes:

- comparison sessions from 2+ normal revisions, with 3+ revisions treated as normal;
- user-selected structurally/timing-compatible revision sets;
- exclusion of unplayable candidates before session start;
- all Studio-supported revision playback formats;
- no automatic structural alignment or region remapping;
- project-level comparison timeline and regions;
- automatic Full Song region;
- timestamped custom regions;
- overlapping regions;
- dedicated New Comparison setup plus full-screen blind Comparison workspace;
- frozen candidate set once the blind session starts;
- playback-only Full Song integrated-loudness matching enabled by default;
- quietest candidate as attenuation-only loudness reference;
- one fixed loudness-match gain per candidate across every region;
- no limiting, compression, gain boosting, normalized render, or source-audio modification for loudness matching;
- day-1 active-region looping;
- randomized fixed blind mapping;
- identity-safe blind playback;
- fast position-synchronized N-way switching;
- large A/B/C/... candidate switching controls with keyboard shortcuts where practical;
- complete per-region ranking of every candidate;
- sortable ranking interaction with explicit tie controls;
- competition ranking for ties (`1, 2, 2, 4`);
- region-level No Preference as an explicit all-candidates-tied outcome;
- per-candidate notes within each region;
- region-completion status;
- explicit Reveal & Complete Comparison terminal action;
- dedicated reveal/results screen showing real revision plus original blind identity;
- explicit separation of session winner from cumulative TOP;
- reusable read-only results component for historical completed sessions;
- single-session completion; unfinished comparisons are not saved or resumable;
- immutable completed rankings;
- new session for any re-ranking/re-evaluation;
- explicit deletion of an individual completed comparison/session;
- cumulative Full Song standings using arithmetic mean placement;
- higher revision number as cumulative-placement tiebreaker;
- cumulative project-region standings;
- evidence/provenance and contributing-session counts;
- lightweight Revision History TOP pill only on the cumulative leader;
- dedicated Comparison Results view with full standings/history/session drill-down;
- project-timeline regional summary/timeline/table visualization;
- project-local versioned comparison JSON with derived-only cumulative standings;
- Comparison Results secondary/destructive Clear Ranking History action with explicit confirmation;
- no automatic approval;
- no source-audio modification.

## Follow-on / potential future scope

Potential follow-ons include formal ABX statistical testing, waveform region editing, weighted regional scoring, multiple listeners, exported/shared reports, client-facing remote blind evaluation, cloud/web-hosted comparison, sample-accurate switching, automatic structural alignment, and sophisticated statistical ranking algorithms.

## Design status

All currently identified product/design decisions required before implementation are locked. Implementation may still uncover technical details that require refinement, but those should preserve the behavior and principles defined here unless explicitly revisited.

## Relationship to existing Studio functionality

This feature builds on Studio v2.1 cross-platform playback. Blind Revision Comparison adds multiple-candidate orchestration, synchronized switching, playback-only loudness matching, project-level region control/looping, complete per-region ranking persistence, cumulative ranking derivation, result visualization, Revision History integration, individual-session deletion, and explicit comparison-history clearing.

It should not duplicate or fork core playback unless technical investigation shows the provider contract must be extended.

## Tracking

Primary issue: #370 — Enhancement: Blind Revision Comparison and regional ranking.

This document is the detailed source of truth for the feature design. The issue should remain a concise tracker and link here rather than duplicating the full specification.