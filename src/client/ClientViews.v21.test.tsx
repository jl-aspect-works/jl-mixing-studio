import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { ClientSummary, WorkspaceSnapshot } from "../types";
import { ClientsRoute } from "./ClientViews";
import { ClientDetails } from "./ClientDetailsV21";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn() }));

const mockedInvoke = vi.mocked(invoke);

const client: ClientSummary = {
  clientId: "acme",
  clientName: "Acme Records",
  createdAt: "2026-07-18T12:00:00Z",
  defaultArtist: "The Artist",
  projects: [],
};

const secondClient: ClientSummary = {
  clientId: "north-star",
  clientName: "North Star Music",
  createdAt: "2026-07-19T12:00:00Z",
  defaultArtist: "Another Artist",
  projects: [],
};

const workspace: WorkspaceSnapshot = {
  workspacePath: "/Users/engineer/Music/Mixes",
  status: "healthy",
  studio: null,
  counts: { clients: 2, projects: 0, issues: 0 },
  clients: [client, secondClient],
  issues: [],
  tasks: [],
  activity: [],
};

const editInfo = {
  updateSupported: true,
  clientId: "acme",
  clientPath: "/Users/engineer/Music/Mixes/Clients/Acme Records",
  documentId: "client-acme",
  schemaVersion: "1.1.0",
  createdWith: "jl-mixing 2.1.0",
  createdAt: "2026-07-18T12:00:00Z",
  lastModifiedAt: "2026-08-19T10:00:00Z",
  clientName: "Acme Records",
  artist: "The Artist",
  sampleRate: 48000,
  bitDepth: 24,
  fileFormat: "WAV",
  deliveryMethod: "Cloud",
  requestedDeliverables: ["main_mix", "instrumental"],
  message: "Client editing is available.",
};

const detailsProps = {
  client,
  onBack: vi.fn(),
  onSelectProject: vi.fn(),
  onNewProject: vi.fn(),
  onRefresh: vi.fn(),
  onSaveSuccess: vi.fn(),
  loading: false,
  projectCreationAvailable: true,
  projectCreationHelp: "Project creation is available.",
};

afterEach(cleanup);

describe("Client v2.1 directory and editing", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    detailsProps.onRefresh.mockReset();
    detailsProps.onSaveSuccess.mockReset();
  });

  it("filters loaded clients case-insensitively by name or ID and clears search", () => {
    render(<ClientsRoute workspace={{ status: "ready", value: workspace }} onSelectClient={vi.fn()} onNewClient={vi.fn()} onRefresh={vi.fn()} loading={false} clientCreationAvailable clientCreationHelp="Available" />);

    const search = screen.getByRole("searchbox", { name: "Search clients" });
    fireEvent.change(search, { target: { value: "NORTH" } });
    expect(screen.getByText("North Star Music")).toBeInTheDocument();
    expect(screen.queryByText("Acme Records")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "acme" } });
    expect(screen.getByText("Acme Records")).toBeInTheDocument();
    expect(screen.queryByText("North Star Music")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText(/No clients match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear Search" }));
    expect(screen.getByText("Acme Records")).toBeInTheDocument();
    expect(screen.getByText("North Star Music")).toBeInTheDocument();
  });

  it("puts Projects first and filters projects by name, ID, or artist", async () => {
    mockedInvoke.mockResolvedValue(editInfo);
    const clientWithProjects: ClientSummary = {
      ...client,
      projects: [
        {
          projectId: "blue-sky",
          projectName: "Blue Sky",
          artist: "The Artist",
          schemaVersion: "1.1.0",
          createdWith: "jl-mixing 2.1.0",
          createdAt: "2026-08-01T12:00:00Z",
          deadline: null,
          sampleRate: 48000,
          bitDepth: 24,
          fileFormat: "WAV",
          deliveryMethod: "Cloud",
          currentRevision: 2,
          approvedRevision: 1,
          deliveredRevision: null,
          delivery: null,
          revisions: [],
        },
        {
          projectId: "night-drive",
          projectName: "Night Drive",
          artist: "Guest Artist",
          schemaVersion: "1.1.0",
          createdWith: "jl-mixing 2.1.0",
          createdAt: "2026-08-02T12:00:00Z",
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
        },
      ],
    };

    render(<ClientDetails {...detailsProps} client={clientWithProjects} />);
    await screen.findByRole("button", { name: "Edit Client" });
    const projectsHeading = screen.getByRole("heading", { name: "Projects" });
    const identityHeading = screen.getByRole("heading", { name: "Client Identity" });
    expect(projectsHeading.compareDocumentPosition(identityHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const search = screen.getByRole("searchbox", { name: "Search projects" });
    fireEvent.change(search, { target: { value: "guest" } });
    expect(screen.getByText("Night Drive")).toBeInTheDocument();
    expect(screen.queryByText("Blue Sky")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "blue-sky" } });
    expect(screen.getByText("Blue Sky")).toBeInTheDocument();
    expect(screen.queryByText("Night Drive")).not.toBeInTheDocument();
  });

  it("saves editable defaults through Automation with the edit-session conflict token", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "get_client_edit_info") return Promise.resolve(editInfo);
      if (command === "update_client") return Promise.resolve({ ok: true, code: "updated", message: "Updated" });
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<ClientDetails {...detailsProps} />);
    const editButton = await screen.findByRole("button", { name: "Edit Client" });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Acme Studios" } });
    fireEvent.change(screen.getByLabelText("Default Artist"), { target: { value: "New Artist" } });
    fireEvent.change(screen.getByLabelText("Default Sample Rate"), { target: { value: "96000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith("update_client", { request: {
      clientId: "acme",
      expectedLastModifiedAt: "2026-08-19T10:00:00Z",
      clientName: "Acme Studios",
      artist: "New Artist",
      sampleRate: 96000,
      bitDepth: 24,
      fileFormat: "WAV",
      deliveryMethod: "Cloud",
      requestedDeliverables: ["main_mix", "instrumental"],
    } }));
    expect(detailsProps.onSaveSuccess).toHaveBeenCalledWith("Client settings were updated and verified.");
    expect(detailsProps.onRefresh).toHaveBeenCalled();
  });

  it("preserves unsaved values when Automation reports a conflict", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "get_client_edit_info") return Promise.resolve(editInfo);
      if (command === "update_client") return Promise.resolve({ ok: false, code: "conflict", message: "Client settings changed outside this edit session. Refresh and review the newer values before saving." });
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<ClientDetails {...detailsProps} />);
    const editButton = await screen.findByRole("button", { name: "Edit Client" });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    const name = screen.getByLabelText("Client Name");
    fireEvent.change(name, { target: { value: "Unsaved Client Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed outside this edit session/i);
    expect(name).toHaveValue("Unsaved Client Name");
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(detailsProps.onSaveSuccess).not.toHaveBeenCalledWith(expect.stringContaining("updated"));
  });

  it("keeps Edit Client unavailable when Automation does not advertise client.update", async () => {
    mockedInvoke.mockResolvedValue({ ...editInfo, updateSupported: false, message: "The installed JL Mixing Automation does not advertise client.update." });
    render(<ClientDetails {...detailsProps} />);
    const editButton = await screen.findByRole("button", { name: "Edit Client" });
    expect(editButton).toBeDisabled();
    expect(screen.getByText(/does not advertise client.update/i)).toBeInTheDocument();
  });
});
