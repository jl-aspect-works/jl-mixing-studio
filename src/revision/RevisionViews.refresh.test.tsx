import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientSummary, ProjectSummary } from "../types";
import { notifyWorkspaceRefreshed } from "../app/workspaceRefreshEvents";
import { RevisionsView } from "./RevisionViews";

const mocks = vi.hoisted(() => ({
  getRevisionNotes: vi.fn(),
  updateRevisionDescription: vi.fn(),
  updateRevisionNotes: vi.fn(),
}));

vi.mock("./revisionWorkspaceService", () => ({
  getRevisionNotes: mocks.getRevisionNotes,
  updateRevisionDescription: mocks.updateRevisionDescription,
  updateRevisionNotes: mocks.updateRevisionNotes,
}));

vi.mock("./RevisionFileBrowser", () => ({
  RevisionFileBrowser: () => <div data-testid="revision-files" />,
}));

const client = {
  clientId: "client-1",
  clientName: "Client",
  createdAt: "2026-08-16T12:00:00Z",
  defaultArtist: "Artist",
  projects: [],
} satisfies ClientSummary;

const project = {
  projectId: "project-1",
  projectName: "Project",
  artist: "Artist",
  schemaVersion: "1.1.0",
  createdWith: "jl-mixing 1.5.0",
  createdAt: "2026-08-16T12:00:00Z",
  deadline: null,
  sampleRate: 48000,
  bitDepth: 24,
  fileFormat: "WAV",
  deliveryMethod: "Digital",
  currentRevision: 1,
  approvedRevision: null,
  deliveredRevision: null,
  delivery: null,
  revisions: [{
    number: 1,
    revisionId: "revision-1",
    createdAt: "2026-08-16T12:00:00Z",
    description: "First revision",
    approvedAt: null,
    approvedBy: null,
  }],
} satisfies ProjectSummary;

const renderView = (
  projectValue: ProjectSummary = project,
  onCreateDelivery = vi.fn(),
  onApprove = vi.fn(),
) => render(<RevisionsView
  client={client}
  project={projectValue}
  loading={false}
  actionError={null}
  creationAvailable
  creationHelp=""
  approvalAvailable
  approvalHelp=""
  deliveryAvailable
  deliveryHelp="Build a package from the approved revision."
  onProjects={vi.fn()}
  onOverview={vi.fn()}
  onRefresh={vi.fn()}
  onNewRevision={vi.fn()}
  onApprove={onApprove}
  onCreateDelivery={onCreateDelivery}
  onSelectView={vi.fn()}
/>);

beforeEach(() => {
  mocks.getRevisionNotes.mockReset();
  mocks.updateRevisionDescription.mockReset();
  mocks.updateRevisionNotes.mockReset();
});

afterEach(cleanup);

describe("RevisionsView workspace refresh", () => {
  it("reloads clean Revision Notes after a successful workspace refresh", async () => {
    mocks.getRevisionNotes
      .mockResolvedValueOnce({ content: "Original notes", maxBytes: 65_536 })
      .mockResolvedValueOnce({ content: "Externally updated notes", maxBytes: 65_536 });

    renderView();
    expect(await screen.findByText("Original notes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Revision Notes" })).toHaveValue("Original notes");

    notifyWorkspaceRefreshed();

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Revision Notes" })).toHaveValue("Externally updated notes"));
    expect(mocks.getRevisionNotes).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite unsaved local Revision Notes during automatic refresh", async () => {
    mocks.getRevisionNotes.mockResolvedValue({ content: "Original notes", maxBytes: 65_536 });

    renderView();
    expect(await screen.findByText("Original notes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox", { name: "Revision Notes" });
    fireEvent.change(editor, { target: { value: "Unsaved local edit" } });

    notifyWorkspaceRefreshed();

    await waitFor(() => expect(editor).toHaveValue("Unsaved local edit"));
    expect(mocks.getRevisionNotes).toHaveBeenCalledTimes(1);
  });
});

describe("RevisionsView revision detail actions", () => {
  it("places Approve Revision with the selected revision actions", async () => {
    mocks.getRevisionNotes.mockResolvedValue({ content: "Notes", maxBytes: 65_536 });
    const onApprove = vi.fn();
    renderView(project, vi.fn(), onApprove);

    const button = await screen.findByRole("button", { name: "Approve Revision" });
    expect(button.closest(".revision-detail-heading-actions")).not.toBeNull();
    fireEvent.click(button);
    expect(onApprove).toHaveBeenCalledWith(project.revisions[0]);
  });

  it("shows Create Delivery only for the approved revision and invokes the delivery handoff", async () => {
    mocks.getRevisionNotes.mockResolvedValue({ content: "Notes", maxBytes: 65_536 });
    const onCreateDelivery = vi.fn();
    const approvedProject: ProjectSummary = {
      ...project,
      approvedRevision: 1,
      revisions: [{
        ...project.revisions[0],
        approvedAt: "2026-08-16T13:00:00Z",
        approvedBy: "Engineer",
      }],
    };

    renderView(approvedProject, onCreateDelivery);

    const button = await screen.findByRole("button", { name: "Create Delivery" });
    expect(button.closest(".revision-detail-heading-actions")).not.toBeNull();
    fireEvent.click(button);
    expect(onCreateDelivery).toHaveBeenCalledTimes(1);
  });

  it("does not show Create Delivery for an unapproved revision", async () => {
    mocks.getRevisionNotes.mockResolvedValue({ content: "Notes", maxBytes: 65_536 });
    renderView();
    await screen.findByText("Notes");
    expect(screen.queryByRole("button", { name: "Create Delivery" })).not.toBeInTheDocument();
  });
});
