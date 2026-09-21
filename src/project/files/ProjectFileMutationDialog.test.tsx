import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectFileMutationDialog } from "./ProjectFileMutationDialog";
import type { ProjectFileEntry } from "./projectFileService";

const entry: ProjectFileEntry = {
  id: "mix",
  relativePath: "02_Audio_Preparation/Working_Audio/Mix.wav",
  displayName: "Mix.wav",
  extension: "wav",
  entryType: "file",
  area: "audioPreparation",
  sizeBytes: 1024,
  modifiedEpochMs: null,
  isAudio: true,
  playable: true,
  permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
};

afterEach(cleanup);

describe("ProjectFileMutationDialog", () => {
  it("renames with a Studio-native form and keeps the extension unchanged", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onCompleted = vi.fn().mockResolvedValue(undefined);

    render(<ProjectFileMutationDialog
      mutation={{ kind: "rename", entry }}
      onRename={onRename}
      onDelete={vi.fn()}
      onCompleted={onCompleted}
      onClose={vi.fn()}
    />);

    expect(screen.getByText(".wav")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("File name"), { target: { value: "Mix Print" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith(entry, "Mix Print"));
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("cancels without changing the filesystem", () => {
    const onClose = vi.fn();
    const onRename = vi.fn();

    render(<ProjectFileMutationDialog
      mutation={{ kind: "rename", entry }}
      onRename={onRename}
      onDelete={vi.fn()}
      onCompleted={vi.fn()}
      onClose={onClose}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
  });

  it("shows actionable backend failures and does not report completion", async () => {
    const onCompleted = vi.fn();
    const onRename = vi.fn().mockRejectedValue("The configured workspace is unavailable; reconnect it and try again");

    render(<ProjectFileMutationDialog
      mutation={{ kind: "rename", entry }}
      onRename={onRename}
      onDelete={vi.fn()}
      onCompleted={onCompleted}
      onClose={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText("File name"), { target: { value: "Mix Print" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("workspace is unavailable");
    expect(onCompleted).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("requires explicit delete confirmation", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onCompleted = vi.fn().mockResolvedValue(undefined);

    render(<ProjectFileMutationDialog
      mutation={{ kind: "delete", entry }}
      onRename={vi.fn()}
      onDelete={onDelete}
      onCompleted={onCompleted}
      onClose={vi.fn()}
    />);

    expect(screen.getByText("This action cannot be undone. No other project files will be changed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(entry));
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });
});
