import { useMemo, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import {
  deleteRevisionFile,
  formatProjectFileModified,
  formatProjectFileSize,
  openProjectFile,
  renameRevisionFile,
  revealProjectFile,
  type ProjectFileEntry,
} from "../project/files/projectFileService";
import { canNavigateProjectFilesUp, projectFilePathUp } from "../project/files/projectFileNavigation";
import { useProjectFiles } from "../project/files/useProjectFiles";

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The revision file action could not be completed.";

const filenameStem = (entry: ProjectFileEntry) => {
  if (!entry.extension) return entry.displayName;
  const suffix = `.${entry.extension}`;
  return entry.displayName.toLowerCase().endsWith(suffix.toLowerCase())
    ? entry.displayName.slice(0, -suffix.length)
    : entry.displayName;
};

export function RevisionFileBrowser({
  clientId,
  projectId,
  revision,
}: {
  clientId: string;
  projectId: string;
  revision: number;
}) {
  const rootPath = `04_Revisions/Revision_${String(revision).padStart(2, "0")}`;
  const [relativePath, setRelativePath] = useState(rootPath);
  const [query, setQuery] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameStem, setRenameStem] = useState("");
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });

  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (state.listing?.entries ?? [])
      .filter((entry) => entry.displayName !== "Revision_Notes.md")
      .filter((entry) => !normalizedQuery || entry.displayName.toLowerCase().includes(normalizedQuery));
  }, [state.listing, query]);

  const navigateTo = (path: string) => {
    setRelativePath(path);
    setQuery("");
    setEditingPath(null);
    setConfirmDeletePath(null);
    setActionError(null);
  };

  const runFileAction = async (action: "open" | "reveal", entry: ProjectFileEntry) => {
    setActionError(null);
    setBusyPath(entry.relativePath);
    try {
      const request = { clientId, projectId, relativePath: entry.relativePath };
      await (action === "open" ? openProjectFile(request) : revealProjectFile(request));
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyPath(null);
    }
  };

  const beginRename = (entry: ProjectFileEntry) => {
    if (editingPath === entry.relativePath) return;
    setEditingPath(entry.relativePath);
    setRenameStem(filenameStem(entry));
    setActionError(null);
  };

  const cancelRename = (entry: ProjectFileEntry) => {
    setEditingPath(null);
    setRenameStem(filenameStem(entry));
  };

  const saveRename = async (entry: ProjectFileEntry) => {
    const nextStem = renameStem.trim();
    if (!nextStem || nextStem === filenameStem(entry)) {
      cancelRename(entry);
      return;
    }
    setBusyPath(entry.relativePath);
    setActionError(null);
    try {
      await renameRevisionFile(
        { clientId, projectId, relativePath: entry.relativePath },
        nextStem,
      );
      setEditingPath(null);
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyPath(null);
    }
  };

  const deleteEntry = async (entry: ProjectFileEntry) => {
    setBusyPath(entry.relativePath);
    setActionError(null);
    try {
      await deleteRevisionFile({ clientId, projectId, relativePath: entry.relativePath });
      setConfirmDeletePath(null);
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyPath(null);
    }
  };

  const canNavigateUp = canNavigateProjectFilesUp(relativePath, rootPath);

  return <section className="revision-files" aria-label={`Revision ${revision} files`}>
    <div className="revision-files-toolbar">
      <code>{relativePath}</code>
      <div className="directory-actions">
        <button
          type="button"
          className="secondary"
          disabled={!canNavigateUp || state.status === "loading"}
          onClick={() => navigateTo(projectFilePathUp(relativePath, rootPath))}
        >Up</button>
        <button type="button" className="secondary" disabled={state.status === "loading"} onClick={() => void refresh()}>
          {state.status === "loading" ? "Refreshing…" : "Refresh files"}
        </button>
      </div>
    </div>

    <div className="revision-files-search">
      <input
        type="search"
        aria-label="Search revision files"
        placeholder="Search this revision"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </div>

    {actionError && <div className="inline-notice error" role="alert">{actionError}</div>}
    {state.status === "error" && <div className="inline-notice error" role="alert">{state.message}</div>}

    <div className="revision-files-table-wrap">
      <table className="revision-files-table">
        <thead><tr><th>Filename</th><th>Preview</th><th>Type</th><th>Size</th><th>Modified</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {entries.map((entry) => {
            const editing = editingPath === entry.relativePath;
            const confirming = confirmDeletePath === entry.relativePath;
            const busy = busyPath === entry.relativePath;
            return <tr key={entry.id}>
              <td className="revision-file-name-cell">
                {entry.entryType === "directory"
                  ? <button type="button" className="table-link" onClick={() => navigateTo(entry.relativePath)}>{entry.displayName}</button>
                  : entry.permissions.canRename
                    ? <div className="revision-inline-filename">
                        <input
                          aria-label={`Filename ${entry.displayName}`}
                          value={editing ? renameStem : filenameStem(entry)}
                          disabled={busy}
                          onFocus={() => beginRename(entry)}
                          onChange={(event) => {
                            if (!editing) beginRename(entry);
                            setRenameStem(event.target.value);
                          }}
                          onBlur={() => { if (editing && !busy) void saveRename(entry); }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                            if (event.key === "Escape") { event.preventDefault(); cancelRename(entry); event.currentTarget.blur(); }
                          }}
                        />
                        {entry.extension && <span>.{entry.extension}</span>}
                        {busy && editing && <small>Saving…</small>}
                      </div>
                    : <strong>{entry.displayName}</strong>}
              </td>
              <td className="revision-file-preview-cell">
                {entry.entryType === "file" && entry.playable
                  ? <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} />
                  : <span className="revision-muted">—</span>}
              </td>
              <td>{entry.entryType === "directory" ? "Folder" : entry.extension?.toUpperCase() ?? "File"}</td>
              <td>{entry.entryType === "file" ? formatProjectFileSize(entry.sizeBytes) : "—"}</td>
              <td>{formatProjectFileModified(entry.modifiedEpochMs)}</td>
              <td>
                <div className="revision-file-actions">
                  <details className="revision-row-menu">
                    <summary aria-label={`Actions for ${entry.displayName}`} title="More actions">…</summary>
                    <div className="revision-row-menu-popover">
                      {confirming ? <>
                        <button type="button" className="revision-delete-confirm" disabled={busy} onClick={() => void deleteEntry(entry)}>Confirm Delete</button>
                        <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmDeletePath(null)}>Cancel</button>
                      </> : <>
                        {entry.entryType === "file" && entry.permissions.canOpen && <button type="button" disabled={busy} onClick={() => void runFileAction("open", entry)}>Open</button>}
                        {entry.permissions.canReveal && <button type="button" disabled={busy} onClick={() => void runFileAction("reveal", entry)}>Reveal</button>}
                        {entry.entryType === "file" && entry.permissions.canDelete && <button type="button" className="revision-delete" disabled={busy} onClick={() => setConfirmDeletePath(entry.relativePath)}>Delete</button>}
                      </>}
                    </div>
                  </details>
                </div>
              </td>
            </tr>;
          })}
          {!entries.length && state.status !== "loading" && <tr><td colSpan={6} className="revision-files-empty">No revision files found.</td></tr>}
          {!entries.length && state.status === "loading" && <tr><td colSpan={6} className="revision-files-empty">Loading revision files…</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
