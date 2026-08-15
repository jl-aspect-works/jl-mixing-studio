import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectFileEntry, ProjectFileListing } from "../project/files/projectFileService";
import { ReferencesView } from "./ReferencesView";

const refresh = vi.fn(async () => undefined);
const addProjectReference = vi.fn(async () => ({ relativePath: "01_Client_Files/References/New.wav" }));
const deleteProjectReference = vi.fn(async () => ({ relativePath: "01_Client_Files/References/Reference.wav" }));
const openProjectFile = vi.fn(async () => ({ relativePath: "01_Client_Files/References/Reference.wav" }));
const revealProjectFile = vi.fn(async () => ({ relativePath: "01_Client_Files/References/Reference.wav" }));
let listing: ProjectFileListing;

vi.mock("../project/files/useProjectFiles", () => ({
  useProjectFiles: () => ({ state: { status: "ready", listing, message: null }, refresh }),
}));

vi.mock("../project/files/projectFileService", async (importOriginal) => {
  const original = await importOriginal<typeof import("../project/files/projectFileService")>();
  return {
    ...original,
    addProjectReference,
    deleteProjectReference,
    openProjectFile,
    revealProjectFile,
  };
});

vi.mock("../project/files/AudioPreviewPlayer", () => ({
  AudioPreviewPlayer: ({ entry }: { entry: ProjectFileEntry }) => <span>Preview {entry.displayName}</span>,
}));

const client = { clientId: "client-1", name: "Client" } as never;
const project = { projectId: "project-1", name: "Project" } as never;
const basePermissions = { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false };

const reference: ProjectFileEntry = {
  id: "01_Client_Files/References/Reference.wav",
  relativePath: "01_Client_Files/References/Reference.wav",
  displayName: "Reference.wav",
  extension: "wav",
  entryType: "file",
  area: "clientReferences",
  sizeBytes: 1234,
  modifiedEpochMs: 1_700_000_000_000,
  isAudio: true,
  playable: true,
  permissions: basePermissions,
};

const renderView = () => render(<ReferencesView
  client={client}
  project={project}
  onProjects={vi.fn()}
  onOverview={vi.fn()}
  onSelectView={vi.fn()}
/>);

describe("ReferencesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing = {
      relativePath: "01_Client_Files/References",
      area: "clientReferences",
      permissions: basePermissions,
      entries: [],
    };
  });

  it("keeps the reference table visible when empty", () => {
    renderView();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("No reference tracks have been added.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Reference" })).toBeInTheDocument();
  });

  it("adds a project-owned reference and refreshes the list", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Add Reference" }));
    await waitFor(() => expect(addProjectReference).toHaveBeenCalledWith({ clientId: "client-1", projectId: "project-1" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("requires confirmation before deleting a reference", async () => {
    listing = { ...listing, entries: [reference] };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView();
    expect(screen.getByText("Preview Reference.wav")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteProjectReference).toHaveBeenCalledWith({
      clientId: "client-1",
      projectId: "project-1",
      relativePath: reference.relativePath,
    }));
    expect(confirm).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
