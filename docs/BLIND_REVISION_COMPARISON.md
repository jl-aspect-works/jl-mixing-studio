# Blind Revision Comparison

Status: Design locked for issue #370, with open implementation decisions called out explicitly below.

## Purpose

Blind Revision Comparison gives a mixer a structured way to compare multiple revisions without knowing which revision is playing, rank them overall and by song section, and preserve the decision history alongside the existing revision lifecycle.

The feature is intentionally designed around **N-way comparison**. Comparing three or more revisions is expected to be a normal workflow. Two-revision A/B comparison is supported, but it is not the primary design case.

This feature evaluates revisions; it does not replace revision approval, delivery, or listening publication.

## Core design principles

1. **N-way first** — the data model, playback controls, ranking model, and result visualization must work naturally with 3+ revisions.
2. **Blind by default** — revision number, filename, date, approval state, delivery state, and other identity clues stay hidden until results are explicitly revealed.
3. **Region-centric evaluation** — every result belongs to a defined song region. The default Full Song region provides the normal overall preference.
4. **Non-destructive** — comparison never alters revision source audio.
5. **Persistent history** — comparison sessions are records of decisions and are not overwritten by later comparisons.
6. **Approval remains explicit** — ranking a revision first never automatically approves it.
7. **Revision History remains useful at a glance** — the normal history shows a compact top-result signal, with richer comparison data available on demand.

## Comparison Session

A Comparison Session is a persistent evaluation exercise for one project.

A session contains:

- two or more candidate revisions;
- a stable blind identity mapping such as A, B, C, D, ...;
- one or more evaluation regions;
- ranking results for each region;
- optional notes;
- session timestamps and lifecycle state;
- the original blind mapping after results are revealed.

The underlying model must not assume a maximum of two candidates. The UI should be optimized for roughly **3–5 revisions**, while allowing larger sets without an architectural redesign.

Large comparison sets may warrant a usability warning because listening fatigue and cognitive load increase, but this should be a UX concern rather than a hard model limitation.

## Candidate selection

The normal workflow should allow the user to select multiple revisions from the project Revision History and create a new comparison session.

Example:

```text
Create Comparison Session

Revisions:
[x] R04
[x] R05
[x] R06
[x] R07
```

The exact candidate-eligibility rules remain to be resolved before implementation, including whether revision Variants can participate directly.

## Blind identities

Each selected revision is assigned a blind identity:

```text
A  B  C  D  ...
```

The mapping is randomized **once when the comparison session is created** and remains fixed for that session. This provides useful blinding while letting the listener learn the controls and switch quickly among candidates.

The mapping does not reshuffle on every playback switch. Trial-by-trial randomization belongs to a separate formal ABX/statistical-testing workflow and is not part of this baseline design.

Before reveal, Studio must avoid exposing identity clues including:

- revision number;
- source filename;
- creation/modification date;
- approval status;
- delivery status;
- other metadata that would identify the candidate.

## Evaluation regions

### Default Full Song region

Every comparison session starts with a default region:

```text
Full Song: 0:00 -> End
```

The Full Song region is the default overall comparison and requires no setup from the user.

Its ranking is treated as the session's normal overall preference. Regional rankings provide additional context; they are not automatically averaged into a replacement overall winner.

### Additional timestamped regions

The user can add one or more timestamped regions to evaluate parts of the song independently.

Examples:

```text
Verse 1       0:24-0:58
Chorus        0:58-1:29
Bridge        2:18-2:46
Final Chorus  2:55-4:00
```

Region names are optional. An unnamed region can be displayed using its sequence and timestamps, for example:

```text
Region 2 - 2:55-4:00
```

### Initial region-editing workflow

The first implementation does not require waveform rendering.

A region can be created by:

1. playing or seeking to a position;
2. choosing **Set Region Start**;
3. playing or seeking to another position;
4. choosing **Set Region End**;
5. optionally naming the region;
6. optionally editing timestamp values manually.

Regions belong to the comparison session timeline, not to an individual candidate revision. The same timestamps are used when listening to each compared revision.

### Region questions still open

Before implementation we must decide:

- how regions behave when revisions differ materially in duration or structure;
- whether overlapping regions are allowed;
- whether a region may extend beyond the duration of one candidate;
- whether looping the active region is baseline behavior.

## Playback behavior

### N-way switching

Playback controls should make rapid switching among all candidates a first-class operation.

For four candidates, the listener might see:

```text
[A] [B] [C] [D]

Current region: Chorus
0:58-1:29
```

Keyboard shortcuts for A/B/C/D/... are desirable where they can be implemented consistently.

### Position-synchronized switching

Switching from one candidate to another should preserve approximately the same playback position within the active region.

For example, switching from B to D at 1:11 should begin D as close as practical to 1:11 rather than restarting the region or song.

This does not require sample-accurate switching in the first implementation. Provider/platform latency can differ across macOS and Windows, so the requirement is perceptually useful synchronization rather than DAW-grade sample alignment.

