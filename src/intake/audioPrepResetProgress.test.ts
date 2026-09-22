import { describe, expect, it } from "vitest";
import { audioPrepResetProgressPresentation } from "./audioPrepResetProgress";
import type { ManagedImportProgress } from "./models";

const event = (phase: ManagedImportProgress["phase"], completed: number, overallCompleted: number): ManagedImportProgress => ({
  clientId: "client", projectId: "project", phase, completed, total: 82,
  overallCompleted, overallTotal: 246, active: [],
});

describe("Audio Prep reset progress", () => {
  it("shows real counts and keeps 100% reserved until the command succeeds", () => {
    expect(audioPrepResetProgressPresentation(event("importing", 12, 94))).toMatchObject({
      label: "Processing 12 of 82", value: 94, max: 246,
    });
    expect(audioPrepResetProgressPresentation(event("complete", 82, 246))).toMatchObject({
      value: 245, max: 246,
    });
  });

  it("keeps the spinner for setup before the total is known", () => {
    expect(audioPrepResetProgressPresentation({ ...event("planning", 0, 0), total: null, overallTotal: null })).toBeNull();
  });
});
