import { describe, expect, it } from "vitest";
import type { ComparisonCandidateAvailability, ProjectRegion } from "./models";
import { freezeComparisonSession, formatTimestamp, parseTimestamp, shortcutCandidate, shortcutTransport } from "./session";

const candidates: ComparisonCandidateAvailability[] = [
  { revisionId: "r1", revisionNumber: 1, eligible: true, reason: null, relativePath: "r1.wav" },
  { revisionId: "r2", revisionNumber: 2, eligible: true, reason: null, relativePath: "r2.wav" },
  { revisionId: "r3", revisionNumber: 3, eligible: true, reason: null, relativePath: "r3.wav" },
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
    expect(session.candidates.every((candidate) => candidate.relativePath.endsWith(".wav"))).toBe(true);
    expect(session.candidates.every((candidate) => candidate.integratedLufs === null && candidate.appliedGainDb === null)).toBe(true);
    expect(session.loudnessMatch).toBe(true);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.candidates)).toBe(true);
    expect(Object.isFrozen(session.regions[0])).toBe(true);
  });

  it("freezes analyzed loudness measurements and gains when provided", () => {
    const matched = [
      { ...candidates[0], integratedLufs: -18, appliedGainDb: 0 },
      { ...candidates[1], integratedLufs: -15, appliedGainDb: -3 },
    ];
    const session = freezeComparisonSession(matched, regions, true, () => 0);

    expect(session.candidates).toEqual([
      expect.objectContaining({ revisionId: "r2", integratedLufs: -15, appliedGainDb: -3 }),
      expect.objectContaining({ revisionId: "r1", integratedLufs: -18, appliedGainDb: 0 }),
    ]);
  });

  it("maps A–Z shortcuts but suppresses them in text entry controls", () => {
    const textarea = document.createElement("textarea");
    const blind = [{ blindId: "A" }, { blindId: "Z" }];
    expect(shortcutCandidate({ key: "z", target: document.body, metaKey: false, ctrlKey: false, altKey: false }, blind)).toBe("Z");
    expect(shortcutCandidate({ key: "A", target: textarea, metaKey: false, ctrlKey: false, altKey: false }, blind)).toBeNull();
  });

  it("maps transport shortcuts while preserving text entry and modified keys", () => {
    const textarea = document.createElement("textarea");
    expect(shortcutTransport({ key: " ", code: "Space", target: document.body, metaKey: false, ctrlKey: false, altKey: false })).toBe("toggle");
    expect(shortcutTransport({ key: ",", code: "Comma", target: document.body, metaKey: false, ctrlKey: false, altKey: false })).toBe("back");
    expect(shortcutTransport({ key: ".", code: "Period", target: document.body, metaKey: false, ctrlKey: false, altKey: false })).toBe("forward");
    expect(shortcutTransport({ key: "ArrowLeft", code: "ArrowLeft", target: document.body, metaKey: false, ctrlKey: false, altKey: false })).toBe("previousCandidate");
    expect(shortcutTransport({ key: "ArrowRight", code: "ArrowRight", target: document.body, metaKey: false, ctrlKey: false, altKey: false })).toBe("nextCandidate");
    expect(shortcutTransport({ key: " ", code: "Space", target: textarea, metaKey: false, ctrlKey: false, altKey: false })).toBeNull();
    expect(shortcutTransport({ key: "ArrowRight", code: "ArrowRight", target: textarea, metaKey: false, ctrlKey: false, altKey: false })).toBeNull();
    expect(shortcutTransport({ key: ".", code: "Period", target: document.body, metaKey: true, ctrlKey: false, altKey: false })).toBeNull();
  });
});
