import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { AudioPreviewPlayer } from "./AudioPreviewPlayer";
import { CompactAudioPreview } from "./CompactAudioPreview";
import { stopActiveAudioPlayback } from "./audioPlaybackController";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), convertFileSrc: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);
const relativePath = "04_Revisions/Revision_01/Mix.wav";
const lostOutput = "Audio output was lost. Playback stopped. Restore Dante Via, then retry.";

beforeEach(() => {
  mockedInvoke.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(async () => {
  cleanup();
  await stopActiveAudioPlayback();
  vi.restoreAllMocks();
});

it.each(["ordinary", "compact"])("stops %s native preview after output loss and reloads only on explicit retry", async (kind) => {
  let playing = false;
  let failed = false;
  mockedInvoke.mockImplementation(async (command) => {
    if (command === "resolve_compact_audio_source") return { available: true, relativePath, displayName: "Mix.wav", reason: "Available" };
    if (command === "prepare_project_audio_preview") return { supported: false, relativePath, filePath: null };
    if (command === "get_native_project_audio_preview_status" && failed) throw lostOutput;
    if (command === "load_native_project_audio_preview") failed = false;
    if (command === "play_native_project_audio_preview") playing = true;
    if (command === "stop_native_project_audio_preview") playing = false;
    return { supported: true, relativePath, playing, currentSeconds: 0.5, durationSeconds: 10 };
  });
  if (kind === "ordinary") render(<AudioPreviewPlayer clientId="acme" projectId="mix" entry={{ relativePath, displayName: "Mix.wav" }} />);
  else render(<CompactAudioPreview clientId="acme" projectId="mix" revision={1} label="Mix.wav" />);
  fireEvent.click(screen.getByRole("button", { name: "Play Mix.wav" }));
  await screen.findByRole("button", { name: "Pause Mix.wav" });
  failed = true;
  await waitFor(() => expect(screen.queryByRole("button", { name: "Pause Mix.wav" })).not.toBeInTheDocument());
  expect(mockedInvoke.mock.calls.filter(([command]) => command === "load_native_project_audio_preview")).toHaveLength(1);
  expect(mockedInvoke.mock.calls.filter(([command]) => command === "play_native_project_audio_preview")).toHaveLength(1);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Play Mix.wav/ }));
  await screen.findByRole("button", { name: "Pause Mix.wav" });
  expect(mockedInvoke.mock.calls.filter(([command]) => command === "load_native_project_audio_preview")).toHaveLength(2);
});
