import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectFileListing } from "./projectFileService";
import { useProjectFiles } from "./useProjectFiles";

const listProjectFiles = vi.fn();

vi.mock("./projectFileService", async () => {
  const actual = await vi.importActual<typeof import("./projectFileService")>("./projectFileService");
  return { ...actual, listProjectFiles };
});

const listing = (name: string): ProjectFileListing => ({
  relativePath: "04_Revisions/Revision_01",
  area: "revisions",
  permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
  entries: [{
    id: name,
    relativePath: `04_Revisions/Revision_01/${name}`,
    displayName: name,
    extension: "wav",
    entryType: "file",
    area: "revisions",
    sizeBytes: 1234,
    modifiedEpochMs: 1,
    isAudio: true,
    playable: true,
    permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
  }],
});

function Harness() {
  const { state } = useProjectFiles({ clientId: "client", projectId: "project", relativePath: "04_Revisions/Revision_01" });
  return <span>{state.listing?.entries[0]?.displayName ?? "loading"}</span>;
}

afterEach(() => {
  cleanup();
  listProjectFiles.mockReset();
});

describe("useProjectFiles", () => {
  it("refreshes the active folder listing when the Studio window regains focus", async () => {
    listProjectFiles
      .mockResolvedValueOnce(listing("Mix v1.wav"))
      .mockResolvedValueOnce(listing("Mix renamed.wav"));

    render(<Harness />);
    expect(await screen.findByText("Mix v1.wav")).toBeInTheDocument();

    fireEvent.focus(window);

    expect(await screen.findByText("Mix renamed.wav")).toBeInTheDocument();
    await waitFor(() => expect(listProjectFiles).toHaveBeenCalledTimes(2));
  });
});
