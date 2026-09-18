import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { ProjectSummary } from "../types";
import { ProjectOverviewRecentRevisions } from "./ProjectOverviewRecentRevisions";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

afterEach(cleanup);

it("adds an independent compact preview to every recent revision", () => {
  vi.mocked(invoke).mockResolvedValue({
    available: false,
    relativePath: null,
    displayName: null,
    reason: "No supported audio file was found in this revision.",
  });
  const project = {
    projectId: "project",
    projectName: "Project",
    artist: "Artist",
    schemaVersion: "1.1.0",
    createdWith: "test",
    createdAt: "2026-01-01T00:00:00Z",
    deadline: null,
    sampleRate: 48_000,
    bitDepth: 24,
    fileFormat: "WAV",
    deliveryMethod: "Download",
    currentRevision: 2,
    approvedRevision: 1,
    deliveredRevision: null,
    delivery: null,
    revisions: [1, 2].map((number) => ({
      number,
      revisionId: `revision-${number}`,
      createdAt: `2026-01-0${number}T00:00:00Z`,
      description: `Revision ${number}`,
      approvedAt: number === 1 ? "2026-01-03T00:00:00Z" : null,
      approvedBy: number === 1 ? "JL" : null,
    })),
  } satisfies ProjectSummary;

  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Play Revision 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play Revision 2" })).toBeInTheDocument();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
});