### Region looping

Repeatedly looping a verse, chorus, bridge, or other selected region while switching candidates is highly valuable for mix comparison. This is a strong candidate for baseline scope if it can be implemented cleanly using the existing playback architecture.

The final MVP decision remains open until implementation cost is understood.

## Level matching

Level matching is useful because louder material can be perceived as better even when the mix itself is not preferred.

However, reliable level matching introduces analysis/DSP complexity and is not required for the baseline comparison workflow.

Potential modes are:

- **Original Level** — play each revision at its source level.
- **Level Matched** — apply playback-only gain based on loudness analysis such as integrated LUFS.

No mode may modify source files.

Current design direction: **Original Level is the baseline behavior; level-matched playback is a follow-on enhancement unless implementation analysis shows it is inexpensive and reliable.**

## Ranking model

Ranking is recorded **per region**.

The model must support more than two candidates naturally.

For example:

```text
Region: Chorus

1. C
2. A
3. D
4. B
```

Ranking must support:

- ordered preference;
- ties;
- no preference;
- optional notes.

The exact semantics for partial rankings with larger candidate sets remain open. Examples to decide include whether the user can rank only a top three out of five or must provide a complete order before completing a region.

### Full Song as overall preference

The Full Song region provides the normal overall result.

Studio should **not automatically average regional rankings** to generate a different overall winner. Equal averaging could give a short region the same influence as the listener's explicit full-song judgment and could obscure the actual decision.

Regional results instead answer questions such as:

- Which revision has the best chorus?
- Did a revision win most song sections but lose overall?
- Why did the mixer prefer one revision even though another had isolated strengths?

Weighted-region scoring may be considered later.

## Notes

A comparison should support notes because rankings alone do not preserve the reasoning behind a decision.

The baseline design requires optional notes associated with regional evaluation.

The exact note granularity remains open:

- one note for the region result as a whole;
- individual notes per revision within a region;
- both.

The persistence model should avoid preventing richer notes later even if the first UI exposes only one level.

## Reveal workflow

Blind identities remain hidden until the user explicitly chooses **Reveal Results**.

Reveal maps the blind identities back to their actual revisions, for example:

```text
A = R05
B = R07
C = R06
D = R04
```

The original blind mapping must be persisted with the session history so the resulting record remains understandable and auditable.

The session should not silently reveal identity when a ranking is entered.

Open lifecycle question: whether Reveal Results automatically finalizes a session or whether a revealed session can remain editable.

## Comparison history

Comparison sessions are historical records and should not overwrite one another.

A project may therefore contain multiple sessions over time, for example:

```text
Sep 03  R04 / R05 / R06 / R07   Top: R06   4 regions
Aug 29  R02 / R03 / R04         Top: R04   Full Song
```

Comparison history should preserve at least:

- date/time;
- candidate revisions;
- blind mapping;
- Full Song result;
- regional results;
- notes;
- session state.

This history should help explain why a revision was chosen or why a project later returned to an older revision.

## Revision History integration

Comparison results should become part of the context visible from the existing Revision History rather than living only in a separate comparison screen.

### Default Revision History: TOP indicator

The normal Revision History should remain visually clean while still surfacing the most important comparison outcome.

The revision ranked first in the latest applicable completed/revealed **Full Song** comparison should receive a lightweight **TOP** indicator.

A pill is preferred over an unlabeled star because a star can be confused with Favorite, Approved, Important, or similar concepts.

Example:

```text
R07   Delivered
R06   TOP
R05
R04
```

Rules:

- the indicator is based on the latest applicable completed/revealed comparison that includes the revision;
- Full Song ranking determines the top result;
- only first-ranked revision(s) receive the indicator;
- tied first-place results may show TOP on each tied revision;
- TOP is informational only;
- TOP does not mean Approved, Current, Delivered, or Preferred by the client;
- visual styling must remain distinct from revision lifecycle/status badges.

A hover/click detail could expose compact context such as:

```text
Ranked #1 of 4 - comparison Sep 3
```

The exact interaction and density remain to be resolved during UI design.

### Detailed comparison overlay / mode

Revision History should provide a control such as **Show Comparison Results** that exposes richer information without permanently cluttering the normal view.

Potential information includes:

- Full Song rank;
- rankings by region;
- number of regional wins;
- latest comparison result;
- comparison date/session;
- icon/link to open the complete comparison session.

Example compact result data:

```text
R04   Full Song #4   Region wins 1
R05   Full Song #2   Region wins 3
R06   Full Song #1   Region wins 5
R07   Full Song #3   Region wins 2
```

The exact table/overlay layout is an implementation-design item, but the two-level information model is locked:

1. **Default history** — lightweight TOP result.
2. **Comparison-results view** — detailed rankings and drill-down.

## Regional result visualization

