import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RevisionFileBrowser } from "./RevisionFileBrowser";
import type { ProjectFileListing } from "../project/files/projectFileService";

const { refresh, deleteRevisionFile } = vi.hoisted(() => ({
  refresh: vi.fn(),
  deleteRevisionFile: vi.fn(),
}));

const listing: ProjectFileListing = {
  relativePath: "04_Revisions/Revision_01",
  area: "revisions",
  permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false },
  entries: [{
    id: "mix",
    relativePath: "04_Revisions/Revision_01/Mix.wav",
    displayName: "Mix.wav",
    extension: "wav",
    entryType: "file",
    area: "revisions",
    sizeBytes: 1024,
    modifiedEpochMs: null,
    isAudio: false,
    playable: false,
    permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
  }],
};

vi.mock("../project/files/useProjectFiles", () => ({
  useProjectFiles: () => ({ state: { status: "ready", listing, message: null }, refresh }),
}));
vi.mock("../project/files/projectFileService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../project/files/projectFileService")>(),
  deleteRevisionFile,
}));

beforeEach(() => {
  refresh.mockReset().mockResolvedValue(true);
  deleteRevisionFile.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

const openDelete = () => {
  render(<RevisionFileBrowser clientId="client" projectId="project" revision={1} />);
  fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
};

describe("RevisionFileBrowser delete confirmation", () => {
  it("displays a page-level dialog and cancels without deleting", () => {
    openDelete();
    const dialog = screen.getByRole("dialog", { name: "Delete project file" });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.queryByRole("menuitem", { name: "Confirm Delete" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteRevisionFile).not.toHaveBeenCalled();
  });

  it("deletes only on confirmation, refreshes, and reports completion", async () => {
    openDelete();
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    await waitFor(() => expect(deleteRevisionFile).toHaveBeenCalledWith({
      clientId: "client", projectId: "project", relativePath: listing.entries[0].relativePath,
    }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Mix.wav was deleted.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog and row available after backend rejection", async () => {
    deleteRevisionFile.mockRejectedValue(new Error("The NAS path is unavailable."));
    openDelete();
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("NAS path is unavailable");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Filename Mix.wav")).toBeInTheDocument();
  });
});
