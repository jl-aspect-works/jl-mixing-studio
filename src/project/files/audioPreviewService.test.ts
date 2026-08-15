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
  it("converts only a backend-authorized preview path", async () => {
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

    expect(mockedInvoke).toHaveBeenCalledWith("prepare_project_audio_preview", {
      request: {
        clientId: "acme",
        projectId: "blue-sky",
        relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
      },
    });
    expect(mockedConvertFileSrc).toHaveBeenCalledWith("/workspace/project/01_Client_Files/Original_Delivery/Lead.wav");
    expect(result).toEqual({
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
      sourceUrl: "asset:///workspace/project/01_Client_Files/Original_Delivery/Lead.wav",
    });
  });

  it("returns no preview source when the backend reports an unsupported platform", async () => {
    mockedInvoke.mockResolvedValue({
      supported: false,
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
      filePath: null,
    });

    await expect(prepareProjectAudioPreview({
      clientId: "acme",
      projectId: "blue-sky",
      relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
    })).resolves.toBeNull();
    expect(mockedConvertFileSrc).not.toHaveBeenCalled();
  });
});