Once multiple regions exist, a plain ranking list is insufficient. Studio should provide complementary summary, timeline, and exact-detail views.

### Summary

A compact summary can show:

- Full Song first-place revision;
- number of regional wins by revision;
- candidate count;
- region count.

### Timeline / ranking strip

A timeline-style visualization should align region results to the song timeline so the user can quickly see where each revision performed best.

Conceptually:

- horizontal axis = song time;
- rows = compared revisions;
- timestamped regions = aligned segments;
- each segment indicates the revision's rank or result in that region.

The exact visual encoding (rank numbers, intensity, symbols, etc.) should be designed later. It must remain understandable without relying solely on color.

### Table

An exact table should show region-by-region rankings and notes.

The table is the authoritative detailed view when the visual timeline is ambiguous or when accessibility requires explicit textual values.

## Approval and lifecycle separation

Comparison is an evaluation tool, not an automatic project-state transition.

A first-place result must **not** automatically approve a revision.

After completing/revealing a comparison, Studio may offer explicit follow-up actions such as:

- Done;
- Open preferred revision;
- Approve preferred revision.

Any approval action must remain an explicit user command and use the normal revision lifecycle behavior.

## Persistence model

The persistence model should be region-centric and should support N-way ranking without redesign.

Conceptual shape:

```text
Comparison Session
  Candidates
    Revision references
  Blind Mapping
    A -> revision
    B -> revision
    C -> revision
    ...
  Regions
    Full Song
      Start / End
      Rankings
      Notes
    Verse 1
      Start / End
      Rankings
      Notes
    Chorus
      Start / End
      Rankings
      Notes
  Lifecycle / timestamps
```

The exact schema and storage location remain implementation decisions.

Comparison data must not interfere with Automation's revision/source-audio behavior. Studio should treat comparison history as Studio-managed evaluation metadata unless a cross-product requirement is later established.

## Baseline feature scope

The current baseline design includes:

- create a comparison session from 2+ revisions;
- N-way data model and UI assumptions, with 3+ revisions treated as normal;
- automatic Full Song region;
- add/edit/remove timestamped regions;
- optional region names;
- randomized fixed blind mapping per session;
- identity-safe blind playback;
- fast position-synchronized switching among candidates;
- rank candidates per region;
- ties and no-preference results;
- optional notes;
- explicit Reveal Results;
- Full Song ranking as the normal overall preference;
- persistent comparison-session history;
- default Revision History TOP indicator;
- detailed Revision History comparison-results view;
- regional summary/timeline/table visualization;
- no automatic approval;
- no source-audio modification.

Region looping should be treated as a strong MVP candidate and resolved during implementation planning.

## Follow-on / potential future scope

The following are intentionally not required by the locked baseline design unless separately promoted during planning:

- playback level matching / loudness normalization;
- formal ABX statistical testing;
- waveform-based region selection/editing;
- weighted regions or automatic aggregate scoring;
- multiple listeners/reviewers;
- exported/shared comparison reports;
- client-facing blind evaluation through the external Listening workflow;
- cloud/web-hosted comparison service;
- sample-accurate DAW-style switching.

## Open decisions before implementation

The following items remain intentionally unresolved and should be worked through before implementation issues are split:

1. **Different revision timing** — behavior when candidate revisions differ in total duration, offsets, or song structure.
2. **Region overlap** — whether timestamped regions may overlap.
3. **Region looping** — baseline requirement vs early follow-on.
4. **Ranking completeness** — complete ordering vs partial rankings for larger sets.
5. **Notes** — region-level, per-candidate/per-region, or both.
6. **Session lifecycle** — draft/in-progress/completed/revealed states, resume behavior, and whether reveal finalizes the session.
7. **Post-reveal editing** — whether revealed results can be edited and how history/audit behavior works.
8. **Candidate eligibility** — revisions only vs revision Variants and other playback candidates.
9. **Playback compatibility** — supported source formats and error handling using the existing cross-platform playback provider model.
10. **Revision History detail density** — exact TOP interaction and detailed comparison overlay layout.
11. **Timeline reference duration** — how the regional timeline is defined when candidates have different durations.
12. **Persistence schema/location** — concrete Studio-managed storage format and migration/versioning requirements.

## Relationship to existing Studio functionality

This feature builds on the cross-platform audio preview/playback architecture introduced in Studio v2.1. Existing playback remains the foundation for play/pause, seek/progress, exclusive active playback, and provider-specific behavior.

Blind Revision Comparison adds structured orchestration above that playback layer:

- multiple candidate identity management;
- synchronized switching;
- region control;
- ranking persistence;
- result visualization;
- Revision History integration.

It should not duplicate or fork the core playback implementation unless technical investigation demonstrates that the existing provider contract must be extended.

## Tracking

Primary issue: #370 — Enhancement: Blind Revision Comparison and regional ranking.

This document is the detailed source of truth for the feature design. The issue should remain a concise tracker and link here rather than duplicating the full specification.