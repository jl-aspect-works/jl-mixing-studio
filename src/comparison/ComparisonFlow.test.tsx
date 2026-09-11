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
    { revisionId: "r1", revisionNumber: 1, eligible: true, reason: null, relativePath: "04_Revisions/Revision_01/mix.wav" },
    { revisionId: "r2", revisionNumber: 2, eligible: true, reason: null, relativePath: "04_Revisions/Revision_02/mix.wav" },
    { revisionId: "r3", revisionNumber: 3, eligible: false, reason: "No playable WAV file was found.", relativePath: null },
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
    fireEvent.click(screen.getByRole("button", { name: "Start Comparison" }));

    expect(screen.getByRole("heading", { name: "Comparison Session" })).toBeInTheDocument();
    expect(screen.getByText("2 candidates")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full Song Not complete" })).toBeInTheDocument();
  });

  it("adds consecutive custom regions and selects them", async () => {
    const verse = { regionId: "verse", name: "Verse", startSeconds: 0, endSeconds: 30, builtIn: false };
    const chorus = { regionId: "chorus", name: "Chorus", startSeconds: 0, endSeconds: 30, builtIn: false };
    mocks.get
      .mockResolvedValueOnce(setup)
      .mockResolvedValueOnce({ ...setup, document: { ...setup.document, regions: [...setup.document.regions, verse] } })
      .mockResolvedValueOnce({ ...setup, document: { ...setup.document, regions: [...setup.document.regions, verse, chorus] } });
    mocks.add
      .mockResolvedValueOnce(verse)
      .mockResolvedValueOnce(chorus);
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Verse" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));

    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ name: "Verse", startSeconds: 0, endSeconds: 30 })));
    expect(await screen.findByRole("checkbox", { name: /Verse/ })).toBeChecked();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Chorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));

    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
    expect(mocks.add).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Chorus", startSeconds: 0, endSeconds: 30 }));
    expect(await screen.findByRole("checkbox", { name: /Chorus/ })).toBeChecked();
  });

  it("uses guidance instead of a timeline confirmation gate", async () => {
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });

    expect(screen.getByText("Select 2 or more versions to compare. Variants and revisions without playable files are excluded from this list.")).toBeInTheDocument();
    expect(screen.getByText("Make sure the selected revisions have the same song structure.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Compatible project timeline/ })).not.toBeInTheDocument();
    expect(screen.getByText("Matches the loudness of the revisions being compared.")).toBeInTheDocument();
  });

  it("enables region preview from the highest selected revision", async () => {
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    expect(screen.getByText("Select at least one revision to enable preview.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 01/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 02/ }));
    expect(screen.getByText("Using highest selected: Revision 02")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back 5 seconds" }).querySelector(".action-icon")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Forward 5 seconds" }).querySelector(".action-icon")).not.toBeNull();
  });
});

const frozen: FrozenComparisonSession = {
  candidates: [{ revisionId: "r1", revisionNumber: 1, blindId: "A" }, { revisionId: "r2", revisionNumber: 2, blindId: "B" }],
  regions: [{ regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true }],
  loudnessMatch: false,
};

describe("blind comparison workspace shell", () => {
  it("stacks the icon transport above the blind candidate selector", () => {
    render(<ComparisonWorkspace session={frozen} onCancel={vi.fn()} />);
    const transport = screen.getByLabelText("Comparison transport");
    const candidates = screen.getByLabelText("Blind candidates");
    expect(transport.compareDocumentPosition(candidates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(transport.querySelectorAll(".action-icon")).toHaveLength(6);
  });

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
    const { rerender } = render(<ComparisonWorkspace session={frozen} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();

    onCancel.mockClear();
    rerender(<ComparisonWorkspace session={frozen} onCancel={onCancel} />);
    fireEvent.change(within(screen.getByRole("region", { name: "Candidate notes" })).getByRole("textbox"), { target: { value: "Prefer this" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Discard unfinished comparison" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard Comparison" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
