# Blind Revision Comparison

Status: Design locked for issue #370, with open implementation decisions called out explicitly below.

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
7. **Immutable completed rankings** — once completed, ranking results are not edited. A changed judgment is represented by a new blind comparison; an obsolete ranking/session may be explicitly deleted.
8. **Cumulative evidence** — completed blind comparison sessions contribute to aggregate project-level standings rather than the newest session replacing older results.
9. **Simple cumulative ranking** — cumulative standings use straightforward placement averaging. When cumulative results are tied, the higher-numbered (most recent) revision wins the tie.
10. **Explicit reset** — the user can clear all comparison-ranking history for a project and return the project to an unranked state.
11. **Non-destructive to audio** — comparison never alters revision source audio.
12. **Approval remains explicit** — ranking a revision first never automatically approves it.
13. **Revision History remains useful at a glance** — the normal history shows a compact cumulative top-result signal, with richer comparison data available on demand.

## Comparison Session

A Comparison Session is one persistent blind evaluation exercise for one project.

A session contains two or more candidate revisions, a stable blind identity mapping such as A/B/C/D, one or more project evaluation regions, ranking results for each region, optional per-candidate notes, timestamps/state, and the original blind mapping after results are revealed.

The underlying model must not assume a maximum of two candidates. The UI should be optimized for roughly **3–5 revisions**, while allowing larger sets without an architectural redesign.

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

Each selected revision is assigned a blind identity (`A`, `B`, `C`, `D`, ...). The mapping is randomized once when the comparison session is created and remains fixed for that session. Before reveal, Studio must avoid exposing revision number, filename, dates, lifecycle status, or other identifying metadata.

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

This supports both broad and focused evaluations, for example:

```text
Chorus        0:58-1:29
Vocal Entry   1:04-1:14
```

The smaller Vocal Entry region is intentionally contained within the larger Chorus region and can have its own ranking.

### Region equivalence across sessions

Because regions are project-level definitions, a reused project region is automatically the same region for cumulative ranking across sessions. Studio does not need fuzzy matching by region name or timestamps.

If song structure changes enough that a project region no longer refers to the same musical material in a revision, that revision is incompatible with that comparison and should be excluded rather than trying to translate the region.

## Playback behavior

Playback controls should make rapid N-way switching first-class. Switching candidates should preserve approximately the same playback position within the active project region. Sample-accurate DAW switching is not required.

### Supported audio

Blind comparison uses the existing Studio playback support matrix. Any audio format Studio supports for revision playback is eligible.

If Studio cannot play the audio selected for a revision, that revision is not eligible for the comparison and must be excluded before the blind session begins. The session should not knowingly begin with an unplayable candidate.

### Region looping — baseline requirement

**Active-region looping is required in the first release of Blind Revision Comparison.**

When a project region is active, the user must be able to loop that region continuously while switching among blind candidates.

Expected behavior:

- looping is available for every region, including Full Song where practical;
- switching A/B/C/D/... while the loop is active preserves the current relative playback position as closely as practical;
- reaching the region end returns playback to the region start and continues;
- changing the active region updates the loop bounds;
- stopping/disabling loop returns playback to normal comparison playback behavior.

## Level matching

Original-level playback is the baseline. Level-matched playback is a potential follow-on using playback-only gain; source audio is never modified.

## Ranking model

Ranking is recorded **per project region, per comparison session** and supports ordered preference, ties, no preference, and optional notes for each candidate.

### Complete ranking requirement

**Every candidate must receive an explicit rank before a region can be completed.**

Locked behavior:

- partial rankings such as `top 3 of 5` are not valid completed results;
- no candidate may remain unranked in a completed region;
- ties are allowed and count as explicit rankings for every tied candidate;
- if the user has no preference between candidates, that outcome must still be represented explicitly rather than by leaving candidates unranked;
- a comparison session cannot be completed while any required region contains an unranked candidate.

The exact numeric rank sequence used after a tie (for example competition vs dense ranking) remains an implementation detail, but it must produce deterministic numeric placements suitable for cumulative arithmetic-mean calculation.

### Notes

Notes are **per candidate within a region**.

For example, the Chorus region can contain separate notes for A, B, C, and D. This lets the user preserve why a candidate was ranked where it was instead of reducing the whole regional judgment to one shared note.

