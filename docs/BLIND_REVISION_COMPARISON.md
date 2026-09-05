# Blind Revision Comparison

Status: Design locked for issue #370.

## Purpose

Blind Revision Comparison gives a mixer a structured way to compare multiple normal revisions without knowing which revision is playing, rank them overall and by song section, and preserve the decision history alongside the existing revision lifecycle.

The feature is **N-way first**. Comparing three or more revisions is expected to be normal. Two-revision comparison is supported but is not the primary design case.

Repeated completed Comparison Sessions contribute to cumulative project standings. Comparison evaluates revisions; it does not replace approval, delivery, or Listening publication.

## Core design principles

1. **N-way first** — data, playback, ranking, and results work naturally with 3+ candidates.
2. **Blind by default** — revision number, filename, date, lifecycle state, loudness values, applied gain, and other identity clues stay hidden until reveal.
3. **Project timeline** — comparison regions belong to the project, not to individual revisions.
4. **Compatible timeline required** — selected revisions must share a sufficiently compatible song structure/timeline for common timestamps to remain meaningful. Studio does not align or remap structurally incompatible revisions.
5. **Normal revisions only** — Variants are excluded.
6. **Explicit ranking** — every candidate receives an explicit placement in every completed region.
7. **Single-session completion** — unfinished comparisons are not persisted or resumable.
8. **Immutable completed results** — changed judgment is represented by a new session; obsolete sessions may be deleted.
9. **Cumulative evidence** — completed sessions accumulate rather than the newest result replacing older evidence.
10. **Simple cumulative ranking** — arithmetic mean placement; equal means are broken by higher revision number.
11. **Loudness-bias reduction** — playback-only Loudness Match is available from day 1 and defaults On.
12. **Non-destructive** — source audio is never modified.
13. **Explicit reset** — all ranking history can be cleared without changing revisions or project region definitions.
14. **Approval remains explicit** — session winners and cumulative TOP never auto-approve.
15. **Compact Revision History integration** — only the cumulative Full Song leader receives a TOP indicator.

## Comparison Session

A Comparison Session is one blind evaluation exercise for one project.

A completed session contains:

- two or more normal revision candidates;
- a stable randomized blind mapping such as A/B/C/D;
- one or more project evaluation regions;
- a complete ranking for every selected region;
- optional per-candidate notes within each region;
- completion timestamp;
- Loudness Match state;
- measured integrated loudness and applied fixed gain when matching was enabled;
- the original blind mapping after reveal.

The UI is optimized for roughly **3–5 candidates**, while the architecture supports larger N-way sets.

Only fully completed sessions are persisted and contribute to cumulative results.

## Candidate identity and eligibility

The authoritative candidate identity is the existing immutable project-manifest **`revision_id`** UUID. Revision number is display/snapshot information and the cumulative recency tiebreaker; filename is never identity.

Locked eligibility behavior:

- normal revisions only;
- Variants excluded;
- user selects revisions that are structurally/timing compatible;
- Studio does not perform structural alignment, time-warping, section detection, or timestamp remapping;
- small duration differences are acceptable when selected project regions still describe equivalent material;
- a candidate too short for a required region is incompatible and must be excluded rather than clipped/remapped;
- an unplayable candidate is excluded before the session starts;
- candidate set is frozen when the session starts.

## Blind identities and keyboard switching

Each candidate receives a randomized blind identity (`A`, `B`, `C`, ...). The mapping is assigned once and remains stable for the session.

Candidate keyboard shortcuts use the same letters as the blind identities:

- `A` switches to candidate A;
- `B` switches to candidate B;
- continuing through `Z` where applicable.

Candidate shortcuts are disabled while focus is in a notes/text-input control so normal typing never changes playback.

## Project evaluation regions

Regions are **project-level definitions** shared across comparison sessions.

### Full Song

Every project comparison has the built-in region:

```text
Full Song: 0:00 -> End
```

Full Song is immutable as the built-in overall region. A session's Full Song ranking is the session's overall preference and contributes to cumulative Full Song standings.

### Custom regions

