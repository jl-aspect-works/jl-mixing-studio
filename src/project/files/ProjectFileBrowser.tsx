import { useEffect, useMemo, useState } from "react";
import { ProjectFileList } from "./ProjectFileList";
import { canNavigateProjectFilesUp, projectFilePathUp } from "./projectFileNavigation";
import type { ProjectFileEntry } from "./projectFileService";
import { useProjectFiles } from "./useProjectFiles";

export function ProjectFileBrowser({
  clientId,
  projectId,
  initialPath,
  rootPath = initialPath,
  emptyMessage,
  onPreview,
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
  onReveal?: (entry: ProjectFileEntry) => void;
  onRename?: (entry: ProjectFileEntry) => void;
  onDelete?: (entry: ProjectFileEntry) => void;
}) {
  const [relativePath, setRelativePath] = useState(initialPath);
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });

  useEffect(() => {
    setRelativePath(initialPath);
  }, [initialPath]);

  const canNavigateUp = useMemo(
    () => canNavigateProjectFilesUp(relativePath, rootPath),
    [relativePath, rootPath],
  );

  const navigateUp = () => {
    if (!canNavigateUp) return;
    setRelativePath(projectFilePathUp(relativePath, rootPath));
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

      {state.status === "loading" && state.listing === null && (
        <section className="notice" aria-live="polite">Reading project files…</section>
      )}

      {state.listing && (
        <ProjectFileList
          listing={state.listing}
          emptyMessage={emptyMessage}
          onOpenDirectory={(entry) => setRelativePath(entry.relativePath)}
          onPreview={onPreview}
          onReveal={onReveal}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
