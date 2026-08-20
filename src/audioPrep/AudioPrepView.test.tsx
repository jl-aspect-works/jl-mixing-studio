import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "../types";
import { AudioPrepView } from "./AudioPrepView";

vi.mock("./AudioPrepBrowser", () => ({
  AudioPrepBrowser: ({ validationAvailable }: { validationAvailable?: boolean }) => <div data-testid="audio-prep-browser">browser:{validationAvailable ? "validated" : "fallback"}</div>,
}));

const project: ProjectSummary = {
  projectId: "project",
  projectName: "Project",
  artist: "Artist",
  schemaVersion: "1.1.0",
  createdWith: "jl-mixing 1.5.0",
  createdAt: "2026-08-14T00:00:00Z",
  deadline: null,
  sampleRate: 48000,
  bitDepth: 24,
  fileFormat: "WAV",
  deliveryMethod: "Download",
  currentRevision: 1,
  approvedRevision: null,
  deliveredRevision: null,
  delivery: null,
  revisions: [],
};

describe("AudioPrepView", () => {
  it("renders the working-stage summary, expected format, and Audio Prep validation availability", () => {
    render(<AudioPrepView
      client={{ clientId: "client", clientName: "Client", createdAt: "2026-08-14T00:00:00Z", defaultArtist: "Artist", projects: [project] }}
      project={project}
      reportState={{ status: "ready", value: {
        ok: true,
        code: "validated",
        message: "ready",
        report: { expectedSampleRate: 44100, expectedBitDepth: 24, enhancedInspectionAvailable: true } as never,
        audioPrepAvailable: true,
        audioPrepFiles: [],
      } as never }}
      onValidationRefresh={vi.fn()}
      onProjects={vi.fn()}
      onOverview={vi.fn()}
      onSelectView={vi.fn()}
    />);

    expect(screen.getByRole("heading", { name: "Audio Prep" })).toBeInTheDocument();
    expect(screen.getByText(/Original Delivery remains unchanged/i)).toBeInTheDocument();
    expect(screen.getByText("Expected format: 44.1 kHz / 24-bit · Enhanced inspection available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fix / Convert" })).not.toBeInTheDocument();
    expect(screen.getByTestId("audio-prep-browser")).toHaveTextContent("validated");
  });
});
