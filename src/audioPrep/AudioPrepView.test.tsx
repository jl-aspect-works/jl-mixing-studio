import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "../types";
import { AudioPrepView } from "./AudioPrepView";

vi.mock("./AudioPrepBrowser", () => ({
  AudioPrepBrowser: () => <div data-testid="audio-prep-browser">browser</div>,
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
  it("renders the working-stage summary and keeps repair actions explicitly deferred", () => {
    render(<AudioPrepView
      client={{ clientId: "client", clientName: "Client", createdAt: "2026-08-14T00:00:00Z", defaultArtist: "Artist", projects: [project] }}
      project={project}
      onProjects={vi.fn()}
      onOverview={vi.fn()}
      onSelectView={vi.fn()}
    />);

    expect(screen.getByRole("heading", { name: "Audio Prep" })).toBeInTheDocument();
    expect(screen.getByText(/Original Delivery remains unchanged/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix / Convert" })).toBeDisabled();
    expect(screen.getByTestId("audio-prep-browser")).toBeInTheDocument();
  });
});
