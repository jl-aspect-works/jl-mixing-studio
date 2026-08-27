import { describe, expect, it } from "vitest";
import type { ManagedImportProgress } from "./models";
import { managedImportProgressPresentation } from "./managedImportProgress";

const progress = (phase: ManagedImportProgress["phase"], completed: number, total: number | null): ManagedImportProgress => ({
  clientId: "client",
  projectId: "project",
  phase,
  completed,
  total,
  active: [],
});

describe("managedImportProgressPresentation", () => {
  it("keeps completion in finalizing presentation until the import command returns", () => {
    const states = [
      progress("staging", 0, 2),
      progress("staging", 1, 2),
      progress("staging", 2, 2),
      progress("importing", 0, 2),
      progress("importing", 1, 2),
      progress("importing", 2, 2),
      progress("finalizing", 2, 2),
      progress("complete", 2, 2),
    ].map((event) => managedImportProgressPresentation(event, 2));
    const finalizing = states[states.length - 2];
    const complete = states[states.length - 1];

    expect(states.slice(0, -1).map((state) => state.value)).toEqual([0, 1, 2, 2, 3, 4, 4]);
    expect(states.every((state) => state.max === 5)).toBe(true);
    expect(finalizing.label).toBe("Finalizing import…");
    expect(complete.label).toBe("Finalizing import…");
    expect(finalizing.value).toBeLessThan(finalizing.max);
    expect(complete.determinate).toBe(false);
    expect(complete.value).toBeLessThan(complete.max);
  });

  it("uses Automation's reported whole-operation counts when present", () => {
    const state = managedImportProgressPresentation({
      ...progress("importing", 4, 12),
      overallCompleted: 16,
      overallTotal: 25,
    }, 12);
    expect(state.label).toBe("Importing 4 of 12 files");
    expect(state.value).toBe(16);
    expect(state.max).toBe(25);
  });

  it("shows staging file counts instead of discarding them", () => {
    const state = managedImportProgressPresentation(progress("staging", 3, 12), 12);
    expect(state.label).toBe("Preparing 3 of 12 files");
    expect(state.determinate).toBe(true);
    expect(state.value).toBe(3);
    expect(state.max).toBe(25);
  });

  it("keeps planning indeterminate until a file total is known", () => {
    const state = managedImportProgressPresentation(progress("planning", 0, null), 12);
    expect(state.label).toBe("Preparing import…");
    expect(state.determinate).toBe(false);
  });

  it("still presents older phase-local importing payloads sensibly", () => {
    const state = managedImportProgressPresentation(progress("importing", 4, 10), 10);
    expect(state.label).toBe("Importing 4 of 10 files");
    expect(state.value).toBe(14);
    expect(state.max).toBe(21);
  });
});
