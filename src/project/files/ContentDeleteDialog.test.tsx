import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentDeleteDialog } from "./ContentDeleteDialog";
import type { ProjectFileEntry } from "./projectFileService";

const { plan, execute } = vi.hoisted(() => ({ plan: vi.fn(), execute: vi.fn() }));
vi.mock("./projectFileService", () => ({
  planProjectContentDelete: plan,
  executeProjectContentDelete: execute,
}));

const entry: ProjectFileEntry = {
  id: "folder", relativePath: "02_Audio_Preparation/Working_Audio/Stems", displayName: "Stems",
  extension: null, entryType: "directory", area: "audioPreparation", sizeBytes: null,
  modifiedEpochMs: null, isAudio: false, playable: false,
  permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: true, canCopy: false },
};

beforeEach(() => {
  plan.mockReset().mockResolvedValue({ relativePath: entry.relativePath, displayName: "Stems", isDirectory: true, fileCount: 2, directoryCount: 1, totalBytes: 42, fingerprint: "snapshot" });
  execute.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe("ContentDeleteDialog", () => {
  it("shows recursive scope and requires an exact folder name before execution", async () => {
    const completed = vi.fn();
    render(<ContentDeleteDialog clientId="c" projectId="p" entry={entry} onClose={vi.fn()} onCompleted={completed} />);
    expect(await screen.findByText(/2 files, 1 folder, 42 bytes/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Delete folder" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type Stems to confirm/), { target: { value: "stems" } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type Stems to confirm/), { target: { value: "Stems" } });
    fireEvent.click(button);
    await waitFor(() => expect(execute).toHaveBeenCalledWith({
      clientId: "c", projectId: "p", relativePath: entry.relativePath,
      fingerprint: "snapshot", confirmName: "Stems",
    }));
    expect(completed).toHaveBeenCalled();
  });

  it("blocks execution when backend rejects a managed dependency", async () => {
    plan.mockRejectedValue(new Error("Audio Prep lineage blocks deletion"));
    render(<ContentDeleteDialog clientId="c" projectId="p" entry={entry} onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Audio Prep lineage blocks deletion");
    expect(screen.getByRole("button", { name: "Delete file" })).toBeDisabled();
    expect(execute).not.toHaveBeenCalled();
  });
});
