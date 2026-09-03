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
5. **Simple cumulative ranking** — cumulative standings should be understandable without a complex statistical model. When cumulative results are tied, the higher-numbered (most recent) revision wins the tie.
6. **Non-destructive** — comparison never alters revision source audio.
7. **Persistent history** — individual comparison sessions are records of decisions and are never overwritten by later comparisons or by cumulative calculations.
8. **Approval remains explicit** — ranking a revision first never automatically approves it.
9. **Revision History remains useful at a glance** — the normal history shows a compact cumulative top-result signal, with richer comparison data available on demand.

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

Before reveal, Studio must avoid exposing identity clues including revision number, source filename, creation/modification date, approval status, delivery status, and other metadata that would identify the candidate.

## Evaluation regions

### Default Full Song region

Every comparison session starts with a default region:

```text
Full Song: 0:00 -> End
```

The Full Song region is the default overall comparison and requires no setup from the user. Its ranking is treated as that session's overall preference and contributes to the project's cumulative Full Song standings. Regional rankings provide additional context and contribute to cumulative standings for equivalent regions, but regional rankings are not automatically averaged into a replacement Full Song result.

### Additional timestamped regions

The user can add one or more timestamped regions to evaluate parts of the song independently.

Examples:

```text
Verse 1       0:24-0:58
Chorus        0:58-1:29
Bridge        2:18-2:46
Final Chorus  2:55-4:00
```

Region names are optional. An unnamed region can be displayed using its sequence and timestamps, for example `Region 2 - 2:55-4:00`.

### Initial region-editing workflow

The first implementation does not require waveform rendering. A region can be created by playing/seeking to a position, setting the region start, playing/seeking to another position, setting the region end, optionally naming the region, and optionally editing timestamps manually.

Regions belong to the comparison session timeline, not to an individual candidate revision. The same timestamps are used when listening to each compared revision.

### Region questions still open

Before implementation we must decide:

- how regions behave when revisions differ materially in duration or structure;
- whether overlapping regions are allowed;
- whether a region may extend beyond the duration of one candidate;
- whether looping the active region is baseline behavior;
- how regions from separate sessions are identified as equivalent for cumulative regional standings.

## Playback behavior

### N-way switching

Playback controls should make rapid switching among all candidates a first-class operation. Keyboard shortcuts for A/B/C/D/... are desirable where they can be implemented consistently.

### Position-synchronized switching

Switching from one candidate to another should preserve approximately the same playback position within the active region. This does not require sample-accurate switching in the first implementation; the requirement is perceptually useful synchronization rather than DAW-grade sample alignment.

### Region looping

Repeatedly looping a verse, chorus, bridge, or other selected region while switching candidates is highly valuable for mix comparison. This is a strong candidate for baseline scope if it can be implemented cleanly using the existing playback architecture. The final MVP decision remains open until implementation cost is understood.

## Level matching

Level matching is useful because louder material can be perceived as better even when the mix itself is not preferred. However, reliable level matching introduces analysis/DSP complexity and is not required for the baseline comparison workflow.

Potential modes are **Original Level** and **Level Matched** using playback-only gain. No mode may modify source files. Current design direction: Original Level is baseline; level matching is a follow-on enhancement unless inexpensive and reliable.

## Ranking model

Ranking is recorded **per region, per comparison session** and must support more than two candidates naturally.

Example:

```text
Region: Chorus

1. C
2. A
3. D
4. B
```

Ranking supports ordered preference, ties, no preference, and optional notes. The exact semantics for partial rankings with larger candidate sets remain open.

### Cumulative ranking

Comparison rankings are **cumulative**. A project can have multiple completed blind comparison sessions. Each applicable session remains preserved independently and also contributes to derived aggregate standings.

The cumulative ranking is intentionally kept simple and explainable rather than using an Elo-style, pairwise-probability, or other sophisticated statistical model.

Baseline cumulative behavior:

