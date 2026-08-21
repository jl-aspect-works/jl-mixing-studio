import { describe, expect, it } from "vitest";
import type { IntakeOperationResult, IntakeReport } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { getAudioValidationOverviewStatus, getIntakeOverviewStatus } from "./ProjectOverviewModel";

const report = (blockingErrors = 0, warnings = 0): IntakeReport => ({
  clientId: "client",
  projectId: "project",
  source: "Original Delivery",
  filesDiscovered: 2,
  blockingErrors,
  warnings,
  expectedSampleRate: 48_000,
  expectedBitDepth: 24,
  enhancedInspectionAvailable: true,
  criticalErrors: blockingErrors > 0 ? ["client finding"] : [],
  duplicateFilenames: [],
  formatMismatches: [],
  unsupportedFiles: warnings > 0 ? ["client warning"] : [],
  unavailableChecks: [],
  inventory: [],
  recommendations: [],
});

const state = (
  clientBlocking: number,
  clientWarnings: number,
  audioStatuses: string[],
): IntakeReportState => ({
  status: "ready",
  value: {
    ok: true,
    code: "validated",
    message: "Validated",
    report: report(clientBlocking, clientWarnings),
    audioPrepAvailable: true,
    audioPrepFiles: audioStatuses.map((status, index) => ({ relativePath: `audio-${index}.wav`, status })),
  } as IntakeOperationResult & { audioPrepAvailable: boolean; audioPrepFiles: Array<{ relativePath: string; status: string }> },
});

describe("project-level validation attention", () => {
  it("keeps Client Files-only findings local without promoting project validation attention", () => {
    const validation = state(1, 2, ["valid"]);
    expect(getIntakeOverviewStatus(validation).tone).toBe("attention");
    expect(getAudioValidationOverviewStatus(validation).tone).toBe("good");
  });

  it("promotes Audio Prep blocking findings to project validation attention", () => {
    expect(getAudioValidationOverviewStatus(state(0, 0, ["blocked"]))).toMatchObject({
      label: "Needs attention",
      tone: "attention",
    });
  });

  it("treats clean Client Files and Audio Prep validation as healthy", () => {
    const validation = state(0, 0, ["valid", "info"]);
    expect(getIntakeOverviewStatus(validation).tone).toBe("good");
    expect(getAudioValidationOverviewStatus(validation).tone).toBe("good");
  });

  it("keeps mixed Client Files and Audio Prep findings in project validation attention because of Audio Prep", () => {
    const validation = state(1, 1, ["needs_attention", "valid"]);
    expect(getIntakeOverviewStatus(validation).tone).toBe("attention");
    expect(getAudioValidationOverviewStatus(validation).tone).toBe("attention");
  });
});