Notes remain optional. Before reveal they are associated with the blind identity; after reveal they remain attached to the mapped revision in the historical session.

### Completed ranking immutability and deletion

Once a comparison ranking is completed, its ranking values cannot be edited.

If the user changes their mind or wants to re-evaluate the revisions, they create a **new blind comparison session**. That new session contributes independently to the cumulative ranking.

A completed comparison/session may be **deleted explicitly**. Deleting it removes that session's rankings and notes from history and immediately recomputes cumulative standings without that session.

This is different from **Clear Ranking History**, which deletes all comparison sessions for the project.

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

Example:

```text
Session 1: R05 = #1, R06 = #2
Session 2: R05 = #2, R06 = #1

R05 cumulative placement = (1 + 2) / 2 = 1.5
R06 cumulative placement = (2 + 1) / 2 = 1.5

1. R06   <- higher revision number wins tie
2. R05
```

A sophisticated Elo/pairwise/statistical ranking model is explicitly unnecessary unless future use demonstrates a concrete need.

### Full Song as overall preference

Within a session, Full Song is the session's overall result. Across sessions, cumulative Full Song ranking is the project's aggregate overall comparison result. Regional rankings do not get averaged into a replacement Full Song winner.

## Clearing ranking history

The user must be able to **clear the cumulative rankings for a project**. This means removing the project's blind-comparison ranking history itself, not merely clearing a cache, hiding results, or recalculating derived standings.

Locked behavior:

- provide a project-level **Clear Ranking History** action;
- clearing removes all saved Blind Revision Comparison sessions/results for that project, including Full Song rankings, regional rankings, blind mappings, and comparison notes associated with those sessions;
- project region definitions themselves are not ranking history and therefore do not need to be deleted simply because rankings are cleared;
- cumulative Full Song standings are removed;
- cumulative regional standings are removed;
- the Revision History `TOP` indicator disappears;
- comparison-history drill-down becomes empty for that project;
- future comparisons begin a new cumulative ranking history from zero;
- revision audio, revision lifecycle state, approval/delivery status, project region definitions, and all other non-comparison-history project data are unaffected;
- the action requires an explicit destructive confirmation because the deleted comparison history cannot be reconstructed afterward.

## Reveal workflow

Blind identities remain hidden until **Reveal Results**. Reveal maps blind identities to revisions and preserves the original mapping in history.

A completed/revealed ranking is immutable. Any subsequent re-evaluation is a new blind session rather than an edit to the revealed result.

## Comparison session state and resume behavior

The only remaining lifecycle question is whether an **unfinished** comparison should be persistently resumable.

The product need behind this question is practical rather than conceptual: a user may define candidates/regions and rank some regions, then leave Studio before finishing. We need to decide whether that work is saved as an in-progress session or discarded unless completed.

We do **not** need a complex public state machine merely for its own sake. If resumable sessions are supported, a simple model such as `In Progress` and `Completed/Revealed` should be sufficient unless implementation exposes another real need.

## Comparison history

Completed comparison sessions are historical records and do not overwrite one another during normal use. History preserves date/time, candidates, blind mapping, Full Song result, regional results, per-candidate notes, and relevant state.

Studio exposes cumulative standings with drill-down to contributing sessions.

Individual completed sessions can be explicitly deleted. **Clear Ranking History** deletes all of them at once.

## Revision History integration

### Default Revision History: TOP indicator

The revision currently first in cumulative Full Song standings receives a lightweight **TOP** indicator. A pill is preferred over an unlabeled star.

Rules:

- TOP is based on cumulative Full Song results;
- new comparisons contribute rather than replace prior evidence;
- when cumulative rankings tie, only the higher-numbered revision receives TOP;
- TOP is informational only and does not mean Approved, Current, Delivered, or client-preferred;
- evidence strength should be discoverable, e.g. `Cumulative #1 - 4 blind comparisons`;
- deleting a contributing session recomputes TOP as needed;
- after ranking history is cleared, no revision displays TOP until new completed comparison results exist.

### Detailed comparison overlay / mode

Revision History should provide **Show Comparison Results** or equivalent, showing cumulative Full Song rank, project-region rankings, contributing session count, regional evidence, recent session result, history links, and drill-down.

The two-level information model is locked:

1. Default history — lightweight cumulative TOP result.
2. Comparison-results view — cumulative rankings, evidence context, session history, and drill-down.

