import { useEffect, useMemo, useState } from "react";
import { AudioPreviewPlayer } from "./AudioPreviewPlayer";
import { FileViewControls, ManagedFolderToolbar } from "./FileUiPrimitives";
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
  onOpenFolder,
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
  onOpenFolder?: (relativePath: string) => void | Promise<void>;
  onPreview?: (entry: ProjectFileEntry) => void;
  onOpen?: (entry: ProjectFileEntry) => void;
  onReveal?: (entry: ProjectFileEntry) => void;
  onRename?: (entry: ProjectFileEntry) => void | Promise<void>;
  onDelete?: (entry: ProjectFileEntry) => void | Promise<void>;
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

  const runManagedMutation = async (
    action: ((entry: ProjectFileEntry) => void | Promise<void>) | undefined,
    entry: ProjectFileEntry,
  ) => {
    if (!action) return;
    setActionError(null);
    try {
      await action(entry);
      await refresh();
    } catch (error) {
      setActionError(actionErrorMessage(error));
    }
  };

  const openFolder = async () => {
    if (!onOpenFolder) return;
    setActionError(null);
    try {
      await onOpenFolder(relativePath);
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
      <ManagedFolderToolbar
        path={relativePath}
        canNavigateUp={canNavigateUp}
        loading={state.status === "loading"}
        onUp={navigateUp}
        onRefresh={() => void refresh()}
        onOpenFolder={onOpenFolder ? () => void openFolder() : undefined}
      />

      {state.listing && <FileViewControls
        label="File view controls"
        controls={[
          { icon: "search", label: "Search", control: <input aria-label="Search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder" /> },
          { icon: "show", label: "Show file types", control: <select aria-label="Show file types" value={kind} onChange={(event) => setKind(event.target.value as ProjectFileKindFilter)}><option value="all">Everything</option><option value="audio">Audio</option><option value="files">Files</option><option value="folders">Folders</option></select> },
          { icon: "sort", label: "Sort", control: <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as ProjectFileSort)}><option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option></select> },
        ]}
      />}

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
          onRename={onRename ? (entry) => void runManagedMutation(onRename, entry) : undefined}
          onDelete={onDelete ? (entry) => void runManagedMutation(onDelete, entry) : undefined}
        />
      )}
    </section>
  );
}
