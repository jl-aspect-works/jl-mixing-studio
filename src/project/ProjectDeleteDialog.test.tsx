import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientSummary, ProjectSummary } from "../types";
import { ProjectDeleteDialog } from "./ProjectDeleteDialog";
import { executeProjectDeletion, planProjectDeletion } from "./projectDeleteService";

vi.mock("./projectDeleteService", () => ({ planProjectDeletion: vi.fn(), executeProjectDeletion: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const project: ProjectSummary = { projectId: "song", projectName: "Exact Song", artist: "Artist", schemaVersion: "1.1.0", createdWith: "jl-mixing", createdAt: "2026-01-01T00:00:00Z", deadline: null, sampleRate: 48000, bitDepth: 24, fileFormat: "WAV", deliveryMethod: "Cloud", currentRevision: 1, approvedRevision: null, deliveredRevision: null, delivery: null, revisions: [] };
const client: ClientSummary = { clientId: "client", clientName: "Client", createdAt: "2026-01-01T00:00:00Z", defaultArtist: "Artist", projects: [project] };
const summary = { client: { id: "client", name: "Client" }, project: { id: "song", name: "Exact Song", path: "/workspace/Clients/Client/Projects/Exact Song", document_id: "document" }, file_count: 12, total_bytes: 2048, includes: [], recoverable: false as const, external_listening_copies: "retained" as const, fingerprint: "a".repeat(64) };

describe("ProjectDeleteDialog", () => {
  it("shows the authoritative summary and requires the exact typed project name", async () => {
    vi.mocked(planProjectDeletion).mockResolvedValue({ ok: true, status: "planned", message: "", data: { summary } });
    vi.mocked(executeProjectDeletion).mockResolvedValue({ ok: true, status: "success", message: "", data: { summary, deleted: true } });
    const onDeleted = vi.fn();
    render(<ProjectDeleteDialog client={client} project={project} onClose={vi.fn()} onDeleted={onDeleted} />);
    expect(screen.getByRole("dialog", { name: "Delete Project" })).toHaveClass("project-delete-dialog");
    expect(await screen.findByText(summary.project.path)).toBeInTheDocument();
    expect(screen.getByText(/External Revision and Delivered Listening copies will remain/)).toBeInTheDocument();
    const confirm = screen.getByLabelText("Type Project Name to confirm deletion");
    const remove = screen.getByRole("button", { name: "Permanently Delete Project" });
    expect(remove).toBeDisabled();
    fireEvent.change(confirm, { target: { value: "exact song" } });
    expect(remove).toBeDisabled();
    fireEvent.keyDown(confirm, { key: "Enter" });
    expect(executeProjectDeletion).not.toHaveBeenCalled();
    fireEvent.change(confirm, { target: { value: "Exact Song" } });
    fireEvent.click(remove);
    await waitFor(() => expect(executeProjectDeletion).toHaveBeenCalledWith("client", "song", summary.fingerprint, "Exact Song"));
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open and reports partial cleanup", async () => {
    vi.mocked(planProjectDeletion).mockResolvedValue({ ok: true, status: "planned", message: "", data: { summary } });
    vi.mocked(executeProjectDeletion).mockResolvedValue({ ok: false, status: "error", message: "Deletion failed.", data: { deleted: false, partial_cleanup: true, remaining_path: "/workspace/Clients/Client/.deleting-abc" } });
    const onDeleted = vi.fn();
    render(<ProjectDeleteDialog client={client} project={project} onClose={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.change(await screen.findByLabelText("Type Project Name to confirm deletion"), { target: { value: "Exact Song" } });
    fireEvent.click(screen.getByRole("button", { name: "Permanently Delete Project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Partial project data remains");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