- each completed applicable session contributes the placement recorded for each participating revision;
- Studio combines those recorded placements into a cumulative placement for each revision;
- lower/better cumulative placement ranks ahead of higher/worse cumulative placement;
- revisions that have the same cumulative placement are resolved by **revision number: the higher-numbered revision ranks ahead**, because it is the more recent revision;
- this recency rule is only a deterministic tiebreaker; it does not otherwise add weight to newer revisions;
- individual session results remain preserved and visible;
- cumulative results are derived/recomputable from session history;
- cumulative Full Song standings are required;
- equivalent timestamped regions may also have cumulative standings;
- Studio should expose the number of contributing sessions so the user can distinguish a result supported by one comparison from one supported by several.

Conceptually:

```text
R05 cumulative placement: 1.7
R06 cumulative placement: 1.7

Result:
1. R06   <- higher revision number wins tie
2. R05
```

The implementation may choose the straightforward arithmetic representation needed to combine recorded placements (for example an average placement over sessions in which the revision participated), but it should not introduce a more complex ranking model unless a demonstrated product need emerges.

### Full Song as overall preference

Within an individual session, the Full Song region provides that session's normal overall result. Across sessions, cumulative Full Song rankings provide the project's normal aggregate comparison result.

Studio should **not automatically average timestamped regional rankings** to generate a different Full Song winner. Regional results answer where a revision is stronger or weaker; they do not replace the explicit Full Song judgment.

## Notes

A comparison should support optional notes because rankings alone do not preserve the reasoning behind a decision. Exact note granularity remains open: region-level, per-revision/per-region, or both.

## Reveal workflow

Blind identities remain hidden until the user explicitly chooses **Reveal Results**. Reveal maps blind identities back to actual revisions, and the original blind mapping is persisted with session history. Whether Reveal automatically finalizes a session remains an open lifecycle decision.

## Comparison history

Comparison sessions are historical records and should not overwrite one another. History preserves date/time, candidate revisions, blind mapping, Full Song result, regional results, notes, and session state.

Studio should expose cumulative standings derived from applicable completed sessions and allow drill-down to the sessions that contributed to those standings.

## Revision History integration

Comparison results should become part of the context visible from the existing Revision History rather than living only in a separate comparison screen.

### Default Revision History: TOP indicator

The revision currently ranked first in the **cumulative Full Song standings** receives a lightweight **TOP** indicator. A pill is preferred over an unlabeled star because a star can be confused with Favorite, Approved, Important, or similar concepts.

Rules:

- TOP is based on cumulative Full Song results from applicable completed comparison sessions;
- newer comparisons contribute to cumulative results rather than replacing prior evidence;
- exactly one revision is the cumulative TOP when rankings are otherwise tied, because the higher revision number wins the tie;
- TOP is informational only and does not mean Approved, Current, Delivered, or Preferred by the client;
- visual styling remains distinct from revision lifecycle/status badges;
- evidence strength should be discoverable, for example `Cumulative #1 - 4 blind comparisons`.

### Detailed comparison overlay / mode

Revision History should provide a control such as **Show Comparison Results** that exposes cumulative Full Song rank, cumulative rankings by equivalent region, contributing session count, regional wins/preference evidence, most recent session result, comparison history links, and drill-down into contributing sessions.

The two-level information model is locked:

1. **Default history** — lightweight cumulative TOP result.
2. **Comparison-results view** — cumulative rankings, evidence context, individual-session history, and drill-down.

## Regional result visualization

Studio should provide complementary summary, timeline, and exact-detail views. The summary can show the cumulative Full Song leader, contributing session count, cumulative regional leaders, candidate count, and region count. A timeline/ranking strip should align regional results to the song timeline. An exact table should show cumulative region-by-region standings with access to underlying individual rankings and notes. Visual encoding must not rely solely on color.

## Approval and lifecycle separation

Comparison is an evaluation tool, not an automatic project-state transition. A first-place session result or cumulative TOP result must **not** automatically approve a revision. Studio may offer explicit follow-up actions such as Done, Open preferred revision, or Approve preferred revision.

