import { describe, expect, it } from "vitest";
import type { ComparisonCandidateAvailability, ProjectRegion } from "./models";
import { freezeComparisonSession, formatTimestamp, parseTimestamp, shortcutCandidate } from "./session";

const candidates: ComparisonCandidateAvailability[] = [
  { revisionId: "r1", revisionNumber: 1, eligible: true, reason: null },
  { revisionId: "r2", revisionNumber: 2, eligible: true, reason: null },
  { revisionId: "r3", revisionNumber: 3, eligible: true, reason: null },
];

const regions: ProjectRegion[] = [
  { regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true },
];

describe("comparison session configuration", () => {
  it("parses and formats project timestamps", () => {
    expect(parseTimestamp("1:02.5")).toBe(62.5);
    expect(parseTimestamp("1:60")).toBeNull();
    expect(formatTimestamp(62.8)).toBe("1:02");
  });

  it("randomizes once and freezes candidate, region, and loudness settings", () => {
    const randomValues = [0.1, 0.8];
    const session = freezeComparisonSession(candidates, regions, true, () => randomValues.shift() ?? 0);

    expect(session.candidates.map((candidate) => candidate.blindId)).toEqual(["A", "B", "C"]);
    expect(new Set(session.candidates.map((candidate) => candidate.revisionId))).toEqual(new Set(["r1", "r2", "r3"]));
    expect(session.loudnessMatch).toBe(true);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.candidates)).toBe(true);
    expect(Object.isFrozen(session.regions[0])).toBe(true);
  });

  it("maps A–Z shortcuts but suppresses them in text entry controls", () => {
    const textarea = document.createElement("textarea");
    const blind = [{ blindId: "A" }, { blindId: "Z" }];
    expect(shortcutCandidate({ key: "z", target: document.body, metaKey: false, ctrlKey: false, altKey: false }, blind)).toBe("Z");
    expect(shortcutCandidate({ key: "A", target: textarea, metaKey: false, ctrlKey: false, altKey: false }, blind)).toBeNull();
  });
});
