import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  deleteRevisionFile,
  formatProjectFileModified,
  formatProjectFileSize,
  listProjectFiles,
  projectFilePaths,
  renameRevisionFile,
  type ProjectFileListing,
} from "./projectFileService";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

const revisionListing = (): ProjectFileListing => ({
  relativePath: "04_Revisions/Revision_01",
  area: "revisions",
  permissions: {
    canOpen: true,
    canReveal: true,
    canRename: false,
    canDelete: false,
    canCopy: false,
  },
  entries: [
    {
      id: "04_Revisions/Revision_01/Mix.wav",
      relativePath: "04_Revisions/Revision_01/Mix.wav",
      displayName: "Mix.wav",
      extension: "wav",
      entryType: "file",
      area: "revisions",
      sizeBytes: 1024,
      modifiedEpochMs: null,
      isAudio: true,
      playable: true,
      permissions: {
        canOpen: true,
        canReveal: true,
        canRename: false,
        canDelete: false,
        canCopy: false,
      },
    },
    {
      id: "04_Revisions/Revision_01/Revision_Notes.md",
      relativePath: "04_Revisions/Revision_01/Revision_Notes.md",
      displayName: "Revision_Notes.md",
      extension: "md",
      entryType: "file",
      area: "revisions",
      sizeBytes: 512,
      modifiedEpochMs: null,
      isAudio: false,
      playable: false,
      permissions: {
        canOpen: true,
        canReveal: true,
        canRename: false,
        canDelete: false,
        canCopy: false,
      },
    },
  ],
});

describe("projectFileService", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("uses the authoritative Automation project paths", () => {
    expect(projectFilePaths.originalDelivery).toBe("01_Client_Files/Original_Delivery");
    expect(projectFilePaths.references).toBe("01_Client_Files/References");
    expect(projectFilePaths.audioPreparationWorking).toBe("02_Audio_Preparation/Working_Audio");
    expect(projectFilePaths.revisions).toBe("04_Revisions");
    expect(projectFilePaths.finalDelivery).toBe("05_Final_Delivery");
  });

  it("enables mutation only for ordinary managed revision files", async () => {
    mockedInvoke.mockResolvedValueOnce(revisionListing());

    const listing = await listProjectFiles({
      clientId: "client-1",
      projectId: "project-1",
      relativePath: "04_Revisions/Revision_01",
    });

    expect(mockedInvoke).toHaveBeenCalledWith("list_project_files", {
      request: {
        clientId: "client-1",
        projectId: "project-1",
        relativePath: "04_Revisions/Revision_01",
      },
    });
    expect(listing.entries[0].permissions.canRename).toBe(true);
    expect(listing.entries[0].permissions.canDelete).toBe(true);
    expect(listing.entries[1].permissions.canRename).toBe(false);
    expect(listing.entries[1].permissions.canDelete).toBe(false);
  });

  it("uses dedicated revision mutation commands", async () => {
    mockedInvoke.mockResolvedValue({ relativePath: "04_Revisions/Revision_01/Mix Print.wav" });

    await renameRevisionFile(
      {
        clientId: "client-1",
        projectId: "project-1",
        relativePath: "04_Revisions/Revision_01/Mix.wav",
      },
      "Mix Print",
    );
    expect(mockedInvoke).toHaveBeenLastCalledWith("rename_revision_file", {
      request: {
        clientId: "client-1",
        projectId: "project-1",
        relativePath: "04_Revisions/Revision_01/Mix.wav",
        newName: "Mix Print",
      },
    });

    await deleteRevisionFile({
      clientId: "client-1",
      projectId: "project-1",
      relativePath: "04_Revisions/Revision_01/Mix Print.wav",
    });
    expect(mockedInvoke).toHaveBeenLastCalledWith("delete_revision_file", {
      request: {
        clientId: "client-1",
        projectId: "project-1",
        relativePath: "04_Revisions/Revision_01/Mix Print.wav",
      },
    });
  });

  it("formats normalized file sizes", () => {
    expect(formatProjectFileSize(null)).toBe("—");
    expect(formatProjectFileSize(512)).toBe("512 B");
    expect(formatProjectFileSize(1024)).toBe("1.0 KB");
    expect(formatProjectFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });

  it("handles missing modified timestamps", () => {
    expect(formatProjectFileModified(null)).toBe("—");
  });
});
