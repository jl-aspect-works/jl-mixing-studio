# Blind Revision Comparison

Status: Design locked for issue #370, with open implementation decisions called out explicitly below.

## Purpose

Blind Revision Comparison gives a mixer a structured way to compare multiple revisions without knowing which revision is playing, rank them overall and by song section, and preserve the decision history alongside the existing revision lifecycle.

The feature is intentionally designed around **N-way comparison**. Comparing three or more revisions is expected to be a normal workflow. Two-revision A/B comparison is supported, but it is not the primary design case.

A project may be evaluated through multiple blind comparison sessions over time. Those sessions are not isolated final answers: their results contribute to **cumulative comparison standings** so repeated blind evaluations build confidence in which revisions are consistently preferred.

This feature evaluates revisions; it does not replace revision approval, delivery, or listening publication.

## Core design principles

1. **N-way first** — the data model, playback controls, ranking model, and result visualization must work naturally with 3+ revisions.
2. **Blind by default** — revision number, filename, date, approval state, delivery state, and other identity clues stay hidden until results are explicitly revealed.
3. **Region-centric evaluation** — every result belongs to a defined song region. The default Full Song region provides the normal overall preference.
4. **Cumulative evidence** — completed blind comparison sessions contribute to aggregate project-level standings rather than the newest session replacing older results.
5. **Simple cumulative ranking** — cumulative standings use straightforward placement averaging. When cumulative results are tied, the higher-numbered (most recent) revision wins the tie.
6. **Explicit reset** — the user can clear all comparison-ranking history for a project and return the project to an unranked state.
7. **Non-destructive to audio** — comparison never alters revision source audio.
8. **Persistent history until cleared** — individual comparison sessions are historical records and are not overwritten by later comparisons or cumulative calculations, but a deliberate project-level clear action removes the ranking history.
9. **Approval remains explicit** — ranking a revision first never automatically approves it.
10. **Revision History remains useful at a glance** — the normal history shows a compact cumulative top-result signal, with richer comparison data available on demand.

## Comparison Session

A Comparison Session is a persistent evaluation exercise for one project.

A session contains two or more candidate revisions, a stable blind identity mapping such as A/B/C/D, one or more evaluation regions, ranking results for each region, optional notes, session timestamps/lifecycle state, and the original blind mapping after results are revealed.

The underlying model must not assume a maximum of two candidates. The UI should be optimized for roughly **3–5 revisions**, while allowing larger sets without an architectural redesign.

## Candidate selection

The normal workflow should allow the user to select multiple revisions from the project Revision History and create a new comparison session. Exact candidate-eligibility rules remain to be resolved before implementation, including whether revision Variants can participate directly.

## Blind identities

Each selected revision is assigned a blind identity (`A`, `B`, `C`, `D`, ...). The mapping is randomized once when the comparison session is created and remains fixed for that session. Before reveal, Studio must avoid exposing revision number, filename, dates, lifecycle status, or other identifying metadata.

## Evaluation regions

### Default Full Song region

Every comparison session starts with:

```text
Full Song: 0:00 -> End
```

The Full Song region is the default overall comparison and requires no setup. Its ranking is that session's overall preference and contributes to cumulative Full Song standings.

### Additional timestamped regions

The user can add timestamped regions such as:

```text
Verse 1       0:24-0:58
Chorus        0:58-1:29
Bridge        2:18-2:46
Final Chorus  2:55-4:00
```

Region names are optional. The first implementation does not require waveform rendering; start/end can be set from playback position and manually edited.

Regions belong to the comparison-session timeline and use the same timestamps across compared revisions.

Open region decisions include different revision timing/structure, overlapping regions, out-of-range regions, looping, and matching equivalent regions across sessions.

## Playback behavior

Playback controls should make rapid N-way switching first-class. Switching candidates should preserve approximately the same playback position within the active region. Sample-accurate DAW switching is not required. Region looping is a strong MVP candidate but remains open pending implementation cost.

## Level matching