Users may add timestamped regions such as:

```text
Intro     0:00-0:18
Verse 1   0:18-0:48
Chorus 1  0:48-1:18
Bridge    2:18-2:46
Outro     3:24-3:55
```

The first implementation does not require waveform editing. Region start/end can be set from playback position and manually edited. Regions may overlap.

Each custom project region has a stable UUID-style **`region_id`**.

### Region editing and historical snapshots

Completed sessions preserve the exact region definition that was evaluated.

Locked behavior:

- every completed session stores a snapshot of each used region's name, start time, and end time;
- editing or renaming a live project region affects future comparisons only;
- historical completed sessions continue to display the name/timestamps used at completion;
- deleting a live custom region prevents its use in future sessions but does **not** erase completed historical results;
- stable `region_id` retains the logical relationship needed for historical/cumulative reporting;
- clearing ranking history removes completed sessions/results but does not delete live project region definitions.

## New Comparison setup

The setup flow starts from Revision History and:

- selects 2+ eligible normal revisions;
- validates what Studio can validate about playback/region compatibility;
- selects Full Song and any desired project regions;
- allows project regions to be defined/edited before the session begins;
- shows Loudness Match **On by default**;
- performs/reuses loudness analysis when matching is enabled;
- excludes an unanalyzable candidate when matching is required, or allows the user to deliberately choose Loudness Match Off for the entire session;
- freezes candidate set, selected regions, and Loudness Match state when **Start Comparison** is chosen.

## Comparison workspace

Blind comparison uses a dedicated full-screen workspace, not a modal.

The workspace includes:

- session header with candidate count, active region, frozen Loudness Match state, and Cancel;
- project region tabs/chips with Full Song first;
- active-region bounds and Loop control;
- playback transport and seek/progress;
- large blind candidate controls (`A`, `B`, `C`, ...);
- neutral `Playing: C`-style indication;
- per-region ranking editor;
- per-candidate notes;
- region completion state such as `Full Song ✓  Intro ✓  V1 ○`;
- terminal **Reveal & Complete Comparison** action.

The blind workspace must not expose revision identity clues.

Cancel/leave/close after work has begun warns that unfinished ranking work will be discarded. Unfinished work is never persisted.

## Playback architecture

Blind Revision Comparison extends Studio's existing playback architecture rather than introducing an unrelated playback stack.

### Session-level coordinator

A **Comparison Playback Session** owns playback for the lifetime of the comparison.

Locked behavior:

- comparison claims Studio's exclusive playback ownership while active;
- the comparison session owns the candidate channels, active candidate, authoritative project-timeline position, active region, Loop state, user output volume, and fixed per-candidate Loudness Match gain;
- ordinary preview players cannot play concurrently with an active comparison;
- all candidates are prepared before blind listening begins;
- entire decoded songs are not loaded into RAM merely to support switching;
- only one candidate is audible at a time.

### Platform strategy

- **macOS/WKWebView:** maintain one prepared HTML audio element per comparison candidate; only the active one plays.
- **Windows/native:** extend/refactor native playback so prepared candidate players share one output engine/mixer rather than repeatedly replacing a single loaded player.
- the React comparison UI consumes one common comparison-session contract and does not depend on platform playback details.

### Position-synchronized switching

When switching candidates, Studio obtains a fresh authoritative position from the active provider, pauses the current candidate, seeks the target candidate to that project-timeline position, applies its fixed comparison gain, and starts the target.

The goal is **perceptually immediate switching**, not DAW/sample-accurate phase synchronization.

Inactive candidates are prepared but are **not continuously decoded in lockstep**.

Studio opportunistically keeps inactive candidates near the active playhead using a **drift-based synchronization policy**:

- small drift requires no work;
- sufficiently large drift may trigger an opportunistic reposition;
- candidate selection always performs a final fresh seek to the current authoritative position before playback;
- synchronization aggressiveness is an implementation/performance parameter, not a fixed wall-clock cadence;
- the policy must avoid excessive local or NAS I/O;
- implementation testing must include NAS-hosted revisions and variable storage/network latency.

