import { useEffect, useMemo, useState } from "react";
import { ProjectFileList } from "./ProjectFileList";
import { canNavigateProjectFilesUp, projectFilePathUp } from "./projectFileNavigation";
import {
  openProjectFile,
  revealProjectFile,
  type ProjectFileEntry,
} from "./projectFileService";
import { useProjectFiles } from "./useProjectFiles";

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
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });

  useEffect(() => {
    setRelativePath(initialPath);
    setActionError(null);
  }, [initialPath]);

  const canNavigateUp = useMemo(
    () => canNavigateProjectFilesUp(relativePath, rootPath),
    [relativePath, rootPath],
  );

  const navigateUp = () => {
    if (!canNavigateUp) return;
    setActionError(null);
    setRelativePath(projectFilePathUp(relativePath, rootPath));
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

      {state.listing && (
        <ProjectFileList
          listing={state.listing}
          emptyMessage={emptyMessage}
          onOpenDirectory={(entry) => {
            setActionError(null);
            setRelativePath(entry.relativePath);
          }}
          onOpen={openEntry}
          onPreview={onPreview}
          onReveal={revealEntry}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
