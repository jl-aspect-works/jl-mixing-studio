import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { stopActiveAudioPlayback } from "./audioPlaybackController";
import { CompactAudioPreview } from "./CompactAudioPreview";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockedInvoke.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(async () => {
  cleanup();
  await stopActiveAudioPlayback();
  vi.restoreAllMocks();
});

describe("CompactAudioPreview", () => {
  it("resolves the requested revision and exposes one play/pause button", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "resolve_compact_audio_source") return Promise.resolve({
        available: true,
        relativePath: "04_Revisions/Revision_02/Mix.wav",
        displayName: "Mix.wav",
        reason: "Audio preview is available.",
      });
      if (command === "prepare_project_audio_preview") return Promise.resolve({
        supported: true,
        relativePath: "04_Revisions/Revision_02/Mix.wav",
        filePath: "/project/04_Revisions/Revision_02/Mix.wav",
      });
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<CompactAudioPreview clientId="acme" projectId="mix" revision={2} label="Revision 2" />);
    const play = await screen.findByRole("button", { name: "Play Revision 2" });
    await waitFor(() => expect(play).toBeEnabled());
    fireEvent.click(play);

    expect(await screen.findByRole("button", { name: "Pause Revision 2" })).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("resolve_compact_audio_source", {
      request: { clientId: "acme", projectId: "mix", revision: 2, delivery: false },
    });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("disables playback with the resolver's useful unavailable status", async () => {
    mockedInvoke.mockResolvedValue({
      available: false,
      relativePath: null,
      displayName: null,
      reason: "No supported audio file was found in this revision.",
    });

    render(<CompactAudioPreview clientId="acme" projectId="mix" revision={3} label="Revision 3" />);
    const play = await screen.findByRole("button", { name: "Play Revision 3" });
    await waitFor(() => expect(play).toBeDisabled());
    expect(play.parentElement).toHaveAttribute("title", "No supported audio file was found in this revision.");
  });

  it("reports preparation failures without adding transport controls", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "resolve_compact_audio_source") return Promise.resolve({
        available: true,
        relativePath: "04_Revisions/Revision_03/Mix.wav",
        displayName: "Mix.wav",
        reason: "Audio preview is available.",
      });
      if (command === "prepare_project_audio_preview") return Promise.reject(new Error("Decoder failed."));
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<CompactAudioPreview clientId="acme" projectId="mix" revision={3} label="Revision 3" />);
    const play = await screen.findByRole("button", { name: "Play Revision 3" });
    await waitFor(() => expect(play).toBeEnabled());
    fireEvent.click(play);

    expect(await screen.findByRole("status", { name: "Decoder failed." })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("stops the previous preview when another compact preview starts", async () => {
    mockedInvoke.mockImplementation((command, args) => {
      if (command === "resolve_compact_audio_source") {
        const revision = (args as { request: { revision: number } }).request.revision;
        return Promise.resolve({
          available: true,
          relativePath: `04_Revisions/Revision_0${revision}/Mix.wav`,
          displayName: "Mix.wav",
          reason: "Audio preview is available.",
        });
      }
      if (command === "prepare_project_audio_preview") {
        const relativePath = (args as { request: { relativePath: string } }).request.relativePath;
        return Promise.resolve({ supported: true, relativePath, filePath: `/project/${relativePath}` });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<>
      <CompactAudioPreview clientId="acme" projectId="mix" revision={1} label="Revision 1" />
      <CompactAudioPreview clientId="acme" projectId="mix" revision={2} label="Revision 2" />
    </>);
    const first = await screen.findByRole("button", { name: "Play Revision 1" });
    const second = await screen.findByRole("button", { name: "Play Revision 2" });
    await waitFor(() => expect(first).toBeEnabled());
    await waitFor(() => expect(second).toBeEnabled());
    fireEvent.click(first);
    expect(await screen.findByRole("button", { name: "Pause Revision 1" })).toBeInTheDocument();
    fireEvent.click(second);

    expect(await screen.findByRole("button", { name: "Pause Revision 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Revision 1" })).toBeInTheDocument();
  });
});
