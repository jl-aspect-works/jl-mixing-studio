import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientSummary } from "../types";
import { ClientDeleteDialog } from "./ClientDeleteDialog";
import { executeClientDeletion, planClientDeletion } from "./clientDeleteService";

vi.mock("./clientDeleteService", () => ({
  planClientDeletion: vi.fn(),
  executeClientDeletion: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const client: ClientSummary = {
  clientId: "client",
  clientName: "Exact Client",
  createdAt: "2026-01-01T00:00:00Z",
  defaultArtist: "Artist",
  projects: [],
};

const summary = {
  client: {
    id: "client",
    name: "Exact Client",
    path: "/workspace/Clients/Exact Client",
    document_id: "document",
  },
  project_count: 0 as const,
  file_count: 3,
  total_bytes: 2048,
  includes: [],
  recoverable: false as const,
  fingerprint: "a".repeat(64),
};

describe("ClientDeleteDialog", () => {
  it("shows an opaque authoritative dialog and requires the exact Client Name", async () => {
    vi.mocked(planClientDeletion).mockResolvedValue({
      ok: true, status: "planned", message: "", data: { summary },
    });
    vi.mocked(executeClientDeletion).mockResolvedValue({
      ok: true, status: "success", message: "", data: { summary, deleted: true },
    });
    const onDeleted = vi.fn();
    render(<ClientDeleteDialog client={client} onClose={vi.fn()} onDeleted={onDeleted} />);
    const dialog = screen.getByRole("dialog", { name: "Delete Client" });
    expect(dialog).toHaveClass("client-delete-dialog");
    expect(await screen.findByText(summary.client.path)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    const confirm = screen.getByLabelText("Type Client Name to confirm deletion");
    const remove = screen.getByRole("button", { name: "Permanently Delete Client" });
    expect(remove).toBeDisabled();
    fireEvent.change(confirm, { target: { value: "exact client" } });
    expect(remove).toBeDisabled();
    fireEvent.keyDown(confirm, { key: "Enter" });
    expect(executeClientDeletion).not.toHaveBeenCalled();
    fireEvent.change(confirm, { target: { value: "Exact Client" } });
    fireEvent.click(remove);
    await waitFor(() => expect(executeClientDeletion).toHaveBeenCalledWith(
      "client", summary.fingerprint, "Exact Client",
    ));
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open and reports a newly detected project", async () => {
    vi.mocked(planClientDeletion).mockResolvedValue({
      ok: true, status: "planned", message: "", data: { summary },
    });
    vi.mocked(executeClientDeletion).mockResolvedValue({
      ok: false,
      status: "blocked",
      message: "Client contains 1 project directory; delete all projects first.",
      data: { deleted: false, project_count: 1 },
    });
    const onDeleted = vi.fn();
    render(<ClientDeleteDialog client={client} onClose={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.change(await screen.findByLabelText("Type Client Name to confirm deletion"), {
      target: { value: "Exact Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Permanently Delete Client" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("delete all projects first");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("reports partial cleanup without claiming deletion", async () => {
    vi.mocked(planClientDeletion).mockResolvedValue({
      ok: true, status: "planned", message: "", data: { summary },
    });
    vi.mocked(executeClientDeletion).mockResolvedValue({
      ok: false,
      status: "error",
      message: "Deletion failed.",
      data: {
        deleted: false,
        partial_cleanup: true,
        remaining_path: "/workspace/Clients/.deleting-client-abc",
      },
    });
    const onDeleted = vi.fn();
    render(<ClientDeleteDialog client={client} onClose={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.change(await screen.findByLabelText("Type Client Name to confirm deletion"), {
      target: { value: "Exact Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Permanently Delete Client" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Partial client data remains");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
