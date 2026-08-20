import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import type { ProjectFileEntry, ProjectFileListing } from "./projectFileService";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

const permissions = {
  canOpen: true,
  canReveal: true,
  canRename: false,
  canDelete: false,
  canCopy: true,
};

const directoryEntry = (relativePath: string, displayName: string): ProjectFileEntry => ({
  id: relativePath,
  relativePath,
  displayName,
  extension: null,
  entryType: "directory",
  area: "otherManaged",
  sizeBytes: null,
  modifiedEpochMs: null,
  isAudio: false,
  playable: false,
  permissions,
});

const listingFor = (relativePath: string): ProjectFileListing => ({
  relativePath,
  area: relativePath ? "otherManaged" : "projectRoot",
  permissions,
  entries: relativePath === ""
    ? [directoryEntry("02_Audio_Preparation", "02_Audio_Preparation")]
    : relativePath === "02_Audio_Preparation"
      ? [directoryEntry("02_Audio_Preparation/Working_Audio", "Working_Audio")]
      : [],
});

vi.mock("./useProjectFiles", () => ({
  useProjectFiles: ({ relativePath }: { relativePath: string }) => ({
    state: { status: "ready" as const, listing: listingFor(relativePath), message: null },
    refresh,
  }),
}));

vi.mock("./ProjectFileList", () => ({
  ProjectFileList: ({
    listing,
    onOpenDirectory,
  }: {
    listing: ProjectFileListing;
    onOpenDirectory: (entry: ProjectFileEntry) => void;
  }) => <div>
    {listing.entries.filter((entry) => entry.entryType === "directory").map((entry) => (
      <button key={entry.id} type="button" onClick={() => onOpenDirectory(entry)}>{entry.displayName}</button>
    ))}
  </div>,
}));

vi.mock("./AudioPreviewPlayer", () => ({ AudioPreviewPlayer: () => null }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe("ProjectFileBrowser enhanced navigation", () => {
  it("navigates folders with breadcrumbs, Up, and Back without leaving the project root", () => {
    render(
      <ProjectFileBrowser
        clientId="client-1"
        projectId="project-1"
        initialPath=""
        rootPath=""
        enhancedNavigation
        breadcrumbRootLabel="Project root"
        pathDescription={(path) => `Policy for ${path || "root"}`}
      />,
    );

    expect(screen.getByText("Policy for root")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Up" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "02_Audio_Preparation" }));

    expect(screen.getByText("Policy for 02_Audio_Preparation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Project root" })).toBeInTheDocument();
    expect(screen.getByText("02_Audio_Preparation", { selector: "span[aria-current='page']" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Up" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Working_Audio" }));
    expect(screen.getByText("Working_Audio", { selector: "span[aria-current='page']" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("02_Audio_Preparation", { selector: "span[aria-current='page']" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Project root" }));
    expect(screen.getByText("Project root", { selector: "span[aria-current='page']" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Up" })).toBeDisabled();
  });
});