The exact visual density and interactions remain an implementation/UI design item.

## Regional result visualization

Studio should provide summary, timeline/ranking-strip, and exact table views using the **project timeline**. Visual encoding must not rely solely on color.

The timeline is not based on whichever revision happens to be playing. Revisions are candidates interpreted against the project's common comparison timeline.

For compatible revisions with small differences such as fade length or trailing silence, the project timeline remains authoritative. A revision that is too short to support a required project region is not compatible for that comparison and should be excluded rather than silently clipping or remapping the region.

## Approval and lifecycle separation

Comparison is an evaluation tool, not an automatic project-state transition. A first-place session result or cumulative TOP result never automatically approves a revision. Explicit actions may offer Done, Open preferred revision, or Approve preferred revision.

## Persistence model

The persistence model should support project-level regions, N-way ranking, immutable completed sessions, deletion, and cumulative aggregation without redesign.

Conceptual shape:

```text
Project Comparison Data
  Regions
    Full Song
    Named/Timestamped Regions

  Comparison Sessions
    Candidates (normal revision references)
    Blind Mapping
    Region Results
      Project Region reference
      Rankings
      Per-candidate Notes
    State / timestamps

Derived Cumulative Standings
  Full Song
    Revision standings
    Contributing session references
  Project Regions
    Revision standings
    Contributing session references
```

Derived standings should be rebuildable from persisted completed sessions. Deleting a session or clearing history therefore deterministically changes the derived standings.

Comparison data must not interfere with Automation revision/source-audio behavior; it is Studio-managed evaluation metadata unless a later cross-product requirement is established.

## Baseline feature scope

The current baseline includes:

- comparison sessions from 2+ normal revisions, with 3+ revisions treated as normal;
- user-selected structurally/timing-compatible revision sets;
- exclusion of unplayable candidates before session start;
- all Studio-supported revision playback formats;
- no automatic structural alignment or region remapping;
- **project-level comparison timeline and regions**;
- automatic Full Song region;
- timestamped custom regions;
- overlapping regions;
- day-1 active-region looping;
- randomized fixed blind mapping;
- identity-safe blind playback;
- fast position-synchronized N-way switching;
- complete per-region ranking of every candidate;
- ties and explicit no-preference outcomes;
- **per-candidate notes within each region**;
- explicit Reveal Results;
- immutable completed rankings;
- new session for any re-ranking/re-evaluation;
- explicit deletion of an individual completed comparison/session;
- cumulative Full Song standings using arithmetic mean placement;
- higher revision number as cumulative-placement tiebreaker;
- cumulative project-region standings;
- evidence/provenance and contributing-session counts;
- Revision History cumulative TOP indicator;
- detailed comparison-results view and session drill-down;
- project-timeline regional summary/timeline/table visualization;
- project-level destructive **Clear Ranking History** action that deletes all comparison history for the project;
- no automatic approval;
- no source-audio modification.

## Follow-on / potential future scope

Potential follow-ons include level matching, formal ABX statistical testing, waveform region editing, weighted regional scoring, multiple listeners, exported/shared reports, client-facing remote blind evaluation, cloud/web-hosted comparison, sample-accurate switching, automatic structural alignment, and sophisticated statistical ranking algorithms.

## Open decisions before implementation

1. **Tie rank numbering** — exact numeric placement convention after ties, which must remain deterministic for cumulative averaging.
2. **Unfinished-session persistence** — whether an in-progress comparison is automatically saved/resumable or must be completed in one session.
3. **Revision History detail density** — exact TOP and comparison-results overlay interactions/layout.
4. **Persistence schema/location** — concrete storage format, location, migration, and versioning.
5. **Clear-history confirmation UX** — exact placement and wording of the destructive project-level action.

## Relationship to existing Studio functionality

This feature builds on Studio v2.1 cross-platform playback. Blind Revision Comparison adds multiple-candidate orchestration, synchronized switching, project-level region control/looping, complete per-region ranking persistence, cumulative ranking derivation, result visualization, Revision History integration, individual-session deletion, and explicit comparison-history clearing.

It should not duplicate or fork core playback unless technical investigation shows the provider contract must be extended.

## Tracking

Primary issue: #370 — Enhancement: Blind Revision Comparison and regional ranking.

This document is the detailed source of truth for the feature design. The issue should remain a concise tracker and link here rather than duplicating the full specification.