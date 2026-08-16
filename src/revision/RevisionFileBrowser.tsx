import { useMemo, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import { FileViewControls, ManagedFolderToolbar, RowActionMenu } from "../project/files/FileUiPrimitives";
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
    <ManagedFolderToolbar
      path={relativePath}
      canNavigateUp={canNavigateUp}
      loading={state.status === "loading"}
      onUp={() => navigateTo(projectFilePathUp(relativePath, rootPath))}
      onRefresh={() => void refresh()}
      refreshLabel="Refresh files"
    />

    <FileViewControls
      label="Revision file view controls"
      className="revision-files-search"
      controls={[{
        icon: "search",
        label: "Search",
        control: <input
          type="search"
          aria-label="Search revision files"
          placeholder="Search this revision"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />,
      }]}
    />

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
            const actions = confirming ? [
              { label: "Confirm Delete", onSelect: () => void deleteEntry(entry), disabled: busy, destructive: true },
              { label: "Cancel", onSelect: () => setConfirmDeletePath(null), disabled: busy },
            ] : [
              entry.entryType === "file" && entry.permissions.canOpen ? { label: "Open", onSelect: () => void runFileAction("open", entry), disabled: busy } : null,
              entry.permissions.canReveal ? { label: "Reveal", onSelect: () => void runFileAction("reveal", entry), disabled: busy } : null,
              entry.entryType === "file" && entry.permissions.canDelete ? { label: "Delete", onSelect: () => setConfirmDeletePath(entry.relativePath), disabled: busy, destructive: true } : null,
            ].filter((action): action is NonNullable<typeof action> => action !== null);
            return <tr key={entry.id}>
              <td className={`revision-file-name-cell${entry.entryType === "directory" ? " revision-folder-name-cell" : ""}`}>
                {entry.entryType === "directory"
                  ? <button type="button" className="table-link revision-folder-link" onClick={() => navigateTo(entry.relativePath)}>{entry.displayName}</button>
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
              <td className={entry.entryType === "directory" ? "revision-folder-type-cell" : undefined}>{entry.entryType === "directory" ? "Folder" : entry.extension?.toUpperCase() ?? "File"}</td>
              <td>{entry.entryType === "file" ? formatProjectFileSize(entry.sizeBytes) : "—"}</td>
              <td>{formatProjectFileModified(entry.modifiedEpochMs)}</td>
              <td><div className="revision-file-actions"><RowActionMenu label={`Actions for ${entry.displayName}`} actions={actions} /></div></td>
            </tr>;
          })}
          {!entries.length && state.status !== "loading" && <tr><td colSpan={6} className="revision-files-empty">No revision files found.</td></tr>}
          {!entries.length && state.status === "loading" && <tr><td colSpan={6} className="revision-files-empty">Loading revision files…</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
