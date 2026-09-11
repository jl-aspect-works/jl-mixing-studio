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
  waveform: vi.fn(),
}));

vi.mock("./comparisonService", () => ({
  getComparisonSetup: mocks.get,
  addComparisonRegion: mocks.add,
  updateComparisonRegion: mocks.update,
  deleteComparisonRegion: mocks.remove,
}));

vi.mock("../project/files/audioPreviewService", () => ({
  getProjectAudioWaveform: mocks.waveform,
}));

vi.mock("../project/files/AudioPreviewPlayer", () => ({
  AudioPreviewPlayer: ({ onPositionChange, seekRequest }: { onPositionChange?: (seconds: number) => void; seekRequest?: { seconds: number } | null }) =>
    <button type="button" aria-label="Preview playback" data-seek-position={seekRequest?.seconds ?? ""} onClick={() => onPositionChange?.(42)}>Preview playback</button>,
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
  mocks.waveform.mockReset().mockResolvedValue({ durationSeconds: 120, peaks: [.1, .5, .9, .4] });
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

  it("places the full-width region tools below session options and sorts regions by time then duration", async () => {
    const regions = [
      { regionId: "later", name: "Later", startSeconds: 30, endSeconds: 50, builtIn: false },
      { regionId: "short", name: "Short", startSeconds: 0, endSeconds: 10, builtIn: false },
      { regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true },
      { regionId: "long", name: "Long", startSeconds: 0, endSeconds: 20, builtIn: false },
    ];
    mocks.get.mockResolvedValue({ ...setup, document: { ...setup.document, regions } });
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);

    const optionsHeading = await screen.findByRole("heading", { name: "2. Session options" });
    const regionsHeading = screen.getByRole("heading", { name: "3. Select and manage regions" });
    expect(optionsHeading.compareDocumentPosition(regionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(regionsHeading.closest(".comparison-regions-panel")).not.toBeNull();

    const regionList = screen.getByRole("group", { name: "Available regions" });
    expect(within(regionList).getAllByRole("checkbox").map((checkbox) => checkbox.parentElement?.textContent)).toEqual([
      expect.stringContaining("Full Song"),
      expect.stringContaining("Long"),
      expect.stringContaining("Short"),
      expect.stringContaining("Later"),
    ]);
    expect(screen.getByText("Region preview").compareDocumentPosition(regionList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add region" }).compareDocumentPosition(regionList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("defaults preview to the highest playable revision and synchronizes timeline locators", async () => {
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    const selector = screen.getByRole("combobox", { name: "Preview revision" });
    expect(selector).toHaveValue("r2");
    await waitFor(() => expect(mocks.waveform).toHaveBeenCalledWith(expect.objectContaining({ relativePath: expect.stringContaining("Revision_02") })));

    fireEvent.change(selector, { target: { value: "r1" } });
    await waitFor(() => expect(mocks.waveform).toHaveBeenLastCalledWith(expect.objectContaining({ relativePath: expect.stringContaining("Revision_01") })));

    fireEvent.change(await screen.findByRole("slider", { name: "Region start locator" }), { target: { value: "12.5" } });
    expect(screen.getByLabelText("Start")).toHaveValue("0:12.5");
    expect(screen.getByRole("checkbox", { name: "Set playhead to region start" })).not.toBeChecked();
    fireEvent.change(screen.getByRole("slider", { name: "Preview playhead" }), { target: { value: "25" } });
    expect(screen.getByRole("button", { name: "Preview playback" })).toHaveAttribute("data-seek-position", "25");
    fireEvent.click(screen.getByRole("button", { name: "Preview playback" }));
    fireEvent.click(screen.getByRole("button", { name: "Set end to playhead" }));
    expect(screen.getByLabelText("End")).toHaveValue("0:42");
  });

  it("uses the region row to edit and optionally moves the playhead to its start", async () => {
    const verse = { regionId: "verse", name: "Verse", startSeconds: 15, endSeconds: 45, builtIn: false };
    mocks.get.mockResolvedValue({ ...setup, document: { ...setup.document, regions: [...setup.document.regions, verse] } });
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    await screen.findByRole("slider", { name: "Preview playhead" });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Set playhead to region start" }));
    fireEvent.click(screen.getByText("Verse").closest(".comparison-region-row")!);

    expect(await screen.findByRole("slider", { name: "Region start locator" })).toHaveValue("15");
    expect(screen.getByRole("slider", { name: "Region end locator" })).toHaveValue("45");
    await waitFor(() => expect(screen.getByRole("button", { name: "Preview playback" })).toHaveAttribute("data-seek-position", "15"));
  });

  it("deletes a region through the in-app confirmation", async () => {
    const verse = { regionId: "verse", name: "Verse", startSeconds: 15, endSeconds: 45, builtIn: false };
    const withVerse = { ...setup, document: { ...setup.document, regions: [...setup.document.regions, verse] } };
    mocks.get.mockResolvedValueOnce(withVerse).mockResolvedValueOnce(setup);
    mocks.remove.mockResolvedValue(setup.document);
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    expect((await screen.findByText("Verse")).closest(".comparison-region-row")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete Verse" }));
    expect(screen.getByRole("alertdialog", { name: "Delete Verse" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete Region" }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ regionId: "verse" })));
    await waitFor(() => expect(screen.queryByText("Verse")).not.toBeInTheDocument());
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
    expect(screen.getByRole("heading", { name: "Session Progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rank Ordering" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Full Song: Candidate A" })).toBeInTheDocument();
    expect(screen.queryByText(/Selected: Candidate/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Region completion progress")).toHaveTextContent("Full SongActive");
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate B")).toBeInTheDocument();
    expect(screen.getByLabelText("Rank ordering")).toHaveTextContent("Drop Candidate A or press 1");
    expect(screen.getByLabelText("Rank slot 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Ranking destination for Candidate A")).toHaveTextContent("Move to 1");
  });

  it("keeps mapping stable and suppresses candidate shortcuts while notes have focus", () => {
    render(<ComparisonWorkspace session={frozen} onCancel={vi.fn()} />);
    const notes = screen.getByRole("textbox", { name: "Notes for Candidate A" });
    fireEvent.keyDown(notes, { key: "B" });
    expect(screen.getByRole("heading", { name: "Full Song: Candidate A" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "B" });
    expect(screen.getByRole("heading", { name: "Full Song: Candidate B" })).toBeInTheDocument();
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

  it("supports drag placement, ties, and splitting ties", () => {
    render(<ComparisonWorkspace session={frozen} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Ranking destination for Candidate A"), { target: { value: "slot:1" } });

    fireEvent.dragStart(screen.getByTitle("Select Candidate B").closest(".comparison-ranking-candidate")!);
    fireEvent.drop(screen.getByLabelText("Rank slot 1"));
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();

    fireEvent.dragStart(screen.getByTitle("Select Candidate B").closest(".comparison-ranking-candidate")!);
    fireEvent.drop(screen.getByLabelText("Rank slot 2"));
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 2")).getByTitle("Select Candidate B")).toBeInTheDocument();
  });

  it("uses number shortcuts to place the active candidate while preserving text entry", () => {
    render(<ComparisonWorkspace session={frozen} onCancel={vi.fn()} />);
    fireEvent.keyDown(window, { key: "2" });
    expect(within(screen.getByLabelText("Rank slot 2")).getByTitle("Select Candidate A")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "B" });
    fireEvent.keyDown(window, { key: "1" });
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();

    const notes = screen.getByRole("textbox", { name: "Notes for Candidate B" });
    fireEvent.keyDown(notes, { key: "2" });
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();
  });

  it("preserves candidate notes while accessible ranking controls move candidates", () => {
    render(<ComparisonWorkspace session={frozen} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for Candidate A" }), { target: { value: "Open top end" } });
    fireEvent.change(screen.getByLabelText("Ranking destination for Candidate A"), { target: { value: "slot:1" } });
    fireEvent.click(screen.getByTitle("Select Candidate B"));
    fireEvent.change(screen.getByLabelText("Ranking destination for Candidate B"), { target: { value: "slot:1" } });
    fireEvent.click(screen.getByTitle("Select Candidate A"));

    expect(screen.getByRole("textbox", { name: "Notes for Candidate A" })).toHaveValue("Open top end");
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();
  });

  it("uses No Preference and gates completion for every region", () => {
    const multiRegion: FrozenComparisonSession = {
      ...frozen,
      regions: [...frozen.regions, { regionId: "verse", name: "Verse", startSeconds: 10, endSeconds: 30, builtIn: false }],
    };
    render(<ComparisonWorkspace session={multiRegion} onCancel={vi.fn()} />);
    const reveal = screen.getByRole("button", { name: "Reveal & Complete Comparison" });
    expect(reveal).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "No Preference — tie all at rank 1" }));
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Region Complete" }));
    expect(screen.getByLabelText("Region completion progress")).toHaveTextContent("Full SongCompleteVerseNot complete");
    expect(reveal).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Verse Not complete" }));
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No Preference — tie all at rank 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Region Complete" }));
    expect(reveal).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Ranking destination for Candidate A"), { target: { value: "unranked" } });
    expect(reveal).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verse Not complete" })).toBeInTheDocument();
  });
});
