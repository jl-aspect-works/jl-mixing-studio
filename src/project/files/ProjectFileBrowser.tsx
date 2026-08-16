import { useEffect, useMemo, useState } from "react";
import { AudioPreviewPlayer } from "./AudioPreviewPlayer";
import { ProjectFileList } from "./ProjectFileList";
import { canNavigateProjectFilesUp, projectFilePathUp } from "./projectFileNavigation";
import {
  presentProjectFileListing,
  type ProjectFileKindFilter,
  type ProjectFileSort,
} from "./projectFilePresentation";
import {
  openProjectFile,
  revealProjectFile,
  type ProjectFileEntry,
} from "./projectFileService";
import { useProjectFiles } from "./useProjectFiles";
import "./ProjectFileBrowser.css";

const actionErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The project file action could not be completed.";

export function ProjectFileBrowser({
  clientId,
  projectId,
  initialPath,
  rootPath = initialPath,
  emptyMessage,
  onPreview,
  onOpen,
  onReveal,
  onRename,
  onDelete,
}: {
  clientId: string;
  projectId: string;
  initialPath: string;
  rootPath?: string;
  emptyMessage?: string;
  onPreview?: (entry: ProjectFileEntry) => void;
  onOpen?: (entry: ProjectFileEntry) => void;
  onReveal?: (entry: ProjectFileEntry) => void;
  onRename?: (entry: ProjectFileEntry) => void;
  onDelete?: (entry: ProjectFileEntry) => void;
}) {
  const [relativePath, setRelativePath] = useState(initialPath);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ProjectFileKindFilter>("all");
  const [sort, setSort] = useState<ProjectFileSort>("name");
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });

  useEffect(() => {
    setRelativePath(initialPath);
    setActionError(null);
    setQuery("");
    setKind("all");
    setSort("name");
  }, [initialPath]);

  const canNavigateUp = useMemo(
    () => canNavigateProjectFilesUp(relativePath, rootPath),
    [relativePath, rootPath],
  );
  const visibleListing = useMemo(
    () => state.listing ? presentProjectFileListing(state.listing, { query, kind, sort }) : null,
    [state.listing, query, kind, sort],
  );
  const filtersActive = query.trim() !== "" || kind !== "all";

  const navigateTo = (nextPath: string) => {
    setActionError(null);
    setQuery("");
    setRelativePath(nextPath);
  };

  const navigateUp = () => {
    if (!canNavigateUp) return;
    navigateTo(projectFilePathUp(relativePath, rootPath));
  };

  const runDefaultAction = async (
    action: typeof openProjectFile | typeof revealProjectFile,
    entry: ProjectFileEntry,
  ) => {
    setActionError(null);
    try {
      await action({ clientId, projectId, relativePath: entry.relativePath });
    } catch (error) {
      setActionError(actionErrorMessage(error));
    }
  };

  const openEntry = (entry: ProjectFileEntry) => {
    if (onOpen) {
      onOpen(entry);
      return;
    }
    void runDefaultAction(openProjectFile, entry);
  };

  const revealEntry = (entry: ProjectFileEntry) => {
    if (onReveal) {
      onReveal(entry);
      return;
    }
    void runDefaultAction(revealProjectFile, entry);
  };

  return (
    <section className="project-file-browser" aria-label="Project files">
      <div className="directory-toolbar project-file-toolbar">
        <div>
          <p className="kicker">Project files</p>
          <code>{relativePath || "Project root"}</code>
        </div>
        <div className="directory-actions">
          <button type="button" className="secondary" onClick={navigateUp} disabled={!canNavigateUp}>
            Up
          </button>
          <button type="button" className="secondary" onClick={() => void refresh()} disabled={state.status === "loading"}>
            {state.status === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {state.listing && (
        <div className="project-file-controls" aria-label="File view controls">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this folder"
            />
          </label>
          <label>
            <span>Show</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as ProjectFileKindFilter)}>
              <option value="all">Everything</option>
              <option value="audio">Audio</option>
              <option value="files">Files</option>
              <option value="folders">Folders</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as ProjectFileSort)}>
              <option value="name">Name</option>
              <option value="modified">Modified</option>
              <option value="size">Size</option>
            </select>
          </label>
        </div>
      )}

      {state.status === "error" && (
        <section className="notice error" role="alert">
          <strong>We couldn’t read this project folder</strong>
          <span>{state.message}</span>
          <button type="button" onClick={() => void refresh()}>Try again</button>
        </section>
      )}

      {actionError && (
        <section className="notice error" role="alert">
          <strong>We couldn’t complete that file action</strong>
          <span>{actionError}</span>
        </section>
      )}

      {state.status === "loading" && state.listing === null && (
        <section className="notice" aria-live="polite">Reading project files…</section>
      )}

      {visibleListing && (
        <ProjectFileList
          listing={visibleListing}
          emptyMessage={filtersActive ? "No files match the current search or filter." : emptyMessage}
          onOpenDirectory={(entry) => navigateTo(entry.relativePath)}
          onOpen={openEntry}
          onPreview={onPreview}
          renderPreview={onPreview ? undefined : (entry) => (
            <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} />
          )}
          onReveal={revealEntry}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
