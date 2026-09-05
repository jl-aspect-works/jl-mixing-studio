import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientSummary, ProjectSummary } from "../types";
import { ComparisonFlow } from "./ComparisonFlow";
import { ComparisonWorkspace } from "./ComparisonWorkspace";
import type { ComparisonSetupData, FrozenComparisonSession } from "./models";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("./comparisonService", () => ({
  getComparisonSetup: mocks.get,
  addComparisonRegion: mocks.add,
  updateComparisonRegion: mocks.update,
  deleteComparisonRegion: mocks.remove,
}));

const client = { clientId: "c1", clientName: "Client", createdAt: "", defaultArtist: "Artist", projects: [] } satisfies ClientSummary;
const project = {
  projectId: "p1", projectName: "Song", artist: "Artist", schemaVersion: "1.1.0", createdWith: "test", createdAt: "", deadline: null,
  sampleRate: 48_000, bitDepth: 24, fileFormat: "WAV", deliveryMethod: "Digital", currentRevision: 3, approvedRevision: null, deliveredRevision: null, delivery: null,
  revisions: [1, 2, 3].map((number) => ({ number, revisionId: `r${number}`, createdAt: "", description: `Revision ${number}`, approvedAt: null, approvedBy: null })),
} satisfies ProjectSummary;

const setup: ComparisonSetupData = {
  document: { schemaVersion: 1, completedSessions: [], regions: [{ regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true }] },
  candidates: [
    { revisionId: "r1", revisionNumber: 1, eligible: true, reason: null },
    { revisionId: "r2", revisionNumber: 2, eligible: true, reason: null },
    { revisionId: "r3", revisionNumber: 3, eligible: false, reason: "No playable WAV file was found." },
  ],
};

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue(setup);
  mocks.add.mockReset();
  mocks.update.mockReset();
  mocks.remove.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("comparison setup", () => {
  it("excludes ineligible candidates and freezes selected setup on start", async () => {
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "New Comparison" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Revision 03/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 02/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 01/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Compatible project timeline/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Comparison" }));

    expect(screen.getByRole("heading", { name: "Comparison Session" })).toBeInTheDocument();
    expect(screen.getByText("2 candidates")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full Song Not complete" })).toBeInTheDocument();
  });

  it("adds a custom timestamp region and selects it", async () => {
    mocks.add.mockResolvedValue({ regionId: "verse", name: "Verse", startSeconds: 10, endSeconds: 40, builtIn: false });
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Verse" } });
    fireEvent.change(screen.getByLabelText("Region start"), { target: { value: "0:10" } });
    fireEvent.change(screen.getByLabelText("Region end"), { target: { value: "0:40" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));

    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ name: "Verse", startSeconds: 10, endSeconds: 40 })));
    expect(await screen.findByRole("checkbox", { name: /Verse/ })).toBeChecked();
  });
});

const frozen: FrozenComparisonSession = {
  candidates: [{ revisionId: "r1", revisionNumber: 1, blindId: "A" }, { revisionId: "r2", revisionNumber: 2, blindId: "B" }],
  regions: [{ regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true }],
  loudnessMatch: false,
};

describe("blind comparison workspace shell", () => {
  it("keeps mapping stable and suppresses candidate shortcuts while notes have focus", () => {
    render(<ComparisonWorkspace session={frozen} onCancel={vi.fn()} />);
    const notes = screen.getByRole("textbox", { name: "Notes for Candidate A" });
    fireEvent.keyDown(notes, { key: "B" });
    expect(screen.getByText("Candidate A", { selector: "strong" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "B" });
    expect(screen.getByText("Candidate B", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes for Candidate B" })).toBeInTheDocument();
  });

  it("warns only after session work is entered", () => {
    const onCancel = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { rerender } = render(<ComparisonWorkspace session={frozen} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();

    onCancel.mockClear();
    rerender(<ComparisonWorkspace session={frozen} onCancel={onCancel} />);
    fireEvent.change(within(screen.getByRole("region", { name: "Candidate notes" })).getByRole("textbox"), { target: { value: "Prefer this" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
