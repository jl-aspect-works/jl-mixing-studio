import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { prepareProjectAudioPreview } from "./audioPreviewService";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedConvertFileSrc = vi.mocked(convertFileSrc);

beforeEach(() => {
  mockedInvoke.mockReset();
  mockedConvertFileSrc.mockClear();
});

describe("prepareProjectAudioPreview", () => {
  it("uses the existing web provider when the backend authorizes a preview path", async () => {
    mockedInvoke.mockResolvedValue({
      supported: true,
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
      filePath: "/workspace/project/01_Client_Files/Original_Delivery/Lead.wav",
    });

    const result = await prepareProjectAudioPreview({
      clientId: "acme",
      projectId: "blue-sky",
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
    });

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledWith("prepare_project_audio_preview", {
      request: {
        clientId: "acme",
        projectId: "blue-sky",
        relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
      },
    });
    expect(mockedConvertFileSrc).toHaveBeenCalledWith("/workspace/project/01_Client_Files/Original_Delivery/Lead.wav");
    expect(result).toEqual({
      provider: "web",
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
      sourceUrl: "asset:///workspace/project/01_Client_Files/Original_Delivery/Lead.wav",
    });
  });

  it("falls back to the native provider when web preview is unavailable and native support exists", async () => {
    mockedInvoke
      .mockResolvedValueOnce({
        supported: false,
        relativePath: "04_Revisions/Revision_01/Lead.wav",
        filePath: null,
      })
      .mockResolvedValueOnce({
        supported: true,
        relativePath: null,
        playing: false,
        currentSeconds: 0,
        durationSeconds: 0,
      });

    await expect(prepareProjectAudioPreview({
      clientId: "acme",
      projectId: "blue-sky",
      relativePath: "04_Revisions/Revision_01/Lead.wav",
    })).resolves.toEqual({
      provider: "native",
      relativePath: "04_Revisions/Revision_01/Lead.wav",
      sourceUrl: null,
    });

    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "get_native_project_audio_preview_status");
    expect(mockedConvertFileSrc).not.toHaveBeenCalled();
  });

  it("returns no preview when neither provider is supported", async () => {
    mockedInvoke
      .mockResolvedValueOnce({
        supported: false,
        relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
        filePath: null,
      })
      .mockResolvedValueOnce({
        supported: false,
        relativePath: null,
        playing: false,
        currentSeconds: 0,
        durationSeconds: 0,
      });

    await expect(prepareProjectAudioPreview({
      clientId: "acme",
      projectId: "blue-sky",
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
    })).resolves.toBeNull();
    expect(mockedConvertFileSrc).not.toHaveBeenCalled();
  });
});