## Persistence model

The persistence model should be region-centric and support N-way ranking and cumulative aggregation without redesign.

Conceptual shape:

```text
Comparison Session
  Candidates
  Blind Mapping
  Regions
    Full Song
      Start / End
      Rankings
      Notes
    Named/Timestamped Regions
      Start / End
      Rankings
      Notes
  Lifecycle / timestamps

Derived Cumulative Standings
  Full Song
    Revision standings
    Contributing session references
  Equivalent Regions
    Region identity/range
    Revision standings
    Contributing session references
```

Cumulative standings should remain derived/recomputable rather than becoming an independent source of truth that can drift from session history. If cached for performance, the cache must be rebuildable from persisted comparison sessions.

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
- Full Song ranking as the normal per-session overall preference;
- persistent comparison-session history;
- cumulative Full Song standings across applicable completed sessions;
- simple cumulative placement aggregation with higher revision number as the deterministic tiebreaker;
- cumulative regional standings where equivalent regions can be identified;
- evidence/provenance showing which sessions contribute to cumulative results;
- default Revision History cumulative TOP indicator;
- detailed Revision History cumulative comparison-results view with session drill-down;
- regional summary/timeline/table visualization;
- no automatic approval;
- no source-audio modification.

Region looping should be treated as a strong MVP candidate and resolved during implementation planning.

## Follow-on / potential future scope

The following are intentionally not required by the locked baseline design unless separately promoted during planning:

- playback level matching / loudness normalization;
- formal ABX statistical testing;
- waveform-based region selection/editing;
- weighted regions or automatic aggregation of regional sections into a Full Song score;
- multiple listeners/reviewers;
- exported/shared comparison reports;
- client-facing blind evaluation through the external Listening workflow;
- cloud/web-hosted comparison service;
- sample-accurate DAW-style switching;
- sophisticated statistical/rating algorithms for cumulative ranking.

## Open decisions before implementation

The following items remain intentionally unresolved and should be worked through before implementation issues are split:

1. **Regional equivalence across sessions** — how timestamped/named regions are matched so their results can be accumulated without combining unlike song sections.
2. **Different revision timing** — behavior when candidate revisions differ in total duration, offsets, or song structure.
3. **Region overlap** — whether timestamped regions may overlap.
4. **Region looping** — baseline requirement vs early follow-on.
5. **Ranking completeness** — complete ordering vs partial rankings for larger sets.
6. **Notes** — region-level, per-candidate/per-region, or both.
7. **Session lifecycle** — draft/in-progress/completed/revealed states, resume behavior, and whether reveal finalizes the session.
8. **Post-reveal editing** — whether revealed results can be edited and how history/audit behavior works.
9. **Candidate eligibility** — revisions only vs revision Variants and other playback candidates.
10. **Playback compatibility** — supported source formats and error handling using the existing cross-platform playback provider model.
11. **Revision History detail density** — exact TOP interaction and detailed comparison overlay layout.
12. **Timeline reference duration** — how the regional timeline is defined when candidates have different durations.
13. **Persistence schema/location** — concrete Studio-managed storage format and migration/versioning requirements.

## Relationship to existing Studio functionality

This feature builds on the cross-platform audio preview/playback architecture introduced in Studio v2.1. Existing playback remains the foundation for play/pause, seek/progress, exclusive active playback, and provider-specific behavior.

Blind Revision Comparison adds structured orchestration above that playback layer: multiple candidate identity management, synchronized switching, region control, per-session ranking persistence, cumulative ranking derivation, result visualization, and Revision History integration.

It should not duplicate or fork the core playback implementation unless technical investigation demonstrates that the existing provider contract must be extended.

## Tracking

Primary issue: #370 — Enhancement: Blind Revision Comparison and regional ranking.

This document is the detailed source of truth for the feature design. The issue should remain a concise tracker and link here rather than duplicating the full specification.