import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectFileListing } from "./projectFileService";
import { ProjectFileBrowser } from "./ProjectFileBrowser";

const { listProjectFiles, revealProjectFile } = vi.hoisted(() => ({
  listProjectFiles: vi.fn(),
  revealProjectFile: vi.fn(),
}));

vi.mock("./projectFileService", async () => {
  const actual = await vi.importActual<typeof import("./projectFileService")>("./projectFileService");
  return { ...actual, listProjectFiles, revealProjectFile };
});

const listing: ProjectFileListing = {
  relativePath: "04_Revisions/Revision_01",
  area: "revisions",
  permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
  entries: [{
    id: "mix",
    relativePath: "04_Revisions/Revision_01/Mix.wav",
    displayName: "Mix.wav",
    extension: "wav",
    entryType: "file",
    area: "revisions",
    sizeBytes: 1234,
    modifiedEpochMs: 1,
    isAudio: true,
    playable: false,
    permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
  }],
};

afterEach(() => {
  cleanup();
  listProjectFiles.mockReset();
  revealProjectFile.mockReset();
});

describe("ProjectFileBrowser shared-storage resilience", () => {
  it("shows a shell failure and permits retry without losing the selected path", async () => {
    const message = "Unable to select the item in File Explorer. Reconnect the network share and try Reveal again.";
    listProjectFiles.mockResolvedValue(listing);
    revealProjectFile.mockRejectedValueOnce(message).mockResolvedValueOnce({ relativePath: listing.entries[0].relativePath });
    render(<ProjectFileBrowser clientId="client" projectId="project" initialPath={listing.relativePath} />);

    await screen.findByText("Mix.wav");
    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reveal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Reveal" })).toBeEnabled());
    fireEvent.click(screen.getByRole("menuitem", { name: "Reveal" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(revealProjectFile).toHaveBeenCalledTimes(2);
    expect(revealProjectFile).toHaveBeenLastCalledWith({ clientId: "client", projectId: "project", relativePath: listing.entries[0].relativePath });
  });

  it("shows progress and disables duplicate file actions while storage is slow", async () => {
    let finishReveal!: () => void;
    const revealPending = new Promise<void>((resolve) => {
      finishReveal = resolve;
    });
    listProjectFiles.mockResolvedValue(listing);
    revealProjectFile.mockReturnValue(revealPending);

    render(<ProjectFileBrowser clientId="client" projectId="project" initialPath="04_Revisions/Revision_01" />);

    await screen.findByText("Mix.wav");
    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reveal" }));

    expect(screen.getByRole("status")).toHaveTextContent("Revealing Mix.wav…");
    const revealAction = screen.getByRole("menuitem", { name: "Reveal" });
    expect(revealAction).toBeDisabled();
    fireEvent.click(revealAction);
    expect(revealProjectFile).toHaveBeenCalledTimes(1);

    finishReveal();
  });
});
