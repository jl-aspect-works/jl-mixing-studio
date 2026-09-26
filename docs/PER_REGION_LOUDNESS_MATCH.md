# Per-region Loudness Match

Blind Comparison turns on per-region LUFS matching by default. In New Comparison, Loudness Match can be turned off, but there is no matching-scope choice. Studio analyzes only the regions selected for the session; Full Song remains optional. Each region uses the quietest candidate in that region as the reference; the other candidates are attenuated, never boosted.

The analysis cache keys each measurement to the revision source identity and exact region boundaries. Changing an audio source or a region boundary causes fresh analysis. A region that is too short to measure or starts beyond any candidate's duration blocks the session with an actionable error. A custom-region-only session does not require Full Song analysis.

At playback preparation the first region's gain is set for every candidate. Candidate switches keep those prepared gains. Region switches pause playback, seek to the new region, apply its fixed candidate gains, and resume when playback was requested. Seeking or looping within a region does not adjust loudness. The blind session shows no LUFS or gain figures; revealed results list measurements by region and candidate.

Completed comparison records store the matching scope and per-region measurements. Older records without these fields still load as full-source sessions, preserving their existing results.