Original-level playback is the baseline. Level-matched playback is a potential follow-on using playback-only gain; source audio is never modified.

## Ranking model

Ranking is recorded **per region, per comparison session** and supports ordered preference, ties, no preference, and optional notes. Partial-ranking semantics for larger candidate sets remain open.

### Cumulative ranking

Comparison rankings are cumulative across applicable completed sessions.

Baseline behavior:

- each completed applicable session contributes the numeric placement recorded for each participating revision;
- a revision's cumulative placement is the **arithmetic mean of its recorded placements across the applicable completed sessions in which that revision participated**;
- lower/better cumulative placement ranks ahead of higher/worse cumulative placement;
- when cumulative placements are equal, the **higher revision number wins the tie** because it is the more recent revision;
- revision number is only a deterministic tiebreaker and otherwise adds no weighting;
- individual session results remain preserved and inspectable until the user explicitly clears project ranking history;
- cumulative standings are derived/recomputable from preserved sessions;
- cumulative Full Song standings are required;
- equivalent timestamped regions may also have cumulative standings using the same arithmetic rule;
- the UI should expose the number of contributing sessions so evidence strength is visible.

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

The user must be able to **clear the cumulative rankings for a project**.

This means removing the project's blind-comparison ranking history itself, not merely clearing a cache, hiding results, or recalculating derived standings.

Locked behavior:

- provide a project-level **Clear Ranking History** action;
- clearing removes all saved Blind Revision Comparison sessions/results for that project, including Full Song rankings, regional rankings, blind mappings, and comparison notes associated with those sessions;
- cumulative Full Song standings are removed;
- cumulative regional standings are removed;
- the Revision History `TOP` indicator disappears;
- comparison-history drill-down becomes empty for that project;
- future comparisons begin a new cumulative history from zero;
- revision audio, revision lifecycle state, approval/delivery status, and all non-comparison project data are unaffected;
- the action requires an explicit destructive confirmation because the deleted comparison history cannot be reconstructed afterward.

Suggested confirmation:

```text
Clear all blind comparison ranking history for this project?

This will permanently remove all saved comparison sessions, rankings,
regional results, and comparison notes for this project.
Revision audio and project status will not be changed.

[Cancel] [Clear Ranking History]
```

Implementation should avoid ambiguous wording such as `Reset Rankings` if that could imply only clearing the derived aggregate while retaining underlying comparison sessions.

## Notes

A comparison supports optional notes. Exact note granularity remains open: region-level, per-candidate/per-region, or both.

## Reveal workflow

Blind identities remain hidden until **Reveal Results**. Reveal maps blind identities to revisions and preserves the original mapping. Whether reveal automatically finalizes a session remains open.

## Comparison history

Comparison sessions are historical records and do not overwrite one another during normal use. History preserves date/time, candidates, blind mapping, Full Song result, regional results, notes, and state. Studio exposes cumulative standings with drill-down to contributing sessions.

The explicit **Clear Ranking History** action is the exception: it intentionally deletes the project's comparison history and derived cumulative standings.

## Revision History integration

### Default Revision History: TOP indicator

The revision currently first in cumulative Full Song standings receives a lightweight **TOP** indicator. A pill is preferred over an unlabeled star.

Rules:

- TOP is based on cumulative Full Song results;
- new comparisons contribute rather than replace prior evidence;
- when cumulative rankings tie, only the higher-numbered revision receives TOP;
- TOP is informational only and does not mean Approved, Current, Delivered, or client-preferred;
- evidence strength should be discoverable, e.g. `Cumulative #1 - 4 blind comparisons`;
- after ranking history is cleared, no revision displays TOP until new comparison results exist.

### Detailed comparison overlay / mode

Revision History should provide **Show Comparison Results** or equivalent, showing cumulative Full Song rank, equivalent-region rankings, contributing session count, regional evidence, recent session result, history links, and drill-down.

The two-level information model is locked:

1. Default history — lightweight cumulative TOP result.
2. Comparison-results view — cumulative rankings, evidence context, session history, and drill-down.

