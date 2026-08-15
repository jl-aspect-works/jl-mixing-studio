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
  it("renders Automation-authored status and exact-content provenance", () => {
    render(<AudioPrepBrowser
      clientId="client"
      projectId="project"
      validationAvailable
      validationFiles={[{
        relative_path: "Vocal.wav",
        is_audio: true,
        status: "valid",
        findings: [],
        original_filename: "Client Vocal.wav",
        original_delivery_relative_path: "Vocals/Client Vocal.wav",
        provenance_state: "exact_content",
      }]}
    />);

    expect(screen.getByLabelText("Valid")).toHaveTextContent("✓");
    expect(screen.getByText("Client Vocal.wav")).toBeInTheDocument();
    expect(screen.getByTitle("Original Delivery: Client Vocal.wav")).toBeInTheDocument();
    expect(screen.getByLabelText("Validation status")).toBeEnabled();
    expect(screen.getByTestId("audio-prep-preview")).toHaveTextContent("Previewing Vocal.wav");
  });

  it("keeps provenance unavailable rather than guessing and supports validation filtering", () => {
    render(<AudioPrepBrowser
      clientId="client"
      projectId="project"
      validationAvailable
      validationFiles={[{
        relative_path: "Vocal.wav",
        is_audio: true,
        status: "needs_attention",
        findings: [{ code: "SAMPLE_RATE_MISMATCH", severity: "warning", message: "Sample rate differs" }],
        original_filename: null,
        provenance_state: "ambiguous",
      }]}
    />);

    expect(screen.getByLabelText("Needs attention — 1 finding")).toHaveTextContent("!");
    expect(screen.getByTitle("Multiple Original Delivery files have identical content; Automation will not guess the source.")).toHaveTextContent("—");

    fireEvent.change(screen.getByLabelText("Validation status"), { target: { value: "valid" } });
    expect(screen.queryByRole("button", { name: "Vocal.wav" })).not.toBeInTheDocument();
    expect(screen.getByText("No files match the current search or filters.")).toBeInTheDocument();
  });

  it("falls back cleanly when Automation does not expose Audio Prep status", () => {
    render(<AudioPrepBrowser clientId="client" projectId="project" />);

    expect(screen.getByLabelText("Validation not available")).toHaveTextContent("·");
    expect(screen.getByLabelText("Validation status")).toBeDisabled();
    expect(screen.getByTitle("Authoritative Original Delivery provenance is not available for this working file.")).toHaveTextContent("—");
    expect(screen.getByText("Validation status requires newer Automation support")).toBeInTheDocument();
  });

  it("renames inline and refreshes filesystem plus validation", async () => {
    const onValidationRefresh = vi.fn();
    render(<AudioPrepBrowser clientId="client" projectId="project" onValidationRefresh={onValidationRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "Vocal.wav" }));
    const rename = screen.getByLabelText("Rename Vocal.wav");
    expect(rename).toHaveValue("Vocal");
    expect(screen.getByText(".wav")).toBeInTheDocument();

    fireEvent.change(rename, { target: { value: "Vocal Clean" } });
    fireEvent.keyDown(rename, { key: "Enter" });

    await waitFor(() => expect(mocks.renameAudioPrepFile).toHaveBeenCalledWith({ clientId: "client", projectId: "project", relativePath: "02_Audio_Preparation/Working_Audio/Vocal.wav" }, "Vocal Clean"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(onValidationRefresh).toHaveBeenCalled();
  });

  it("cancels inline rename with Escape and confirms safe delete from overflow", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onValidationRefresh = vi.fn();
    render(<AudioPrepBrowser clientId="client" projectId="project" onValidationRefresh={onValidationRefresh} />);

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
    expect(onValidationRefresh).toHaveBeenCalled();
  });
});
