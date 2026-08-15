import { useMemo, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import type { ProjectFileEntry } from "../project/files/projectFileService";
import {
  deleteAudioPrepFile,
  openProjectFile,
  projectFilePaths,
  renameAudioPrepFile,
  revealProjectFile,
} from "../project/files/projectFileService";
import { canNavigateProjectFilesUp, projectFilePathUp } from "../project/files/projectFileNavigation";
import { presentProjectFileListing, type ProjectFileKindFilter, type ProjectFileSort } from "../project/files/projectFilePresentation";
import { useProjectFiles } from "../project/files/useProjectFiles";
import { formatClientFileModified, type IntakeValidationFile } from "../intake/ClientFilesBrowser";
import "../intake/ClientFilesBrowser.css";
import "../intake/ClientFilesLayout.css";
import "./AudioPrepBrowser.css";

export type AudioPrepValidationFile = IntakeValidationFile & {
  originalDeliveryRelativePath?: string | null;
  original_delivery_relative_path?: string | null;
  originalFilename?: string | null;
  original_filename?: string | null;
  provenanceState?: "exact_content" | "ambiguous" | "unavailable" | string;
  provenance_state?: "exact_content" | "ambiguous" | "unavailable" | string;
};

type RenameState = { path: string; stem: string; error: string | null } | null;
type ValidationFilter = "all" | "attention" | "info" | "valid";
type ControlIconKind = "search" | "show" | "health" | "sort";
type StatusIconKind = "valid" | "attention" | "error" | "info" | "pending" | "none";

const actionErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The Audio Prep file action could not be completed.";

const missingWorkingAudioDirectory = (message: string | null) => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("no such file or directory")
    || normalized.includes("cannot find the path specified")
    || normalized.includes("(os error 2)")
    || normalized.includes("(os error 3)");
};

const filenameStem = (entry: ProjectFileEntry) => {
  if (!entry.extension) return entry.displayName;
  const suffix = `.${entry.extension}`;
  return entry.displayName.toLowerCase().endsWith(suffix.toLowerCase())
    ? entry.displayName.slice(0, -suffix.length)
    : entry.displayName;
};

const normalizedValidationPath = (record: AudioPrepValidationFile) =>
  (record.relativePath ?? record.relative_path ?? "").replace(/\\/g, "/").replace(/^\/+/, "");

const workingRelativePath = (entry: ProjectFileEntry) => {
  const prefix = `${projectFilePaths.audioPreparationWorking}/`;
  return entry.relativePath.startsWith(prefix)
    ? entry.relativePath.slice(prefix.length)
    : entry.relativePath === projectFilePaths.audioPreparationWorking
      ? ""
      : entry.relativePath;
};

const originalFilename = (record: AudioPrepValidationFile | undefined) =>
  record?.originalFilename ?? record?.original_filename ?? null;

const provenanceState = (record: AudioPrepValidationFile | undefined) =>
  record?.provenanceState ?? record?.provenance_state ?? null;

const matchesValidationFilter = (entry: ProjectFileEntry, record: AudioPrepValidationFile | undefined, filter: ValidationFilter, validationAvailable: boolean) => {
  if (!validationAvailable || filter === "all" || entry.entryType === "directory") return true;
  if (filter === "attention") return record?.status === "blocked" || record?.status === "needs_attention";
  if (filter === "info") return record?.status === "info";
  return record?.status === "valid";
};

