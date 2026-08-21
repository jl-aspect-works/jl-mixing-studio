import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { IntakeOperationResult, IntakeReport, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import type { ProjectOverviewFileIndex } from "./ProjectOverviewFileIndex";
import { ProjectOverviewHealth } from "./ProjectOverviewHealth";

afterEach(cleanup);

const project: ProjectSummary = {
  projectId: "project",
  projectName: "Project",
  artist: "Artist",
  schemaVersion: "1.1.0",
  createdWith: "jl-mixing",
  createdAt: "2026-08-01T12:00:00Z",
  deadline: null,
  sampleRate: 48_000,
  bitDepth: 24,
  fileFormat: "WAV",
  deliveryMethod: "Download",
  currentRevision: 1,
  approvedRevision: 1,
  deliveredRevision: 1,
  delivery: null,
  revisions: [],
};

const report: IntakeReport = {
  clientId: "client",
  projectId: "project",
  source: "Original Delivery",
  filesDiscovered: 2,
  blockingErrors: 0,
  warnings: 2,
  expectedSampleRate: 48_000,
  expectedBitDepth: 24,
  enhancedInspectionAvailable: true,
  criticalErrors: [],
  duplicateFilenames: [],
  formatMismatches: [],
  unsupportedFiles: ["notes.txt"],
  unavailableChecks: [],
  inventory: [],
  recommendations: [],
};

const intakeReport: IntakeReportState = {
  status: "ready",
  value: {
    ok: true,
    code: "validated",
    message: "Validated",
    report,
    audioPrepAvailable: true,
    audioPrepFiles: [{ relativePath: "mix.wav", status: "valid" }],
  } as IntakeOperationResult & {
    audioPrepAvailable: boolean;
    audioPrepFiles: Array<{ relativePath: string; status: string }>;
  },
};

const fileIndex: ProjectOverviewFileIndex = {
  status: "ready",
  folders: {
    clientFiles: { fileCount: 2, sizeBytes: 2048 },
    audioPreparation: { fileCount: 1, sizeBytes: 1024 },
    dawProject: { fileCount: 0, sizeBytes: 0 },
    revisions: { fileCount: 0, sizeBytes: 0 },
    finalDelivery: { fileCount: 0, sizeBytes: 0 },
    recall: { fileCount: 0, sizeBytes: 0 },
  },
  referencesCount: 0,
  workingAudioCount: 1,
  workingAudioAreaPresent: true,
  failedPaths: [],
};

describe("ProjectOverviewHealth validation presentation", () => {
  it("keeps Client Files warnings out of Project Health status", () => {
    render(<ProjectOverviewHealth project={project} tasks={[]} intakeReport={intakeReport} fileIndex={fileIndex} />);

    const section = screen.getByRole("heading", { name: "Project Health" }).closest("section");
    expect(section).not.toBeNull();
    const health = within(section!);

    expect(health.getByText("On Track")).toBeInTheDocument();
    expect(health.getByText("Client Files")).toBeInTheDocument();
    expect(health.getByText("Available")).toBeInTheDocument();
    expect(health.queryByText("Review")).not.toBeInTheDocument();
  });
});
