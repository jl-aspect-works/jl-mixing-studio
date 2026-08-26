import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedFileOperationDialog } from "./ManagedFileOperationDialog";
import {
  chooseManagedImportSources,
  executeAudioPrepReset,
  executeManagedImport,
  planAudioPrepReset,
  planManagedImport,
} from "./managedClientFilesService";

vi.mock("./managedClientFilesService", async () => {
  const actual = await vi.importActual<typeof import("./managedClientFilesService")>("./managedClientFilesService");
  return {
    ...actual,
    chooseManagedImportSources: vi.fn(),
    executeAudioPrepReset: vi.fn(),
    executeManagedImport: vi.fn(),
    planAudioPrepReset: vi.fn(),
    planManagedImport: vi.fn(),
  };
});

const importPlan = {
  operation: "client.files.import",
  source_kind: "files",
  sources: ["/incoming/vocal.wav"],
  plan_id: "a".repeat(64),
  files: [{ relative_path: "vocal.wav", source_path: "/incoming/vocal.wav", zip_member: null, size: 100, fingerprint: "file:100:1" }],
  items: [
    { id: "original:0", area: "original_delivery", source_relative_path: "vocal.wav", destination_relative_path: "01_Client_Files/Original_Delivery/vocal.wav", action: "replace_candidate", conflict: true, destination_state: "file:90:1", size_bytes: 100 },
    { id: "audio:0", area: "audio_prep", source_relative_path: "vocal.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/vocal.wav", action: "replace_candidate", conflict: true, destination_state: "file:80:1", size_bytes: 100, depends_on: "original:0" },
  ],
};

const mixedPlan = {
  ...importPlan,
  sources: ["/incoming/vocal.wav", "/incoming/bass.wav"],
  files: [
    importPlan.files[0],
    { relative_path: "bass.wav", source_path: "/incoming/bass.wav", zip_member: null, size: 110, fingerprint: "file:110:1" },
  ],
  items: [
    ...importPlan.items,
    { id: "original:1", area: "original_delivery", source_relative_path: "bass.wav", destination_relative_path: "01_Client_Files/Original_Delivery/bass.wav", action: "create", conflict: false, destination_state: "missing", size_bytes: 110 },
    { id: "audio:1", area: "audio_prep", source_relative_path: "bass.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/bass.wav", action: "create", conflict: false, destination_state: "missing", size_bytes: 110, depends_on: "original:1" },
  ],
};

const success = { ok: true, status: "success", message: "", data: { result: { items: [{ id: "original:0", result: "replaced" }, { id: "audio:0", result: "replaced" }], invalidations: [] } } };

const mocked = <T,>(value: T) => vi.mocked(value);

afterEach(cleanup);

