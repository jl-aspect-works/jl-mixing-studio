import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listProjectFiles, type ProjectFileListing } from "./projectFileService";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

const listing = (extension = "m4a"): ProjectFileListing => ({
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
      id: `04_Revisions/Revision_01/Mix.${extension}`,
      relativePath: `04_Revisions/Revision_01/Mix.${extension}`,
      displayName: `Mix.${extension}`,
      extension,
      entryType: "file",
      area: "revisions",
      sizeBytes: 1024,
      modifiedEpochMs: null,
      isAudio: true,
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

describe("project file native preview eligibility", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("promotes every recognized audio type to native preview eligibility", async () => {
    mockedInvoke
      .mockResolvedValueOnce(listing("m4a"))
      .mockResolvedValueOnce({ supported: true });

    const result = await listProjectFiles({
      clientId: "client-1",
      projectId: "project-1",
      relativePath: "04_Revisions/Revision_01",
    });

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "list_project_files", {
      request: {
        clientId: "client-1",
        projectId: "project-1",
        relativePath: "04_Revisions/Revision_01",
      },
    });
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "get_native_project_audio_preview_status");
    expect(result.entries[0].playable).toBe(true);
  });
});