## Regional result visualization

Studio should provide summary, timeline/ranking-strip, and exact table views. Visual encoding must not rely solely on color.

## Approval and lifecycle separation

Comparison is an evaluation tool, not an automatic project-state transition. A first-place session result or cumulative TOP result never automatically approves a revision. Explicit actions may offer Done, Open preferred revision, or Approve preferred revision.

## Persistence model

The persistence model should be region-centric and support N-way ranking and cumulative aggregation without redesign.

Conceptual shape:

```text
Comparison Session
  Candidates
  Blind Mapping
  Regions
    Full Song
      Rankings
      Notes
    Named/Timestamped Regions
      Rankings
      Notes
  Lifecycle / timestamps

Derived Cumulative Standings
  Full Song
    Revision standings
    Contributing session references
  Equivalent Regions
    Revision standings
    Contributing session references
```

Derived standings should be rebuildable from persisted comparison sessions. `Clear Ranking History` deletes the persisted comparison-session/history data for the project and therefore leaves nothing from which prior cumulative standings can be rebuilt.

Comparison data must not interfere with Automation revision/source-audio behavior; it is Studio-managed evaluation metadata unless a later cross-product requirement is established.

## Baseline feature scope

The current baseline includes:

- comparison sessions from 2+ revisions, with 3+ revisions treated as normal;
- automatic Full Song region;
- timestamped custom regions;
- randomized fixed blind mapping;
- identity-safe blind playback;
- fast position-synchronized N-way switching;
- per-region ranking, ties, no preference, optional notes;
- explicit Reveal Results;
- persistent comparison-session history;
- cumulative Full Song standings using arithmetic mean placement;
- higher revision number as cumulative-placement tiebreaker;
- cumulative regional standings where equivalent regions can be identified;
- evidence/provenance and contributing-session counts;
- Revision History cumulative TOP indicator;
- detailed comparison-results view and session drill-down;
- regional summary/timeline/table visualization;
- project-level destructive **Clear Ranking History** action that deletes all comparison history for the project;
- no automatic approval;
- no source-audio modification.

Region looping remains a strong MVP candidate.

## Follow-on / potential future scope

Potential follow-ons include level matching, formal ABX statistical testing, waveform region editing, weighted regional scoring, multiple listeners, exported/shared reports, client-facing remote blind evaluation, cloud/web-hosted comparison, sample-accurate switching, and sophisticated statistical ranking algorithms.

## Open decisions before implementation

1. **Regional equivalence across sessions** — matching timestamped/named regions for accumulation.
2. **Different revision timing** — handling differing duration, offsets, or structure.
3. **Region overlap** — whether regions may overlap.
4. **Region looping** — baseline vs follow-on.
5. **Ranking completeness** — complete vs partial ordering.
6. **Notes** — region-level, per-candidate/per-region, or both.
7. **Session lifecycle** — draft/in-progress/completed/revealed and resume behavior.
8. **Post-reveal editing** — whether revealed results can be edited.
9. **Candidate eligibility** — revisions only vs Variants/other candidates.
10. **Playback compatibility** — supported formats/error handling.
11. **Revision History detail density** — exact TOP and overlay interactions.
12. **Timeline reference duration** — handling candidates with different durations.
13. **Persistence schema/location** — concrete storage and migration/versioning.
14. **Clear-history confirmation UX** — exact placement and wording of the destructive project-level action.

## Relationship to existing Studio functionality

This feature builds on Studio v2.1 cross-platform playback. Blind Revision Comparison adds multiple-candidate orchestration, synchronized switching, region control, per-session ranking persistence, cumulative ranking derivation, result visualization, Revision History integration, and explicit comparison-history clearing.

It should not duplicate or fork core playback unless technical investigation shows the provider contract must be extended.

## Tracking

Primary issue: #370 — Enhancement: Blind Revision Comparison and regional ranking.

This document is the detailed source of truth for the feature design. The issue should remain a concise tracker and link here rather than duplicating the full specification.