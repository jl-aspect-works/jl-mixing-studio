import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientFilesBrowser, formatClientFileModified } from "./ClientFilesBrowser";

vi.mock("../project/files/AudioPreviewPlayer", () => ({
  AudioPreviewPlayer: ({ entry }: { entry: { displayName: string } }) => <span data-testid="inline-preview">Previewing {entry.displayName}</span>,
}));

vi.mock("../project/files/useProjectFiles", () => ({
  useProjectFiles: () => ({
    state: {
      status: "ready",
      message: null,
      listing: {
        relativePath: "01_Client_Files/Original_Delivery",
        area: "clientOriginalDelivery",
        permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false },
        entries: [
          {
            id: "lead",
            relativePath: "01_Client_Files/Original_Delivery/Lead.wav",
            displayName: "Lead.wav",
            extension: ".wav",
            entryType: "file",
            area: "clientOriginalDelivery",
            sizeBytes: 1024,
            modifiedEpochMs: 1,
            isAudio: true,
            playable: true,
            permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false },
          },
          {
            id: "notes",
            relativePath: "01_Client_Files/Original_Delivery/Notes.txt",
            displayName: "Notes.txt",
            extension: ".txt",
            entryType: "file",
            area: "clientOriginalDelivery",
            sizeBytes: 12,
            modifiedEpochMs: 1,
            isAudio: false,
            playable: false,
            permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false },
          },
        ],
      },
    },
    refresh: vi.fn(),
  }),
}));

describe("ClientFilesBrowser", () => {
  it("formats modified date and time without a comma", () => {
    const formatted = formatClientFileModified(new Date(2026, 7, 17, 7, 10).getTime());
    expect(formatted).toBe("8/17/26 07:10am");
    expect(formatted).not.toContain(",");
  });

  it("shows compact status icons, preview/audio details, and validation details in overflow", () => {
    render(<ClientFilesBrowser clientId="client" projectId="project" validationFiles={[{
      relative_path: "Lead.wav",
      is_audio: true,
      status: "needs_attention",
      metadata: { sample_rate: 48000, bit_depth: 24, channels: 2, duration: 61, codec_name: "pcm_s24le" },
      decode_ok: true,
      findings: [{ code: "SAMPLE_RATE_MISMATCH", severity: "warning", message: "Sample rate mismatch", expected: 44100, actual: 48000 }],
    }]} />);

    expect(screen.getByText("Lead.wav")).toBeInTheDocument();
    expect(screen.queryByText("Validation")).not.toBeInTheDocument();
    const attention = screen.getByLabelText("Needs attention — Sample rate mismatch — Expected: 44100 · Actual: 48000");
    expect(attention).toHaveTextContent("!");
    expect(attention).toHaveAttribute("title", "Needs attention — Sample rate mismatch — Expected: 44100 · Actual: 48000");
    expect(screen.getAllByLabelText("Not applicable").length).toBeGreaterThan(0);
    const legend = within(screen.getByLabelText("Validation status legend"));
    expect(legend.getByText("Valid")).toBeInTheDocument();
    expect(legend.getByText("Needs attention")).toBeInTheDocument();
    expect(legend.getByText("Error")).toBeInTheDocument();
    expect(legend.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Audio Details")).toBeInTheDocument();
    expect(screen.getByText("WAV")).toBeInTheDocument();
    expect(screen.getByText("48kHz")).toBeInTheDocument();
    expect(screen.getByText("24-bit")).toBeInTheDocument();
    expect(screen.getByText("2ch")).toBeInTheDocument();
    expect(screen.getByText("1:01")).toBeInTheDocument();
    expect(screen.getByTestId("inline-preview")).toHaveTextContent("Previewing Lead.wav");
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    const actionSummary = screen.getByLabelText("Actions for Lead.wav");
    fireEvent.click(actionSummary);
    const actionMenu = actionSummary.closest("details");
    expect(actionMenu).not.toBeNull();
    const leadMenu = within(actionMenu as HTMLElement);
    expect(leadMenu.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(leadMenu.getByRole("menuitem", { name: "Reveal" })).toBeInTheDocument();
    expect(leadMenu.getByText("Validation details")).toBeInTheDocument();

    fireEvent.click(leadMenu.getByText("Validation details"));
    expect(leadMenu.getByText("Codec:")).toBeInTheDocument();
    expect(leadMenu.getByText("Decode integrity:")).toBeInTheDocument();
    expect(leadMenu.getByText("Sample rate mismatch")).toBeInTheDocument();
  });

  it("supports checkbox selection of multiple Client Files", () => {
    const onSelectedPathsChange = vi.fn();
    const { rerender } = render(<ClientFilesBrowser clientId="client" projectId="project" selectedPaths={[]} onSelectedPathsChange={onSelectedPathsChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Lead.wav" }));
    expect(onSelectedPathsChange).toHaveBeenLastCalledWith(["01_Client_Files/Original_Delivery/Lead.wav"]);

    rerender(<ClientFilesBrowser clientId="client" projectId="project" selectedPaths={["01_Client_Files/Original_Delivery/Lead.wav"]} onSelectedPathsChange={onSelectedPathsChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Notes.txt" }));
    expect(onSelectedPathsChange).toHaveBeenLastCalledWith([
      "01_Client_Files/Original_Delivery/Lead.wav",
      "01_Client_Files/Original_Delivery/Notes.txt",
    ]);
  });
});