UI progress updates may be less frequent than switching precision; switching must not depend on stale React progress state.

### Region selection and looping

**Loop defaults On for every comparison region, including Full Song.**

Locked behavior:

- selecting a region makes that region's start/end the active playback bounds;
- selecting a custom region moves playback to that region's start rather than preserving an irrelevant position from the previous region;
- reaching the region end while Loop is On returns to the region start and continues;
- inactive candidates are brought near the new loop position opportunistically so switching remains responsive;
- candidate switching inside a loop preserves the current project-timeline position as closely as practical;
- the user may turn Loop Off at any time;
- switching/selecting another region uses that region with Loop On by default.

### Playback failure

Known unplayable candidates are excluded before start. If a candidate unexpectedly fails during an active blind session, playback stops and Studio identifies only its blind identity (for example Candidate C), offers Retry or Cancel, and does not silently remove the candidate or continue a changed candidate set. If recovery fails, the unfinished comparison is cancelled and nothing is persisted.

## Loudness Match

Playback-only Loudness Match is required in the first release and defaults **On**.

Locked behavior:

- analyze each candidate's **Full Song integrated loudness** before the comparison begins;
- use the **quietest candidate as the reference**;
- quietest candidate receives `0 dB` comparison gain;
- louder candidates receive attenuation-only negative gains;
- use one fixed gain per candidate for Full Song and all custom regions;
- no per-region matching gains;
- no gain boost, limiter, compressor, normalized render, or source modification;
- normal user/device output volume remains independent of the comparison matching gain;
- LUFS and gain values remain hidden while blind;
- completed/revealed results may show the measured LUFS and applied gain;
- when one candidate cannot be analyzed, Studio must not silently mix matched and unmatched candidates.

### Frozen session setting

Loudness Match is chosen in **New Comparison setup** and is frozen by **Start Comparison**.

It cannot be toggled during the active blind session. This guarantees that every regional and Full Song judgment within a completed session was made under one consistent loudness condition.

Completed-session history records whether matching was enabled and, when enabled, the actual candidate LUFS and fixed gain values used.

### Analysis implementation and cache

Loudness analysis should be implemented once in the native/Rust layer using an established BS.1770/EBU R128-compatible implementation/library rather than separate platform-specific measurements or a hand-written algorithm.

Analysis is derived data and should be cached so unchanged revision audio is not repeatedly rescanned, especially on NAS storage. Cache validity should use robust file identity signals (for example source identity/path plus size/mtime/content fingerprint) consistent with Studio/Automation cache conventions. Cache data is regenerable and is not authoritative comparison history.

## Ranking model

Ranking is recorded **per project region, per completed session**.

### Initial state: explicitly Unranked

Every region starts with all candidates in an **Unranked** pool:

```text
Unranked
[A] [B] [C] [D]
```

The initial state implies **no judgment and no tie**.

A region becomes complete only after every candidate leaves Unranked through explicit placement or the user explicitly chooses No Preference.

### Rank rows

Rank rows represent ordinal positions. Users do not type rank numbers.

Primary drag/drop behavior:

- drag a candidate **between rank rows** to create/insert its own rank row;
- drag a candidate **onto an existing rank row** to tie with candidates in that row;
- drag a tied candidate out of its row to break the tie/create a separate rank row;
- Studio automatically recalculates competition-rank numbers.

Example:

```text
1  [B]
2  [D] [C]
4  [A]
```

This represents placements `1, 2, 2, 4`.

Drop affordances should make **Place above / Tie with / Place below** visually clear.

Accessible non-drag actions must provide equivalent movement/tie behavior. Exact labels may be refined during implementation.

Notes belong to the candidate, not the rank position, and move with that candidate.

### No Preference

**No Preference** is an explicit region-level outcome meaning all candidates are tied for first for that region:

```text
1  [A] [B] [C]
```

It is not represented by leaving candidates Unranked.

### Completion and immutability

