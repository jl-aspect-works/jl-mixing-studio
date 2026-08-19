import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceSnapshot } from "../types";
import { ProjectsRouteV21 } from "./ProjectsRouteV21";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

const project = (id: string, name: string, artist: string) => ({
  projectId: id,
  projectName: name,
  artist,
  schemaVersion: "1.1.0",
  createdWith: "jl-mixing 2.1.0",
  createdAt: "2026-08-01T12:00:00Z",
  deadline: null,
  sampleRate: 48000,
  bitDepth: 24,
  fileFormat: "WAV",
  deliveryMethod: "Cloud",
  currentRevision: 1,
  approvedRevision: null,
  deliveredRevision: null,
  delivery: null,
  revisions: [],
});

const workspace: WorkspaceSnapshot = {
  workspacePath: "/workspace",
  status: "healthy",
  studio: null,
  counts: { clients: 2, projects: 2, issues: 0 },
  clients: [
    { clientId: "acme", clientName: "Acme Records", createdAt: "2026-07-01T00:00:00Z", defaultArtist: "Artist", projects: [project("blue-sky", "Blue Sky", "The Artist")] },
    { clientId: "north", clientName: "North Star", createdAt: "2026-07-01T00:00:00Z", defaultArtist: "Guest", projects: [project("night-drive", "Night Drive", "Guest Artist")] },
  ],
  issues: [],
  tasks: [],
  activity: [],
};

const editInfo = {
  updateSupported: true,
  clientId: "acme",
  projectId: "blue-sky",
  projectPath: "/workspace/Clients/Acme/Projects/Blue Sky",
  documentId: "project-blue-sky",
  schemaVersion: "1.1.0",
  createdWith: "jl-mixing 2.1.0",
  createdAt: "2026-08-01T12:00:00Z",
  lastModifiedAt: "2026-08-19T12:00:00Z",
  projectName: "Blue Sky",
  artist: "The Artist",
  album: "",
  producer: "",
  mixEngineer: "Engineer",
  bpm: 120,
  musicalKey: "C",
  timeSignature: "4/4",
  sampleRate: 48000,
  bitDepth: 24,
  fileFormat: "WAV",
  deliveryMethod: "Cloud",
  requestedDeliverables: ["main_mix"],
  deadline: null,
  creativeDirection: "Warm and open",
  message: "Project editing is available.",
};

const props = {
  workspace: { status: "ready" as const, value: workspace },
  onSelectProject: vi.fn(),
  onNewProject: vi.fn(),
  onRefresh: vi.fn(),
  onSaveSuccess: vi.fn(),
  loading: false,
  projectCreationAvailable: true,
  projectCreationHelp: "Available",
};

afterEach(cleanup);

describe("ProjectsRouteV21", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    props.onRefresh.mockReset();
    props.onSaveSuccess.mockReset();
    mockedInvoke.mockImplementation((command, args) => {
      if (command === "get_project_edit_info") {
        const projectId = (args as { projectId: string }).projectId;
        return Promise.resolve({ ...editInfo, projectId, projectName: projectId === "night-drive" ? "Night Drive" : "Blue Sky", clientId: projectId === "night-drive" ? "north" : "acme" });
      }
      if (command === "update_project") return Promise.resolve({ ok: true, code: "updated", message: "Project settings were updated and verified." });
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
  });

  it("searches by project, ID, client, or artist and keeps selection in the inspector", async () => {
    render(<ProjectsRouteV21 {...props} />);
    await screen.findByRole("heading", { name: "Blue Sky" });
    const search = screen.getByRole("searchbox", { name: "Search projects" });
    fireEvent.change(search, { target: { value: "guest artist" } });
    expect(screen.getByRole("button", { name: /Night Drive/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Blue Sky/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Night Drive" })).toBeInTheDocument();
  });

  it("saves project metadata with the edit-session conflict token and opens the selected project separately", async () => {
    render(<ProjectsRouteV21 {...props} />);
    const edit = await screen.findByRole("button", { name: "Edit Project" });
    await waitFor(() => expect(edit).toBeEnabled());
    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText("Project Name"), { target: { value: "Blue Sky Deluxe" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith("update_project", { request: expect.objectContaining({
      clientId: "acme",
      projectId: "blue-sky",
      expectedLastModifiedAt: "2026-08-19T12:00:00Z",
      projectName: "Blue Sky Deluxe",
    }) }));
    expect(props.onSaveSuccess).toHaveBeenCalled();
    expect(props.onRefresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open Project" }));
    expect(props.onSelectProject).toHaveBeenCalledWith("acme", "blue-sky");
  });
});
