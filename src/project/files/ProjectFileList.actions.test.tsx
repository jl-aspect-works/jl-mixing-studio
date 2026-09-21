import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectFileList } from "./ProjectFileList";
import type { ProjectFileEntry, ProjectFileListing } from "./projectFileService";

const file = (permissions: ProjectFileEntry["permissions"]): ProjectFileEntry => ({
  id: "mix",
  relativePath: "02_Audio_Preparation/Working_Audio/Mix.wav",
  displayName: "Mix.wav",
  extension: "wav",
  entryType: "file",
  area: "audioPreparation",
  sizeBytes: 1024,
  modifiedEpochMs: null,
  isAudio: false,
  playable: false,
  permissions,
});

const listing = (entry: ProjectFileEntry): ProjectFileListing => ({
  relativePath: "02_Audio_Preparation/Working_Audio",
  area: entry.area,
  permissions: entry.permissions,
  entries: [entry],
});

afterEach(cleanup);

describe("ProjectFileList contextual mutation actions", () => {
  it("shows enabled rename and delete actions only for eligible files", () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const entry = file({ canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false });

    render(<ProjectFileList listing={listing(entry)} onRename={onRename} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledWith(entry);
    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(entry);
  });

  it("does not expose no-op mutation actions for read-only files", () => {
    const entry = file({ canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false });
    render(<ProjectFileList listing={listing(entry)} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });
});