- every candidate must receive an explicit placement in every required region;
- partial rankings are invalid completed results;
- ties use competition ranking (`1, 2, 2, 4`);
- all regions, including Full Song, must be complete before Reveal & Complete is enabled;
- ranking/notes may be freely rearranged before completion;
- after Reveal & Complete the persisted result is immutable;
- re-evaluation requires a new Comparison Session;
- deleting one completed session removes its evidence and recomputes cumulative standings.

## Cumulative ranking

Completed applicable sessions contribute their numeric competition placement.

For each revision/region:

- cumulative placement is the **arithmetic mean** of recorded placements from applicable completed sessions in which that revision participated;
- lower average is better;
- equal averages are broken by **higher revision number** (more recent revision);
- revision number adds no other weighting;
- contributing session count/evidence is shown;
- cumulative Full Song standings are required;
- cumulative standings are also derived for each project region;
- regional results do not get averaged into a replacement Full Song result.

Exactly one revision is the cumulative Full Song leader/TOP whenever cumulative Full Song evidence exists because the revision-number tiebreak is deterministic.

## Reveal & results

**Reveal & Complete Comparison** finalizes/persists the session and then reveals identities. The dedicated results state replaces the blind workspace.

The results screen shows:

- completed timestamp, candidate count, and frozen Loudness Match state;
- revealed mapping such as `A -> Revision 04`;
- Full Song session ranking;
- real revision plus original blind identity, such as `Revision 06 (B)`;
- clear distinction between this session's winner and the cumulative Full Song TOP revision;
- regional tabs with revealed ranking and per-candidate notes;
- post-reveal LUFS/gain values when matching was enabled;
- cumulative regional standings/evidence where available;
- Back to Revision History, Open preferred revision, and explicit Approve preferred revision actions.

Ranking is read-only after reveal. The same component is reused for historical session drill-down in read-only mode.

## Revision History and Comparison Results

Revision History remains primarily a lifecycle/status view.

- only the cumulative Full Song leader displays a small **TOP** pill;
- cumulative rank numbers are not shown on every revision row;
- TOP is informational only and does not mean Approved, Current, Delivered, or client-preferred;
- clicking TOP opens **Comparison Results**;
- Revision History also has a dedicated Comparison Results action;
- deleting history recomputes/removes TOP as appropriate.

Comparison Results includes:

- cumulative Full Song standings;
- cumulative average placement and contributing-session evidence;
- cumulative standings per project region;
- completed-session history;
- read-only historical session drill-down;
- candidates, rankings, notes, and post-reveal loudness details;
- individual session Delete;
- secondary/destructive **Clear Ranking History**.

Regional visualization should support summary, horizontal project-timeline/ranking-strip, and an exact accessible table. Color must not be the only encoding.

## Clear Ranking History

Clear Ranking History deletes all completed blind comparison history for the project:

- Full Song rankings;
- regional rankings;
- blind mappings;
- comparison notes;
- persisted completed-session Loudness Match measurements/gains.

It clears cumulative standings and removes TOP.

It does **not** change:

- revision audio;
- revision lifecycle;
- approval/delivery state;
- project region definitions;
- unrelated project data.

The action is irrecoverable and uses normal destructive confirmation; typed project-name confirmation is not required.

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

## Persistence model

Blind Revision Comparison is **project-owned Studio evaluation metadata**.

### Canonical location

The current JL Mixing project contract uses **`00_Admin`** as the project-owned administrative/metadata area. Comparison data therefore lives in its own versioned document:

```text
<Project>/00_Admin/comparison.json
```

Do not introduce a parallel project-level `Studio/` metadata directory for this feature.

The existing Automation project manifest remains authoritative for revision lifecycle/state and revision identity. Comparison metadata must not duplicate or replace that authority.

### Document identity and versioning

`comparison.json` has its own schema identity/version, beginning at `1.0.0`, and its own stable document UUID. It follows the established project metadata principles of explicit schema identity, timestamps, safe forward migration, and atomic writes.

Unsupported newer schema versions fail safely without modifying revision audio, Automation metadata, or unrelated project state.

### Authoritative persisted data

Persist:

