import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("shows progress and disables duplicate file actions while storage is slow", async () => {
    let finishReveal: (() => void) | null = null;
    listProjectFiles.mockResolvedValue(listing);
    revealProjectFile.mockImplementation(() => new Promise<void>((resolve) => { finishReveal = resolve; }));

    render(<ProjectFileBrowser clientId="client" projectId="project" initialPath="04_Revisions/Revision_01" />);

    await screen.findByText("Mix.wav");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Mix.wav" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reveal" }));

    expect(screen.getByRole("status")).toHaveTextContent("Revealing Mix.wav…");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Mix.wav" }));
    expect(screen.getByRole("menuitem", { name: "Reveal" })).toBeDisabled();
    expect(revealProjectFile).toHaveBeenCalledTimes(1);

    finishReveal?.();
  });
});
