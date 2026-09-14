import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientSummary, ProjectSummary } from "../types";
import { ComparisonFlow } from "./ComparisonFlow";
import { ComparisonWorkspace } from "./ComparisonWorkspace";
import type { CompletedComparisonSession, ComparisonResultsData, ComparisonSetupData, FrozenComparisonSession } from "./models";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  results: vi.fn(),
  complete: vi.fn(),
  deleteSession: vi.fn(),
  clearHistory: vi.fn(),
  analyzeLoudness: vi.fn(),
  waveform: vi.fn(),
  playbackPrepare: vi.fn(),
  playbackSwitch: vi.fn(),
  playbackSeek: vi.fn(),
  playbackRegion: vi.fn(),
  playbackToggle: vi.fn(),
  playbackPause: vi.fn(),
  playbackRefresh: vi.fn(),
  playbackRetry: vi.fn(),
  playbackVolume: vi.fn(),
  playbackDispose: vi.fn(),
}));

vi.mock("./comparisonService", () => ({
  getComparisonSetup: mocks.get,
  addComparisonRegion: mocks.add,
  updateComparisonRegion: mocks.update,
  deleteComparisonRegion: mocks.remove,
  getComparisonResults: mocks.results,
  completeComparisonSession: mocks.complete,
  deleteComparisonSession: mocks.deleteSession,
  clearComparisonHistory: mocks.clearHistory,
  analyzeComparisonLoudness: mocks.analyzeLoudness,
}));

vi.mock("../project/files/audioPreviewService", () => ({
  getProjectAudioWaveform: mocks.waveform,
}));

vi.mock("../project/files/AudioPreviewPlayer", () => ({
  AudioPreviewPlayer: ({ onPositionChange, seekRequest }: { onPositionChange?: (seconds: number) => void; seekRequest?: { seconds: number } | null }) =>
    <button type="button" aria-label="Preview playback" data-seek-position={seekRequest?.seconds ?? ""} onClick={() => onPositionChange?.(42)}>Preview playback</button>,
}));