describe("ManagedFileOperationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked(chooseManagedImportSources).mockResolvedValue(["/incoming/vocal.wav"]);
    mocked(planManagedImport).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: importPlan } });
    mocked(executeManagedImport).mockResolvedValue(success);
  });

  it("moves from review into post-import validation after executing selected file decisions", async () => {
    const completed = vi.fn();
    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="import" onClose={vi.fn()} onCompleted={completed} />);

    fireEvent.click(screen.getByRole("button", { name: /Files/ }));
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("columnheader", { name: "File" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Import" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Client Files" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Audio Prep" })).toBeInTheDocument();
    expect(within(table).getByText("vocal.wav")).toBeInTheDocument();
    expect(screen.getByLabelText("Import selection for vocal.wav")).toHaveValue("add");
    expect(screen.getByText("1 file has 2 destination conflicts. 2 decisions remain.")).toBeInTheDocument();
    expect(screen.getAllByText("Decision required")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Import Files" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Client Files action for vocal.wav"), { target: { value: "replace" } });
    expect(screen.getByText("1 file has 2 destination conflicts. 1 decision remains.")).toBeInTheDocument();
    expect(screen.getAllByText("Decision required")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Import Files" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Audio Prep action for vocal.wav"), { target: { value: "skip" } });
    expect(screen.getByText("1 file has 2 destination conflicts. 0 decisions remain.")).toBeInTheDocument();
    expect(screen.queryByText("Decision required")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Files" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Import Files" }));

    await waitFor(() => expect(executeManagedImport).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "client",
      projectId: "project",
      planId: importPlan.plan_id,
      decisions: { "original:0": "replace", "audio:0": "skip" },
      selectedRelativePaths: ["vocal.wav"],
    })));
    expect(await screen.findByText("Checking imported files…")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(completed).toHaveBeenCalledOnce();
  });

  it("passes only Add-selected files and ignores conflicts on skipped files", async () => {
    mocked(chooseManagedImportSources).mockResolvedValue(["/incoming/vocal.wav", "/incoming/bass.wav"]);
    mocked(planManagedImport).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: mixedPlan } });
    mocked(executeManagedImport).mockResolvedValue({ ok: true, status: "success", message: "", data: { result: { items: [{ id: "original:1", result: "created" }, { id: "audio:1", result: "created" }], invalidations: [] } } });

    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="import" onClose={vi.fn()} onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Files/ }));
    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText("Import selection for vocal.wav"), { target: { value: "skip" } });
    expect(screen.getAllByText("Skipped")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Import Files" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Import Files" }));

    await waitFor(() => expect(executeManagedImport).toHaveBeenCalledWith(expect.objectContaining({ selectedRelativePaths: ["bass.wav"], decisions: {} })));
  });

  it("supports Add All and Skip All while preserving per-file choices", async () => {
    mocked(chooseManagedImportSources).mockResolvedValue(["/incoming/vocal.wav", "/incoming/bass.wav"]);
    mocked(planManagedImport).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: mixedPlan } });

    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="import" onClose={vi.fn()} onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Files/ }));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Skip All" }));
    expect(screen.getByLabelText("Import selection for vocal.wav")).toHaveValue("skip");
    expect(screen.getByLabelText("Import selection for bass.wav")).toHaveValue("skip");
    expect(screen.getByText("No files are selected for import. Choose Add for at least one file to continue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Files" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add All" }));
    expect(screen.getByLabelText("Import selection for vocal.wav")).toHaveValue("add");
    expect(screen.getByLabelText("Import selection for bass.wav")).toHaveValue("add");
    expect(screen.getByRole("button", { name: "Import Files" })).toBeDisabled();
  });

  it("supports apply-to-all for selected destination conflicts", async () => {
    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="import" onClose={vi.fn()} onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Files/ }));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Replace All" }));
    expect(screen.getByLabelText("Client Files action for vocal.wav")).toHaveValue("replace");
    expect(screen.getByLabelText("Audio Prep action for vocal.wav")).toHaveValue("replace");
  });

  it("returns to source choice when the native picker is cancelled", async () => {
    mocked(chooseManagedImportSources).mockResolvedValue([]);
    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="import" onClose={vi.fn()} onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /ZIP Archive/ }));
    expect(await screen.findByText("Choose what the client delivered.")).toBeInTheDocument();
    expect(planManagedImport).not.toHaveBeenCalled();
  });

  it("plans all selected Client Files for Audio Prep reset", async () => {
    const resetPlan = {
      ...importPlan,
      operation: "audio.prep.reset",
      source_kind: "original_delivery",
      sources: ["vocal.wav", "bass.wav"],
      files: [
        { relative_path: "vocal.wav", source_path: "/project/Original_Delivery/vocal.wav", zip_member: null, size: 100, fingerprint: "file:100:1" },
        { relative_path: "bass.wav", source_path: "/project/Original_Delivery/bass.wav", zip_member: null, size: 110, fingerprint: "file:110:1" },
      ],
      items: [
        { id: "audio:0", area: "audio_prep", source_relative_path: "vocal.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/vocal.wav", action: "create", conflict: false, destination_state: "missing", size_bytes: 100 },
        { id: "audio:1", area: "audio_prep", source_relative_path: "bass.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/bass.wav", action: "create", conflict: false, destination_state: "missing", size_bytes: 110 },
      ],
    };
    mocked(planAudioPrepReset).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: resetPlan } });
    mocked(executeAudioPrepReset).mockResolvedValue({ ok: true, status: "success", message: "", data: { result: { items: [], invalidations: [] } } });

    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="audioPrepReset" relativePaths={["vocal.wav", "bass.wav"]} onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(await screen.findByText("No existing project files will be overwritten.")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).queryByRole("columnheader", { name: "Import" })).not.toBeInTheDocument();
    expect(within(table).getAllByText("Source")).toHaveLength(2);
    expect(within(table).getAllByText("Add")).toHaveLength(2);
    expect(planAudioPrepReset).toHaveBeenCalledWith({ clientId: "client", projectId: "project", relativePaths: ["vocal.wav", "bass.wav"] });
  });

  it("shows a renamed SHA match as the Audio Prep target", async () => {
    const resetPlan = {
      ...importPlan,
      operation: "audio.prep.reset",
      source_kind: "original_delivery",
      sources: ["vocal.wav"],
      items: [{ id: "audio:0", area: "audio_prep", source_relative_path: "vocal.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/Lead Vox.wav", action: "replace_candidate", conflict: true, destination_state: "file:100:1", size_bytes: 100 }],
    };
    mocked(planAudioPrepReset).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: resetPlan } });
    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="audioPrepReset" relativePaths={["vocal.wav"]} onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(await screen.findByText("Matched: Lead Vox.wav")).toBeInTheDocument();
  });
});
