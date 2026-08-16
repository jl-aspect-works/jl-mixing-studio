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
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ProjectFileKindFilter>("all");
  const [sort, setSort] = useState<ProjectFileSort>("name");
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });

  useEffect(() => {
    setRelativePath(initialPath);
    setActionError(null);
    setActionBusy(null);
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
  const actionsDisabled = actionBusy !== null;

  const navigateTo = (nextPath: string) => {
    if (actionsDisabled) return;
    setActionError(null);
    setQuery("");
    setRelativePath(nextPath);
  };

  const navigateUp = () => {
    if (!canNavigateUp || actionsDisabled) return;
    navigateTo(projectFilePathUp(relativePath, rootPath));
  };

  const runDefaultAction = async (
    action: typeof openProjectFile | typeof revealProjectFile,
    entry: ProjectFileEntry,
    busyMessage: string,
  ) => {
    if (actionsDisabled) return;
    setActionError(null);
    setActionBusy(busyMessage);
    try {
      await action({ clientId, projectId, relativePath: entry.relativePath });
    } catch (error) {
      setActionError(actionErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const runManagedMutation = async (
    action: ((entry: ProjectFileEntry) => void | Promise<void>) | undefined,
    entry: ProjectFileEntry,
    busyMessage: string,
  ) => {
    if (!action || actionsDisabled) return;
    setActionError(null);
    setActionBusy(busyMessage);
    try {
      await action(entry);
      await refresh();
    } catch (error) {
      setActionError(actionErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const openFolder = async () => {
    if (!onOpenFolder || actionsDisabled) return;
    setActionError(null);
    setActionBusy("Opening folder…");
    try {
      await onOpenFolder(relativePath);
    } catch (error) {
      setActionError(actionErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const openEntry = (entry: ProjectFileEntry) => {
    if (actionsDisabled) return;
    if (onOpen) {
      setActionBusy(`Opening ${entry.displayName}…`);
      Promise.resolve(onOpen(entry)).finally(() => setActionBusy(null));
      return;
    }
    void runDefaultAction(openProjectFile, entry, `Opening ${entry.displayName}…`);
  };

  const revealEntry = (entry: ProjectFileEntry) => {
    if (actionsDisabled) return;
    if (onReveal) {
      setActionBusy(`Revealing ${entry.displayName}…`);
      Promise.resolve(onReveal(entry)).finally(() => setActionBusy(null));
      return;
    }
    void runDefaultAction(revealProjectFile, entry, `Revealing ${entry.displayName}…`);
  };

  return (
    <section className="project-file-browser" aria-label="Project files">
      <ManagedFolderToolbar
        path={relativePath}
        canNavigateUp={canNavigateUp && !actionsDisabled}
        loading={state.status === "loading" || actionsDisabled}
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

      {actionBusy && <section className="notice" role="status" aria-live="polite">{actionBusy}</section>}

      {state.status === "loading" && state.listing === null && (
        <section className="notice" aria-live="polite">Reading project files…</section>
      )}

      {visibleListing && (
        <ProjectFileList
          listing={visibleListing}
          emptyMessage={filtersActive ? "No files match the current search or filter." : emptyMessage}
          actionsDisabled={actionsDisabled}
          onOpenDirectory={(entry) => navigateTo(entry.relativePath)}
          onOpen={openEntry}
          onPreview={onPreview}
          renderPreview={onPreview ? undefined : (entry) => (
            <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} />
          )}
          onReveal={revealEntry}
          onRename={onRename ? (entry) => void runManagedMutation(onRename, entry, `Renaming ${entry.displayName}…`) : undefined}
          onDelete={onDelete ? (entry) => void runManagedMutation(onDelete, entry, `Deleting ${entry.displayName}…`) : undefined}
        />
      )}
    </section>
  );
}