vi.mock("./comparisonPlaybackService", () => ({
  ComparisonPlaybackSession: class {
    prepare = mocks.playbackPrepare;
    switchCandidate = mocks.playbackSwitch;
    seek = mocks.playbackSeek;
    setRegion = mocks.playbackRegion;
    toggle = mocks.playbackToggle;
    pause = mocks.playbackPause;
    refresh = mocks.playbackRefresh;
    retry = mocks.playbackRetry;
    setVolume = mocks.playbackVolume;
    setLoop = vi.fn();
    dispose = mocks.playbackDispose;
  },
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
  mocks.results.mockReset();
  mocks.complete.mockReset();
  mocks.deleteSession.mockReset();
  mocks.clearHistory.mockReset();
  mocks.analyzeLoudness.mockReset().mockResolvedValue({
    candidates: [
      { revisionId: "r1", revisionNumber: 1, relativePath: "04_Revisions/Revision_01/mix.wav", integratedLufs: -18, appliedGainDb: 0, cacheState: "analyzed" },
      { revisionId: "r2", revisionNumber: 2, relativePath: "04_Revisions/Revision_02/mix.wav", integratedLufs: -15, appliedGainDb: -3, cacheState: "analyzed" },
    ],
  });
  mocks.waveform.mockReset().mockResolvedValue({ durationSeconds: 120, peaks: [.1, .5, .9, .4] });
  const playback = { activeCandidateId: "A", playing: false, currentSeconds: 0, durationSeconds: 120 };
  mocks.playbackPrepare.mockReset().mockResolvedValue(playback);
  mocks.playbackSwitch.mockReset().mockImplementation(async (candidateId: string) => ({ ...playback, activeCandidateId: candidateId }));
  mocks.playbackSeek.mockReset().mockImplementation(async (seconds: number) => ({ ...playback, currentSeconds: seconds }));
  mocks.playbackRegion.mockReset().mockImplementation(async (region: { startSeconds: number }) => ({ ...playback, currentSeconds: region.startSeconds }));
  mocks.playbackToggle.mockReset().mockResolvedValue({ ...playback, playing: true });
  mocks.playbackPause.mockReset().mockResolvedValue(playback);
  mocks.playbackRefresh.mockReset().mockResolvedValue(playback);
  mocks.playbackRetry.mockReset().mockResolvedValue(playback);
  mocks.playbackVolume.mockReset().mockResolvedValue(playback);
  mocks.playbackDispose.mockReset().mockResolvedValue(undefined);
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

    expect(await screen.findByRole("heading", { name: "Comparison Session" })).toBeInTheDocument();
    expect(screen.getByText("2 candidates")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full Song Active" })).toBeInTheDocument();
  });

  it("allows a comparison to evaluate a custom region without requiring Full Song", async () => {
    const intro = { regionId: "intro", name: "Intro", startSeconds: 0, endSeconds: 20, builtIn: false };
    mocks.get.mockResolvedValue({ ...setup, document: { ...setup.document, regions: [...setup.document.regions, intro] } });
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });

    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 02/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 01/ }));
    const fullSong = screen.getByRole("checkbox", { name: /Full Song/ });
    expect(fullSong).toBeEnabled();
    expect(fullSong).toBeChecked();
    fireEvent.click(fullSong);
    expect(screen.getByRole("button", { name: "Start Comparison" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Intro/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Comparison" }));

    expect(await screen.findByRole("heading", { name: "Intro: Candidate A" })).toBeInTheDocument();
    expect(screen.getByLabelText("Region completion progress")).toHaveTextContent("IntroActive");
    expect(screen.getByLabelText("Region completion progress")).not.toHaveTextContent("Full Song");
  });

  it("adds consecutive custom regions and selects them", async () => {
    const verse = { regionId: "verse", name: "Verse", startSeconds: 0, endSeconds: 30, builtIn: false };
    const chorus = { regionId: "chorus", name: "Chorus", startSeconds: 30, endSeconds: 60, builtIn: false };
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
    expect(screen.getByLabelText("Region start")).toHaveValue("0:30");
    expect(screen.getByLabelText("Region end")).toHaveValue("0:30");
    fireEvent.change(screen.getByLabelText("Region end"), { target: { value: "1:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));

    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
    expect(mocks.add).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Chorus", startSeconds: 30, endSeconds: 60 }));
    expect(await screen.findByRole("checkbox", { name: /Chorus/ })).toBeChecked();
  });

  it("shows revision descriptions and select-all controls without setup guidance copy", async () => {
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });

    expect(screen.queryByText("Select 2 or more versions to compare. Variants and revisions without playable files are excluded from this list.")).not.toBeInTheDocument();
    expect(screen.queryByText("Make sure the selected revisions have the same song structure.")).not.toBeInTheDocument();
    expect(screen.getByText("Revision 1")).toBeInTheDocument();
    expect(screen.getByText("Revision 2")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Compatible project timeline/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all revisions" }));
    expect(screen.getByRole("checkbox", { name: /Revision 01/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Revision 02/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Revision 03/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select all regions" })).toBeChecked();
    expect(screen.getByText("Matches the loudness of the revisions being compared.")).toBeInTheDocument();
  });

  it("requires all selected candidates to analyze before starting a loudness-matched session", async () => {
    mocks.analyzeLoudness.mockRejectedValueOnce(new Error("Revision 02 could not be analyzed."));
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 02/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision 01/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Comparison" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Revision 02 could not be analyzed.");
    expect(alert).toHaveTextContent("Exclude the affected revision or turn Loudness Match Off for this session.");
    expect(screen.getByRole("heading", { name: "New Comparison" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Loudness Match/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Comparison" }));
    expect(screen.getByRole("heading", { name: "Comparison Session" })).toBeInTheDocument();
    expect(mocks.analyzeLoudness).toHaveBeenCalledOnce();
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
    const regionCheckboxes = within(regionList).getAllByRole("checkbox");
    expect(regionCheckboxes[0].parentElement?.textContent).toContain("Select all regions");
    expect(regionCheckboxes.slice(1).map((checkbox) => checkbox.parentElement?.textContent)).toEqual([
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

  it("moves start and end to the playhead when setting start past the current region end", async () => {
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    fireEvent.change(await screen.findByRole("slider", { name: "Preview playhead" }), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Set start to playhead" }));

    expect(screen.getByLabelText("Start")).toHaveValue("0:45");
    expect(screen.getByLabelText("End")).toHaveValue("0:45");
  });

  it("generates a sequential region name when the name field is blank", async () => {
    const generated = { regionId: "region-1", name: "Region 01", startSeconds: 0, endSeconds: 30, builtIn: false };
    mocks.get
      .mockResolvedValueOnce(setup)
      .mockResolvedValueOnce({ ...setup, document: { ...setup.document, regions: [...setup.document.regions, generated] } });
    mocks.add.mockResolvedValueOnce(generated);
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "New Comparison" });
    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));

    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ name: "Region 01", startSeconds: 0, endSeconds: 30 })));
    expect(await screen.findByRole("checkbox", { name: /Region 01/ })).toBeChecked();
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
  candidates: [
    { revisionId: "r1", revisionNumber: 1, blindId: "A", relativePath: "04_Revisions/Revision_01/mix.wav", integratedLufs: null, appliedGainDb: null },
    { revisionId: "r2", revisionNumber: 2, blindId: "B", relativePath: "04_Revisions/Revision_02/mix.wav", integratedLufs: null, appliedGainDb: null },
  ],
  regions: [{ regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true }],
  loudnessMatch: false,
};

const completedSession: CompletedComparisonSession = {
  sessionId: "session-1",
  completedAt: "2026-01-02T03:04:05Z",
  candidates: [
    { revisionId: "r1", revisionNumber: 1, blindId: "A", integratedLufs: -18.2, appliedGainDb: 0 },
    { revisionId: "r2", revisionNumber: 2, blindId: "B", integratedLufs: -16.2, appliedGainDb: -2 },
  ],
  regions: [
    {
      region: { regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null },
      rankRows: [["r1"], ["r2"]],
      notes: { r1: "More balanced" },
    },
    {
      region: { regionId: "chorus", name: "Chorus", startSeconds: 45, endSeconds: 75 },
      rankRows: [["r2"], ["r1"]],
      notes: {},
    },
  ],
  loudnessMatch: true,
};

const comparisonResults = (session: CompletedComparisonSession = completedSession): ComparisonResultsData => ({
  document: {
    schemaVersion: 1,
    regions: setup.document.regions,
    completedSessions: [session],
  },
  fullSongStandings: [
    { revisionId: "r2", revisionNumber: 2, averagePlacement: 1, contributingSessions: 2 },
    { revisionId: "r1", revisionNumber: 1, averagePlacement: 1.5, contributingSessions: 2 },
  ],
  regionalStandings: [
    {
      region: { regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null },
      standings: [
        { revisionId: "r2", revisionNumber: 2, averagePlacement: 1, contributingSessions: 2 },
        { revisionId: "r1", revisionNumber: 1, averagePlacement: 1.5, contributingSessions: 2 },
      ],
    },
    {
      region: { regionId: "chorus", name: "Chorus", startSeconds: 45, endSeconds: 75 },
      standings: [
        { revisionId: "r2", revisionNumber: 2, averagePlacement: 1, contributingSessions: 1 },
        { revisionId: "r1", revisionNumber: 1, averagePlacement: 2, contributingSessions: 1 },
      ],
    },
  ],
});

const workspace = (session: FrozenComparisonSession = frozen, onCancel = vi.fn(), onComplete = vi.fn().mockResolvedValue(undefined)) =>
  <ComparisonWorkspace clientId="c1" projectId="p1" session={session} onCancel={onCancel} onComplete={onComplete} />;

describe("blind comparison workspace shell", () => {
  it("stacks the icon transport above the blind candidate selector", () => {
    render(workspace());
    const transport = screen.getByLabelText("Comparison transport");
    const candidates = screen.getByLabelText("Blind candidates");
    const progress = screen.getByLabelText("Region completion progress");
    expect(candidates.closest(".comparison-session-control-grid")).toHaveClass("side-by-side");
    expect(transport.compareDocumentPosition(candidates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(candidates.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(transport.querySelectorAll(".action-icon")).toHaveLength(6);
    expect(within(transport).getAllByRole("button")).toHaveLength(6);
    expect(within(transport).getAllByRole("button").every((button) => button.classList.contains("icon-only"))).toBe(true);
    expect(screen.getByRole("heading", { name: "Session Progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rank Ordering" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Full Song: Candidate A" })).toBeInTheDocument();
    expect(screen.queryByText(/Selected: Candidate/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Region completion progress")).toHaveTextContent("Full SongActive");
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate B")).toBeInTheDocument();
    expect(screen.getByLabelText("Rank ordering")).toHaveTextContent("Drop Candidate A or press 1");
    expect(screen.getByLabelText("Rank slot 2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Comparison regions")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Ranking destination for Candidate A" })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTitle("Select Candidate A"));
    expect(screen.getByRole("menu", { name: "Move Candidate A" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Place in slot 1" })).toBeInTheDocument();
  });

  it("stacks candidate switch and session progress when six or more regions are evaluated", () => {
    const manyRegions: FrozenComparisonSession = {
      ...frozen,
      regions: Array.from({ length: 6 }, (_, index) => ({
        regionId: `region-${index + 1}`,
        name: index === 0 ? "Full Song" : `Verse ${index}`,
        startSeconds: index * 10,
        endSeconds: index === 0 ? null : (index + 1) * 10,
        builtIn: index === 0,
      })),
    };
    render(workspace(manyRegions));

    expect(screen.getByLabelText("Blind candidates").closest(".comparison-session-control-grid")).toHaveClass("stacked");
  });

  it("ignores startup preparation failures from a disposed playback session", async () => {
    let rejectAbandonedPrepare: (error: Error) => void = () => {};
    const abandonedPrepare = new Promise<never>((_, reject) => { rejectAbandonedPrepare = reject; });
    mocks.playbackPrepare
      .mockReset()
      .mockImplementationOnce(() => abandonedPrepare)
      .mockResolvedValueOnce({ activeCandidateId: "A", playing: false, currentSeconds: 0, durationSeconds: 120 });
    const { rerender } = render(workspace());
    await waitFor(() => expect(mocks.playbackPrepare).toHaveBeenCalledOnce());

    rerender(workspace({
      ...frozen,
      candidates: frozen.candidates.map((candidate) => ({ ...candidate })),
      regions: frozen.regions.map((region) => ({ ...region })),
    }));
    await waitFor(() => expect(mocks.playbackPrepare).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeEnabled());

    await act(async () => {
      rejectAbandonedPrepare(new Error("Comparison playback session is closed."));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByText("Comparison playback session is closed.")).not.toBeInTheDocument();
  });

  it("keeps mapping stable and suppresses candidate shortcuts while notes have focus", async () => {
    render(workspace());
    await waitFor(() => expect(within(screen.getByLabelText("Blind candidates")).getByRole("button", { name: "B" })).toBeEnabled());
    const notes = screen.getByRole("textbox", { name: "Notes for Candidate A" });
    fireEvent.keyDown(notes, { key: "B" });
    expect(screen.getByRole("heading", { name: "Full Song: Candidate A" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "B" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Full Song: Candidate B" })).toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Notes for Candidate B" })).toBeInTheDocument();
  });

  it("warns only after session work is entered", () => {
    const onCancel = vi.fn();
    const { rerender } = render(workspace(frozen, onCancel));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();

    onCancel.mockClear();
    rerender(workspace(frozen, onCancel));
    fireEvent.change(within(screen.getByRole("region", { name: "Candidate notes" })).getByRole("textbox"), { target: { value: "Prefer this" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Discard unfinished comparison" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard Comparison" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("supports drag placement, ties, and splitting ties", () => {
    render(workspace());
    fireEvent.contextMenu(screen.getByTitle("Select Candidate A"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Place in slot 1" }));

    let candidateB = screen.getByTitle("Select Candidate B");
    fireEvent.pointerDown(candidateB, { button: 0, clientX: 20, clientY: 30 });
    const pointerMove = new Event("pointermove", { bubbles: true });
    Object.defineProperties(pointerMove, { clientX: { value: 80 }, clientY: { value: 90 } });
    fireEvent(document, pointerMove);
    expect(screen.getByText("B", { selector: ".comparison-candidate-drag-ghost" })).toHaveStyle({ left: "80px", top: "90px" });
    fireEvent.pointerEnter(screen.getByLabelText("Rank slot 1"));
    expect(screen.getByLabelText("Rank slot 1")).toHaveClass("drag-target");
    fireEvent.pointerUp(screen.getByLabelText("Rank slot 1"));
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();

    candidateB = screen.getByTitle("Select Candidate B");
    fireEvent.pointerDown(candidateB, { button: 0 });
    fireEvent.pointerEnter(screen.getByLabelText("Rank slot 2"));
    fireEvent.pointerUp(screen.getByLabelText("Rank slot 2"));
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 2")).getByTitle("Select Candidate B")).toBeInTheDocument();
  });

  it("uses number shortcuts to place the active candidate while preserving text entry", async () => {
    render(workspace());
    await waitFor(() => expect(within(screen.getByLabelText("Blind candidates")).getByRole("button", { name: "B" })).toBeEnabled());
    fireEvent.keyDown(window, { key: "2" });
    expect(within(screen.getByLabelText("Rank slot 2")).getByTitle("Select Candidate A")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "B" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Full Song: Candidate B" })).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "1" });
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();

    const notes = screen.getByRole("textbox", { name: "Notes for Candidate B" });
    fireEvent.keyDown(notes, { key: "2" });
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();
  });

  it("uses keyboard shortcuts for playback transport controls", async () => {
    mocks.playbackToggle.mockResolvedValueOnce({ activeCandidateId: "A", playing: false, currentSeconds: 0, durationSeconds: 120 });
    render(workspace());
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeEnabled());

    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    await waitFor(() => expect(mocks.playbackToggle).toHaveBeenCalledOnce());

    fireEvent.keyDown(document.body, { key: ".", code: "Period" });
    await waitFor(() => expect(mocks.playbackSeek).toHaveBeenLastCalledWith(5));
    await waitFor(() => expect(screen.getByRole("slider", { name: "Comparison playback position" })).toHaveValue("5"));

    fireEvent.keyDown(document.body, { key: ",", code: "Comma" });
    await waitFor(() => expect(mocks.playbackSeek).toHaveBeenLastCalledWith(0));

    const notes = screen.getByRole("textbox", { name: "Notes for Candidate A" });
    fireEvent.keyDown(notes, { key: ".", code: "Period" });
    expect(mocks.playbackSeek).toHaveBeenCalledTimes(2);
  });

  it("uses arrow keys for previous and next candidate transport controls", async () => {
    render(workspace());
    await waitFor(() => expect(screen.getByRole("button", { name: "Next candidate" })).toBeEnabled());

    fireEvent.keyDown(document.body, { key: "ArrowRight", code: "ArrowRight" });
    await waitFor(() => expect(mocks.playbackSwitch).toHaveBeenLastCalledWith("B"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Full Song: Candidate B" })).toBeInTheDocument());
    await act(async () => {});

    fireEvent.keyDown(document.body, { key: "ArrowLeft", code: "ArrowLeft" });
    await waitFor(() => expect(mocks.playbackSwitch).toHaveBeenLastCalledWith("A"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Full Song: Candidate A" })).toBeInTheDocument());

    const notes = screen.getByRole("textbox", { name: "Notes for Candidate A" });
    fireEvent.keyDown(notes, { key: "ArrowRight", code: "ArrowRight" });
    expect(mocks.playbackSwitch).toHaveBeenCalledTimes(2);
  });

  it("preserves candidate notes while accessible ranking controls move candidates", () => {
    render(workspace());
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for Candidate A" }), { target: { value: "Open top end" } });
    fireEvent.contextMenu(screen.getByTitle("Select Candidate A"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Place in slot 1" }));
    fireEvent.click(screen.getByTitle("Select Candidate B"));
    fireEvent.contextMenu(screen.getByTitle("Select Candidate B"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Place in slot 1" }));
    fireEvent.click(screen.getByTitle("Select Candidate A"));

    expect(screen.getByRole("textbox", { name: "Notes for Candidate A" })).toHaveValue("Open top end");
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();
  });

  it("uses No Preference and gates completion for every region", async () => {
    const multiRegion: FrozenComparisonSession = {
      ...frozen,
      regions: [...frozen.regions, { regionId: "verse", name: "Verse", startSeconds: 10, endSeconds: 30, builtIn: false }],
    };
    render(workspace(multiRegion));
    await waitFor(() => expect(screen.getByRole("button", { name: "Verse Not complete" })).toBeEnabled());
    const reveal = screen.getByRole("button", { name: "Reveal & Complete Comparison" });
    expect(reveal).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "No Preference — tie all at rank 1" }));
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Rank slot 1")).getByTitle("Select Candidate B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Region Complete" }));
    expect(screen.getByLabelText("Region completion progress")).toHaveTextContent("Full SongCompleteVerseNot complete");
    expect(reveal).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Verse Not complete" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Verse Active" })).toBeInTheDocument());
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate A")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Unranked candidates")).getByTitle("Select Candidate B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No Preference — tie all at rank 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Region Complete" }));
    expect(reveal).toBeEnabled();

    fireEvent.contextMenu(screen.getByTitle("Select Candidate A"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to Unranked" }));
    expect(reveal).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verse Active" })).toBeInTheDocument();
  });

  it("persists revealed rankings with real revision identities", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(workspace({
      ...frozen,
      candidates: [
        { ...frozen.candidates[0], integratedLufs: -18.2, appliedGainDb: 0 },
        { ...frozen.candidates[1], integratedLufs: -16.2, appliedGainDb: -2 },
      ],
      loudnessMatch: true,
    }, vi.fn(), onComplete));
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeEnabled());

    fireEvent.change(screen.getByRole("textbox", { name: "Notes for Candidate A" }), { target: { value: "More balanced" } });
    fireEvent.contextMenu(screen.getByTitle("Select Candidate A"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Place in slot 1" }));
    fireEvent.contextMenu(screen.getByTitle("Select Candidate B"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Place in slot 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Region Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal & Complete Comparison" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      candidates: [
        { revisionId: "r1", revisionNumber: 1, blindId: "A", integratedLufs: -18.2, appliedGainDb: 0 },
        { revisionId: "r2", revisionNumber: 2, blindId: "B", integratedLufs: -16.2, appliedGainDb: -2 },
      ],
      regions: [expect.objectContaining({
        region: expect.objectContaining({ regionId: "full-song", name: "Full Song" }),
        rankRows: [["r1"], ["r2"]],
        notes: { r1: "More balanced" },
      })],
      loudnessMatch: true,
    }));
    expect(mocks.playbackPause).toHaveBeenCalled();
    expect(mocks.playbackDispose).toHaveBeenCalled();
  });

  it("reveals completed results, separates session winner from cumulative TOP, and supports history actions", async () => {
    mocks.results.mockResolvedValue(comparisonResults());
    mocks.deleteSession.mockResolvedValue(comparisonResults({ ...completedSession, sessionId: "session-2" }));
    mocks.clearHistory.mockResolvedValue({ ...comparisonResults(), document: { ...comparisonResults().document, completedSessions: [] }, fullSongStandings: [], regionalStandings: [] });
    render(<ComparisonFlow client={client} project={project} onClose={vi.fn()} initialView="results" />);

    expect(await screen.findByRole("heading", { name: "Revealed Session" })).toBeInTheDocument();
    const revisionKey = screen.getByLabelText("Revealed blind mapping");
    expect(within(revisionKey).getByText("A")).toBeInTheDocument();
    expect(screen.getAllByText("Revision 01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revision 01 (A)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revision 02").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revision 02 (B)").length).toBeGreaterThan(0);
    const loudnessDetails = screen.getByLabelText("Loudness matched candidate measurements");
    expect(within(loudnessDetails).getByText("A")).toBeInTheDocument();
    expect(within(loudnessDetails).getAllByText("LUFS")).toHaveLength(1);
    expect(within(loudnessDetails).getAllByText("Gain")).toHaveLength(1);
    expect(within(loudnessDetails).getByText("-18.20")).toBeInTheDocument();
    expect(within(loudnessDetails).getByText("-2.00 dB")).toBeInTheDocument();
    expect(screen.getByText("Full Song Standings")).toBeInTheDocument();
    expect(screen.getByText("Chorus Standings")).toBeInTheDocument();
    expect(screen.getByText("More balanced")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete This Session" }));
    expect(screen.getByRole("alertdialog", { name: "Delete completed comparison session" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete Session" }));
    await waitFor(() => expect(mocks.deleteSession).toHaveBeenCalledWith({ clientId: "c1", projectId: "p1", sessionId: "session-1" }));

    fireEvent.click(screen.getByRole("button", { name: "Clear Ranking History" }));
    expect(screen.getByRole("alertdialog", { name: "Clear ranking history" })).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: "Clear Ranking History" });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    await waitFor(() => expect(mocks.clearHistory).toHaveBeenCalledWith({ clientId: "c1", projectId: "p1" }));
  });

  it("pauses on a runtime candidate failure and requires Retry or Cancel", async () => {
    mocks.playbackSwitch.mockRejectedValueOnce(new Error("Candidate B could not be played."));
    render(workspace());
    const candidateB = await waitFor(() => {
      const button = within(screen.getByLabelText("Blind candidates")).getByRole("button", { name: "B" });
      expect(button).toBeEnabled();
      return button;
    });

    fireEvent.click(candidateB);
    const failure = await screen.findByRole("alert");
    expect(mocks.playbackPause).toHaveBeenCalledOnce();
    expect(within(failure).getByText("Candidate B playback stopped.")).toBeInTheDocument();
    expect(within(failure).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(failure).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Blind candidates")).getByRole("button", { name: "A" })).toBeDisabled();

    fireEvent.click(within(failure).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.playbackRetry).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText("Candidate B playback stopped.")).not.toBeInTheDocument());
  });
});
