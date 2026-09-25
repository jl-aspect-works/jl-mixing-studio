import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import type { ProjectFileListing } from "./projectFileService";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

const listing: ProjectFileListing = {
  relativePath: "04_Revisions/Revision_01",
  area: "revisions",
  permissions: { canOpen: true, canReveal: true, canRename: false, canDelete: false, canCopy: false },
  entries: [{
    id: "mix",
    relativePath: "04_Revisions/Revision_01/Mix.wav",
    displayName: "Mix.wav",
    extension: "wav",
    entryType: "file",
    area: "revisions",
    sizeBytes: 1024,
    modifiedEpochMs: null,
    isAudio: false,
    playable: false,
    permissions: { canOpen: true, canReveal: true, canRename: true, canDelete: true, canCopy: false },
  }],
};

vi.mock("./useProjectFiles", () => ({
  useProjectFiles: () => ({ state: { status: "ready", listing, message: null }, refresh }),
}));

beforeEach(() => {
  refresh.mockReset().mockResolvedValue(true);
});

afterEach(cleanup);

describe("ProjectFileBrowser managed mutations", () => {
  it("refreshes the authoritative listing and reports success after rename", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);

    render(<ProjectFileBrowser
      clientId="client"
      projectId="project"
      initialPath={listing.relativePath}
      onRename={onRename}
      onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("File name"), { target: { value: "Mix Print" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith(listing.entries[0], "Mix Print"));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Mix.wav was renamed.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the original row and skips refresh after backend rejection", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("The NAS path is unavailable. Reconnect it and try again."));

    render(<ProjectFileBrowser
      clientId="client"
      projectId="project"
      initialPath={listing.relativePath}
      onRename={vi.fn()}
      onDelete={onDelete}
    />);

    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("NAS path is unavailable");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getAllByText("Mix.wav", { selector: "strong" }).length).toBeGreaterThan(0);
  });

  it("closes delete confirmation without invoking the backend when canceled", () => {
    const onDelete = vi.fn();

    render(<ProjectFileBrowser
      clientId="client"
      projectId="project"
      initialPath={listing.relativePath}
      onRename={vi.fn()}
      onDelete={onDelete}
    />);

    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the confirmation without claiming a fresh listing when refresh fails after deletion", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    refresh.mockResolvedValue(false);

    render(<ProjectFileBrowser
      clientId="client"
      projectId="project"
      initialPath={listing.relativePath}
      onRename={vi.fn()}
      onDelete={onDelete}
    />);

    fireEvent.click(screen.getByLabelText("Actions for Mix.wav"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("folder could not be refreshed");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Mix.wav was deleted.")).not.toBeInTheDocument();
  });
});
