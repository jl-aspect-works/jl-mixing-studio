import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPrepBrowser } from "./AudioPrepBrowser";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(() => Promise.resolve()),
  renameAudioPrepFile: vi.fn(() => Promise.resolve({ relativePath: "02_Audio_Preparation/Working_Audio/Vocal Clean.wav" })),
  deleteAudioPrepFile: vi.fn(() => Promise.resolve({ relativePath: "02_Audio_Preparation/Working_Audio/Vocal.wav" })),
}));

vi.mock("../project/files/AudioPreviewPlayer", () => ({
  AudioPreviewPlayer: ({ entry }: { entry: { displayName: string } }) => <span data-testid="audio-prep-preview">Previewing {entry.displayName}</span>,
}));

vi.mock("../project/files/projectFileService", async () => {
  const actual = await vi.importActual<typeof import("../project/files/projectFileService")>("../project/files/projectFileService");
  return {
    ...actual,
    renameAudioPrepFile: mocks.renameAudioPrepFile,
    deleteAudioPrepFile: mocks.deleteAudioPrepFile,
    openProjectFile: vi.fn(() => Promise.resolve({ relativePath: "" })),
    revealProjectFile: vi.fn(() => Promise.resolve({ relativePath: "" })),
  };
});

vi.mock("../project/files/useProjectFiles", () => ({
  useProjectFiles: () => ({
    state: {
      status: "ready",
      message: null,
      listing: {
        relativePath: "02_Audio_Preparation/Working_Audio",
        area: "audioPreparation",
        permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false },
        entries: [{
          id: "vocal",
          relativePath: "02_Audio_Preparation/Working_Audio/Vocal.wav",
          displayName: "Vocal.wav",
          extension: "wav",
          entryType: "file",
          area: "audioPreparation",
          sizeBytes: 2048,
          modifiedEpochMs: 1,
          isAudio: true,
          playable: true,
          permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
        }],
      },
    },
    refresh: mocks.refresh,
  }),
}));

afterEach(() => {
  cleanup();
  mocks.refresh.mockClear();
  mocks.renameAudioPrepFile.mockClear();
  mocks.deleteAudioPrepFile.mockClear();
  vi.restoreAllMocks();
});

describe("AudioPrepBrowser", () => {
  it("uses the compact Audio Prep table with honest provenance and inline stem rename", async () => {
    render(<AudioPrepBrowser clientId="client" projectId="project" />);

    expect(screen.getByText("Original Filename")).toBeInTheDocument();
    expect(screen.getByLabelText("Validation not available")).toHaveTextContent("·");
    expect(screen.getByTestId("audio-prep-preview")).toHaveTextContent("Previewing Vocal.wav");
    expect(screen.getByTitle("Source provenance will appear when Automation exposes the authoritative mapping")).toHaveTextContent("—");

    fireEvent.click(screen.getByRole("button", { name: "Vocal.wav" }));
    const rename = screen.getByLabelText("Rename Vocal.wav");
    expect(rename).toHaveValue("Vocal");
    expect(screen.getByText(".wav")).toBeInTheDocument();

    fireEvent.change(rename, { target: { value: "Vocal Clean" } });
    fireEvent.keyDown(rename, { key: "Enter" });

    await waitFor(() => expect(mocks.renameAudioPrepFile).toHaveBeenCalledWith({ clientId: "client", projectId: "project", relativePath: "02_Audio_Preparation/Working_Audio/Vocal.wav" }, "Vocal Clean"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("cancels inline rename with Escape and confirms safe delete from overflow", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AudioPrepBrowser clientId="client" projectId="project" />);

    fireEvent.click(screen.getByRole("button", { name: "Vocal.wav" }));
    const rename = screen.getByLabelText("Rename Vocal.wav");
    fireEvent.change(rename, { target: { value: "Changed" } });
    fireEvent.keyDown(rename, { key: "Escape" });
    expect(screen.queryByLabelText("Rename Vocal.wav")).not.toBeInTheDocument();
    expect(mocks.renameAudioPrepFile).not.toHaveBeenCalledWith(expect.anything(), "Changed");

    const summary = screen.getByLabelText("Actions for Vocal.wav");
    fireEvent.click(summary);
    const menu = within(summary.closest("details") as HTMLElement);
    fireEvent.click(menu.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => expect(mocks.deleteAudioPrepFile).toHaveBeenCalledWith({ clientId: "client", projectId: "project", relativePath: "02_Audio_Preparation/Working_Audio/Vocal.wav" }));
    expect(confirm).toHaveBeenCalledWith("Delete Vocal.wav from Audio Prep? This does not change Original Delivery.");
  });
});
