import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const success = { ok: true, status: "success", message: "", data: { result: { items: [{ id: "original:0", result: "replaced" }, { id: "audio:0", result: "replaced" }], invalidations: [] } } };

const mocked = <T,>(value: T) => vi.mocked(value);

describe("ManagedFileOperationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked(chooseManagedImportSources).mockResolvedValue(["/incoming/vocal.wav"]);
    mocked(planManagedImport).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: importPlan } });
    mocked(executeManagedImport).mockResolvedValue(success);
  });

  it("plans selected files and requires explicit decisions for every conflict", async () => {
    const completed = vi.fn();
    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="import" onClose={vi.fn()} onCompleted={completed} />);

    fireEvent.click(screen.getByRole("button", { name: /Files/ }));
    expect(await screen.findByRole("heading", { name: "2 files need your attention" })).toBeInTheDocument();
    expect(screen.getByText("Replacing this file will overwrite the current prepared version.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Files" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Replace All" }));
    expect(screen.getByRole("button", { name: "Import Files" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Import Files" }));

    await waitFor(() => expect(executeManagedImport).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "client",
      projectId: "project",
      planId: importPlan.plan_id,
      decisions: { "original:0": "replace", "audio:0": "replace" },
    })));
    expect(await screen.findByText("Import complete")).toBeInTheDocument();
    expect(completed).toHaveBeenCalledOnce();
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
      items: [
        { id: "audio:0", area: "audio_prep", source_relative_path: "vocal.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/vocal.wav", action: "create", conflict: false, destination_state: "missing", size_bytes: 100 },
        { id: "audio:1", area: "audio_prep", source_relative_path: "bass.wav", destination_relative_path: "02_Audio_Preparation/Working_Audio/bass.wav", action: "create", conflict: false, destination_state: "missing", size_bytes: 110 },
      ],
    };
    mocked(planAudioPrepReset).mockResolvedValue({ ok: true, status: "planned", message: "", data: { plan: resetPlan } });
    mocked(executeAudioPrepReset).mockResolvedValue({ ok: true, status: "success", message: "", data: { result: { items: [], invalidations: [] } } });

    render(<ManagedFileOperationDialog clientId="client" projectId="project" mode="audioPrepReset" relativePaths={["vocal.wav", "bass.wav"]} onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(await screen.findByText("No existing project files will be overwritten.")).toBeInTheDocument();
    expect(planAudioPrepReset).toHaveBeenCalledWith({ clientId: "client", projectId: "project", relativePaths: ["vocal.wav", "bass.wav"] });
  });
});
