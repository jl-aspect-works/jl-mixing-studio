import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { notifyWorkspaceRefreshed } from "../app/workspaceRefreshEvents";
import { getComparisonResults } from "../comparison/comparisonService";
import type { ComparisonResultsData } from "../comparison/models";
import type { ProjectSummary } from "../types";
import { ProjectOverviewRecentRevisions } from "./ProjectOverviewRecentRevisions";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("../comparison/comparisonService", () => ({ getComparisonResults: vi.fn() }));

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

const results = (winner?: number): ComparisonResultsData => ({
  document: { schemaVersion: 1, regions: [], completedSessions: [] },
  fullSongStandings: winner ? [{ revisionId: `revision-${winner}`, revisionNumber: winner, averagePlacement: 1, contributingSessions: 2 }] : [],
  regionalStandings: [],
});

beforeEach(() => {
  vi.mocked(invoke).mockResolvedValue({
    available: false,
    relativePath: null,
    displayName: null,
    reason: "No supported audio file was found in this revision.",
  });
  vi.mocked(getComparisonResults).mockReset().mockResolvedValue(results());
});
afterEach(cleanup);

it("preserves compact previews and existing badges when no TOP is available", async () => {
  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Play Revision 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play Revision 2" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play Revision 1" }).closest(".overview-revision-controls")).toHaveTextContent("01");
  expect(screen.getByRole("button", { name: "Play Revision 2" }).closest(".overview-revision-controls")).toHaveTextContent("02");
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  await waitFor(() => expect(getComparisonResults).toHaveBeenCalledOnce());
  expect(screen.queryByText("TOP")).not.toBeInTheDocument();
});

it("shows the cumulative TOP beside existing badges and preserves navigation", async () => {
  vi.mocked(getComparisonResults).mockResolvedValue(results(1));
  const onRevisions = vi.fn();
  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={onRevisions} />);
  const top = await screen.findByText("TOP");
  const row = within(top.closest("article")!);
  expect(row.getByText("Revision 1", { selector: "strong" })).toHaveTextContent("Revision 1");
  expect(row.getByText("Approved")).toBeInTheDocument();
  expect(top).toHaveClass("overview-revision-badge", "top");
  expect(screen.getByText("Current").closest("article")).toHaveTextContent("Revision 2");
  fireEvent.click(screen.getByRole("button", { name: "View All Revisions" }));
  expect(onRevisions).toHaveBeenCalledOnce();
});

it("does not turn regional-only comparison results into TOP", async () => {
  const regional = results();
  regional.regionalStandings = [{ region: { regionId: "verse", name: "Verse", startSeconds: 0, endSeconds: 20 }, standings: results(2).fullSongStandings }];
  vi.mocked(getComparisonResults).mockResolvedValue(regional);
  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);
  await waitFor(() => expect(getComparisonResults).toHaveBeenCalledOnce());
  expect(screen.queryByText("TOP")).not.toBeInTheDocument();
  expect(screen.getByText("Current")).toBeInTheDocument();
});

it("preserves the card when comparison data is unavailable", async () => {
  vi.mocked(getComparisonResults).mockRejectedValue(new Error("History unavailable"));
  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);
  await waitFor(() => expect(getComparisonResults).toHaveBeenCalledOnce());
  expect(screen.queryByText("TOP")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recent Revisions" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play Revision 2" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not label a recent revision when the cumulative TOP is outside the latest four", async () => {
  vi.mocked(getComparisonResults).mockResolvedValue(results(1));
  const largerProject = { ...project, currentRevision: 5, revisions: [1, 2, 3, 4, 5].map((number) => ({ ...project.revisions[1], number, revisionId: `revision-${number}` })) };
  render(<ProjectOverviewRecentRevisions clientId="client" project={largerProject} onRevisions={vi.fn()} />);
  await waitFor(() => expect(getComparisonResults).toHaveBeenCalledOnce());
  expect(screen.queryByText("TOP")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Play Revision 1" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(4);
});

it("removes TOP after comparison history is cleared and the workspace refreshes", async () => {
  vi.mocked(getComparisonResults).mockResolvedValueOnce(results(1)).mockResolvedValueOnce(results());
  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);
  await screen.findByText("TOP");
  await act(async () => { notifyWorkspaceRefreshed(); });
  await waitFor(() => expect(screen.queryByText("TOP")).not.toBeInTheDocument());
  expect(getComparisonResults).toHaveBeenCalledTimes(2);
});

it("hides TOP on project changes and ignores a late refresh from the previous project", async () => {
  let finishOldRefresh!: (value: ComparisonResultsData) => void;
  const oldRefresh = new Promise<ComparisonResultsData>((resolve) => { finishOldRefresh = resolve; });
  vi.mocked(getComparisonResults).mockResolvedValueOnce(results(1)).mockReturnValueOnce(oldRefresh).mockResolvedValueOnce(results());
  const view = render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);
  await screen.findByText("TOP");
  act(() => { notifyWorkspaceRefreshed(); });
  view.rerender(<ProjectOverviewRecentRevisions clientId="client" project={{ ...project, projectId: "other-project" }} onRevisions={vi.fn()} />);
  expect(screen.queryByText("TOP")).not.toBeInTheDocument();
  await act(async () => { finishOldRefresh(results(1)); });
  expect(screen.queryByText("TOP")).not.toBeInTheDocument();
  expect(getComparisonResults).toHaveBeenLastCalledWith({ clientId: "client", projectId: "other-project" });
});

it("keeps the newest refresh when earlier responses arrive out of order", async () => {
  let finishOldRequest!: (value: ComparisonResultsData) => void;
  const oldRequest = new Promise<ComparisonResultsData>((resolve) => { finishOldRequest = resolve; });
  vi.mocked(getComparisonResults).mockReturnValueOnce(oldRequest).mockResolvedValueOnce(results(2));
  render(<ProjectOverviewRecentRevisions clientId="client" project={project} onRevisions={vi.fn()} />);
  await act(async () => { notifyWorkspaceRefreshed(); });
  await screen.findByText("TOP");
  await act(async () => { finishOldRequest(results(1)); });
  expect(screen.getByText("TOP").closest("article")).toHaveTextContent("Revision 2");
});