- project identity reference;
- live custom project region definitions with stable UUID-style `region_id` values;
- stable UUID-style completed `session_id` values;
- candidate `revision_id` references plus revision-number snapshots for display/history;
- original blind mapping;
- completed timestamp;
- frozen Loudness Match state;
- candidate integrated LUFS and applied gain when matching was enabled;
- per-session region snapshots (region ID, name, start, end);
- rank-row structure / resulting competition placements;
- per-candidate notes.

Full Song is a built-in reserved region identity rather than a deletable user-created region.

### Derived data

Do **not** persist cumulative standings as authoritative state.

Always derive/recompute:

- cumulative Full Song standings;
- cumulative project-region standings;
- contributing-session evidence/counts;
- current TOP revision.

Deleting one session or clearing ranking history therefore deterministically changes all derived results without synchronizing duplicate aggregate state.

### Conceptual shape

```text
00_Admin/comparison.json
  Metadata
    Schema: studio-blind-comparison
    Schema Version: 1.0.0
    Document ID
    Created / Last Modified

  Project Reference
    Project ID
    Project Document ID

  Live Regions
    Region ID
    Name
    Start / End

  Completed Sessions
    Session ID
    Completed At
    Candidates
      Revision ID
      Revision Number Snapshot
      Blind ID
    Loudness Match
      Enabled
      Candidate Integrated LUFS
      Candidate Applied Gain
    Region Results
      Region ID / Built-in Full Song ID
      Region Snapshot
        Name
        Start / End
      Rank Rows
        Revision IDs
      Per-candidate Notes

Derived at runtime
  Cumulative Full Song Standings
  Cumulative Regional Standings
  Evidence Counts
  TOP Revision
```

### Loudness analysis cache

The loudness-analysis cache is **separate from `comparison.json`**. It is derived/regenerable performance data. Completed sessions preserve the actual analysis/gain values used, but reusable scan cache records are not historical comparison evidence.

## Baseline acceptance concerns

Implementation/acceptance must cover at least:

- 2-, 3-, and 5+ candidate sessions;
- all candidates initially Unranked;
- rank-row drag/drop, tie creation/breaking, and accessible alternatives;
- No Preference;
- mixed supported audio formats;
- Loudness Match On and Off selected before start;
- Loudness Match frozen during active comparison;
- Full Song and custom regions with Loop On by default;
- overlapping project regions;
- region rename/edit/delete with historical snapshot preservation;
- candidate too short for required region;
- unplayable or unanalyzable candidate;
- unexpected in-session playback failure;
- position-synchronized A-Z switching;
- Windows native and macOS WKWebView behavior;
- NAS-hosted projects and variable storage latency;
- cancel/close unfinished session;
- individual session deletion;
- Clear Ranking History;
- cumulative placement ties and higher-revision-number tiebreak;
- persistence/migration safety for `00_Admin/comparison.json`.

## Follow-on / future scope

Potential follow-ons include formal ABX statistical testing, waveform region editing, weighted regional scoring, multiple listeners, exported/shared reports, client-facing remote blind evaluation, cloud/web-hosted comparison, sample-accurate switching, automatic structural alignment, and more sophisticated statistical ranking algorithms.

## Design status

The product/design decisions identified to date are locked. Implementation may uncover lower-level technical details requiring refinement, but those refinements should preserve the behavior and principles documented here unless a product decision is explicitly revisited.

## Relationship to existing Studio functionality

This feature builds on Studio v2.1 cross-platform playback and the existing Automation project/revision metadata contract. It adds comparison-session playback orchestration, synchronized switching, playback-only loudness matching and caching, project-level region control/looping, explicit ranking persistence, cumulative derivation, results visualization, Revision History integration, session deletion, and ranking-history clearing.

It should extend/refactor shared playback infrastructure where necessary rather than fork an unrelated playback implementation.

## Tracking

Primary issue: #370 — Enhancement: Blind Revision Comparison and regional ranking.

This document is the detailed source of truth for the feature design. The issue should remain a concise tracker and link here rather than duplicating the full specification.