const statusPresentation = (record: AudioPrepValidationFile | undefined, entry: ProjectFileEntry, validationAvailable: boolean) => {
  if (entry.entryType !== "file" || !entry.isAudio || record?.status === "not_applicable") {
    return { kind: "none" as StatusIconKind, symbol: "", label: "Not applicable" };
  }
  if (!validationAvailable) return { kind: "pending" as StatusIconKind, symbol: "·", label: "Validation not available" };
  if (!record) return { kind: "pending" as StatusIconKind, symbol: "·", label: "Checking" };
  if (record.status === "blocked") return { kind: "error" as StatusIconKind, symbol: "×", label: "Error" };
  if (record.status === "needs_attention") return { kind: "attention" as StatusIconKind, symbol: "!", label: "Needs attention" };
  if (record.status === "info") return { kind: "info" as StatusIconKind, symbol: "i", label: "Info" };
  if (record.status === "valid") return { kind: "valid" as StatusIconKind, symbol: "✓", label: "Valid" };
  return { kind: "pending" as StatusIconKind, symbol: "·", label: "Status unavailable" };
};

function ControlIcon({ kind }: { kind: ControlIconKind }) {
  if (kind === "search") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  if (kind === "show") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
  if (kind === "health") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3" /></svg>;
}

export function AudioPrepBrowser({
  clientId,
  projectId,
  validationAvailable = false,
  validationFiles = [],
  onValidationRefresh,
}: {
  clientId: string;
  projectId: string;
  validationAvailable?: boolean;
  validationFiles?: AudioPrepValidationFile[];
  onValidationRefresh?: () => void;
}) {
  const rootPath = projectFilePaths.audioPreparationWorking;
  const [relativePath, setRelativePath] = useState<string>(rootPath);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ProjectFileKindFilter>("all");
  const [sort, setSort] = useState<ProjectFileSort>("name");
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("all");
  const [renameState, setRenameState] = useState<RenameState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });
  const workingAreaNotCreated = relativePath === rootPath && state.status === "error" && missingWorkingAudioDirectory(state.message);

  const validationByPath = useMemo(() => new Map(
    validationFiles.map((record) => [normalizedValidationPath(record), record] as const).filter(([path]) => path !== ""),
  ), [validationFiles]);

  const listing = useMemo(() => {
    if (!state.listing) return null;
    const presented = presentProjectFileListing(state.listing, { query, kind, sort });
    return {
      ...presented,
      entries: presented.entries.filter((entry) => matchesValidationFilter(entry, validationByPath.get(workingRelativePath(entry)), validationFilter, validationAvailable)),
    };
  }, [state.listing, query, kind, sort, validationFilter, validationAvailable, validationByPath]);
  const visibleEntries = listing?.entries ?? [];
  const showTable = Boolean(listing) || workingAreaNotCreated;
  const canNavigateUp = canNavigateProjectFilesUp(relativePath, rootPath);

  const navigateTo = (path: string) => {
    setRelativePath(path);
    setQuery("");
    setRenameState(null);
    setActionError(null);
  };

  const refreshFilesAndValidation = async () => {
    await refresh();
    onValidationRefresh?.();
  };

  const beginRename = (entry: ProjectFileEntry) => {
    setActionError(null);
    setRenameState({ path: entry.relativePath, stem: filenameStem(entry), error: null });
  };

  const cancelRename = () => setRenameState(null);

  const saveRename = async (entry: ProjectFileEntry) => {
    if (!renameState || renameState.path !== entry.relativePath) return;
    setBusyPath(entry.relativePath);
    setRenameState((current) => current ? { ...current, error: null } : current);
    try {
      await renameAudioPrepFile({ clientId, projectId, relativePath: entry.relativePath }, renameState.stem);
      setRenameState(null);
      await refreshFilesAndValidation();
    } catch (error) {
      setRenameState((current) => current ? { ...current, error: actionErrorMessage(error) } : current);
    } finally {
      setBusyPath(null);
    }
  };

  const runAction = async (action: typeof openProjectFile | typeof revealProjectFile, entry: ProjectFileEntry) => {
    setActionError(null);
    try { await action({ clientId, projectId, relativePath: entry.relativePath }); }
    catch (error) { setActionError(actionErrorMessage(error)); }
  };

  const removeEntry = async (entry: ProjectFileEntry) => {
    if (!window.confirm(`Delete ${entry.displayName} from Audio Prep? This does not change Original Delivery.`)) return;
    setActionError(null);
    setBusyPath(entry.relativePath);
    try {
      await deleteAudioPrepFile({ clientId, projectId, relativePath: entry.relativePath });
      if (renameState?.path === entry.relativePath) setRenameState(null);
      await refreshFilesAndValidation();
    } catch (error) {
      setActionError(actionErrorMessage(error));
    } finally {
      setBusyPath(null);
    }
  };

  return <section className="client-files-browser audio-prep-browser" aria-label="Audio Prep working files">
    <div className="project-file-toolbar client-files-file-toolbar">
      <code>{relativePath}</code>
      <div className="directory-actions">
        <button type="button" className="secondary" disabled={!canNavigateUp || state.status === "loading"} onClick={() => navigateTo(projectFilePathUp(relativePath, rootPath))}>Up</button>
        <button type="button" className="secondary" disabled={state.status === "loading"} onClick={() => void refreshFilesAndValidation()}>{state.status === "loading" ? "Refreshing…" : "Refresh files"}</button>
      </div>
    </div>

    {(state.listing || workingAreaNotCreated) && <div className="project-file-controls client-files-controls" aria-label="Audio Prep file view controls">
      <label className="client-files-control" title="Search"><span className="client-files-control-icon"><ControlIcon kind="search" /></span><input aria-label="Search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder" /></label>
      <label className="client-files-control" title="Show file types"><span className="client-files-control-icon"><ControlIcon kind="show" /></span><select aria-label="Show file types" value={kind} onChange={(event) => setKind(event.target.value as ProjectFileKindFilter)}><option value="all">Everything</option><option value="audio">Audio</option><option value="files">Files</option><option value="folders">Folders</option></select></label>
      <label className="client-files-control audio-prep-validation-filter" title="Validation status"><span className="client-files-control-icon"><ControlIcon kind="health" /></span><select aria-label="Validation status" value={validationFilter} disabled={!validationAvailable} onChange={(event) => setValidationFilter(event.target.value as ValidationFilter)}><option value="all">All states</option><option value="attention">Needs attention</option><option value="info">Info</option><option value="valid">Valid</option></select></label>
      <label className="client-files-control" title="Sort"><span className="client-files-control-icon"><ControlIcon kind="sort" /></span><select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as ProjectFileSort)}><option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option></select></label>
    </div>}

    {state.status === "error" && !workingAreaNotCreated && <section className="notice error" role="alert"><strong>We couldn’t read Audio Prep</strong><span>{state.message}</span><button type="button" onClick={() => void refreshFilesAndValidation()}>Try again</button></section>}
    {actionError && <section className="notice error" role="alert"><strong>We couldn’t complete that file action</strong><span>{actionError}</span></section>}
    {state.status === "loading" && !state.listing && <div className="client-files-loading-inline" role="status" aria-label="Reading Audio Prep"><span className="client-files-spinner" aria-hidden="true" /></div>}

    {showTable && <><div className="table-scroll client-files-table audio-prep-table"><table><thead><tr><th className="client-file-status-heading"><span className="sr-only">Status</span></th><th>Filename</th><th>Original Filename</th><th>Preview</th><th>Audio Details</th><th>Modified</th></tr></thead><tbody>{visibleEntries.map((entry) => {
      const record = validationByPath.get(workingRelativePath(entry));
      const editing = renameState?.path === entry.relativePath;
      const busy = busyPath === entry.relativePath;
      const fileType = entry.entryType === "file" ? entry.extension?.replace(/^\./, "").toUpperCase() || "File" : "Folder";
      const hasActions = (entry.entryType === "file" && entry.permissions.canOpen) || entry.permissions.canReveal || entry.permissions.canRename || entry.permissions.canDelete;
      const status = statusPresentation(record, entry, validationAvailable);
      const findings = record?.findings ?? [];
      const statusLabel = findings.length > 0 ? `${status.label} — ${findings.length} ${findings.length === 1 ? "finding" : "findings"}` : status.label;
      const sourceName = originalFilename(record);
      const provenance = provenanceState(record);
      const provenanceTitle = sourceName
        ? `Original Delivery: ${sourceName}`
        : provenance === "ambiguous"
          ? "Multiple Original Delivery files have identical content; Automation will not guess the source."
          : "Authoritative Original Delivery provenance is not available for this working file.";
      return <tr key={entry.id} className={`${editing ? "audio-prep-row-editing " : ""}${record?.status ? `validation-${record.status}` : ""}`}>
        <td className="client-file-status-cell"><span className={`client-file-status-icon client-file-status-${status.kind}`} aria-label={statusLabel} title={statusLabel}>{status.symbol}</span></td>
        <td className="client-file-name-cell audio-prep-filename-cell">
          {entry.entryType === "directory" ? <button type="button" className="table-link" onClick={() => navigateTo(entry.relativePath)}>{entry.displayName}</button> : editing ? <div className="audio-prep-inline-rename"><div className="audio-prep-inline-input"><input autoFocus aria-label={`Rename ${entry.displayName}`} value={renameState.stem} disabled={busy} onChange={(event) => setRenameState({ ...renameState, stem: event.target.value, error: null })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveRename(entry); } else if (event.key === "Escape") { event.preventDefault(); cancelRename(); } }} /><span className="audio-prep-extension">{entry.extension ? `.${entry.extension}` : ""}</span></div>{renameState.error && <span className="audio-prep-rename-error" role="alert">{renameState.error}</span>}</div> : <button type="button" className="client-file-select audio-prep-name-button" onClick={() => beginRename(entry)} title="Rename filename">{entry.displayName}</button>}
        </td>
        <td className="audio-prep-origin-cell"><span title={provenanceTitle}>{sourceName ?? "—"}</span></td>
        <td className="client-file-preview-cell">{entry.playable ? <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} /> : <span className="client-file-preview-empty">—</span>}</td>
        <td className="client-file-audio-details"><span>{fileType}</span></td>
        <td className="client-file-modified-cell"><span>{formatClientFileModified(entry.modifiedEpochMs)}</span>{hasActions && <details className="client-file-action-menu"><summary aria-label={`Actions for ${entry.displayName}`} title="File actions">⋮</summary><div className="client-file-action-popover" role="menu">
          {entry.entryType === "file" && entry.permissions.canRename && <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); beginRename(entry); }}>Rename</button>}
          {entry.entryType === "file" && entry.permissions.canOpen && <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void runAction(openProjectFile, entry); }}>Open</button>}
          {entry.permissions.canReveal && <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void runAction(revealProjectFile, entry); }}>Reveal</button>}
          {entry.entryType === "file" && entry.permissions.canDelete && <button type="button" role="menuitem" className="danger" disabled={busy} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void removeEntry(entry); }}>Delete</button>}
        </div></details>}</td>
      </tr>;
    })}{visibleEntries.length === 0 && <tr><td colSpan={6}>{workingAreaNotCreated ? "No files in Working_Audio." : "No files match the current search or filters."}</td></tr>}</tbody></table></div><div className="client-file-status-legend audio-prep-status-note" aria-label="Validation status legend">{validationAvailable ? <><span><span className="client-file-status-icon client-file-status-valid" aria-hidden="true">✓</span>Valid</span><span><span className="client-file-status-icon client-file-status-attention" aria-hidden="true">!</span>Needs attention</span><span><span className="client-file-status-icon client-file-status-error" aria-hidden="true">×</span>Error</span><span><span className="client-file-status-icon client-file-status-info" aria-hidden="true">i</span>Info</span></> : <span><span className="client-file-status-icon client-file-status-pending" aria-hidden="true">·</span>Validation status requires newer Automation support</span>}</div></>}
  </section>;
}
