import { useMemo, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import { FileStatusIcon, FileStatusLegend, FileViewControls, ManagedFolderToolbar, RowActionMenu, type FileStatusKind } from "../project/files/FileUiPrimitives";
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
import { type IntakeValidationFile } from "../intake/ClientFilesBrowser";
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

const formatAudioPrepModified = (epochMs: number | null | undefined) => {
  if (epochMs === null || epochMs === undefined || !Number.isFinite(epochMs)) return "—";
  const date = new Date(epochMs);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hour24 >= 12 ? "pm" : "am";
  return `${month}/${day}/${year} ${String(hour12).padStart(2, "0")}:${minute}${meridiem}`;
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

const provenanceLabel = (sourceName: string | null, provenance: string | null) => {
  if (sourceName) return sourceName;
  if (provenance === "ambiguous") return "Ambiguous";
  if (provenance === "unavailable") return "Not matched";
  return "—";
};

const matchesValidationFilter = (entry: ProjectFileEntry, record: AudioPrepValidationFile | undefined, filter: ValidationFilter, validationAvailable: boolean) => {
  if (!validationAvailable || filter === "all" || entry.entryType === "directory") return true;
  if (filter === "attention") return record?.status === "blocked" || record?.status === "needs_attention";
  if (filter === "info") return record?.status === "info";
  return record?.status === "valid";
};

const statusPresentation = (record: AudioPrepValidationFile | undefined, entry: ProjectFileEntry, validationAvailable: boolean): { kind: FileStatusKind; label: string } => {
  if (entry.entryType !== "file" || !entry.isAudio || record?.status === "not_applicable") return { kind: "none", label: "Not applicable" };
  if (!validationAvailable) return { kind: "pending", label: "Validation not available" };
  if (!record) return { kind: "pending", label: "Checking" };
  if (record.status === "blocked") return { kind: "error", label: "Error" };
  if (record.status === "needs_attention") return { kind: "attention", label: "Needs attention" };
  if (record.status === "info") return { kind: "info", label: "Info" };
  if (record.status === "valid") return { kind: "valid", label: "Valid" };
  return { kind: "pending", label: "Status unavailable" };
};

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
      await refreshFilesAndValidation();
      setRenameState(null);
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
    <ManagedFolderToolbar
      path={relativePath}
      canNavigateUp={canNavigateUp}
      loading={state.status === "loading"}
      onUp={() => navigateTo(projectFilePathUp(relativePath, rootPath))}
      onRefresh={() => void refreshFilesAndValidation()}
      refreshLabel="Refresh files"
    />

    {(state.listing || workingAreaNotCreated) && <FileViewControls
      label="Audio Prep file view controls"
      controls={[
        { icon: "search", label: "Search", control: <input aria-label="Search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder" /> },
        { icon: "show", label: "Show file types", control: <select aria-label="Show file types" value={kind} onChange={(event) => setKind(event.target.value as ProjectFileKindFilter)}><option value="all">Everything</option><option value="audio">Audio</option><option value="files">Files</option><option value="folders">Folders</option></select> },
        { icon: "health", label: "Validation status", control: <select aria-label="Validation status" value={validationFilter} disabled={!validationAvailable} onChange={(event) => setValidationFilter(event.target.value as ValidationFilter)}><option value="all">All states</option><option value="attention">Needs attention</option><option value="info">Info</option><option value="valid">Valid</option></select> },
        { icon: "sort", label: "Sort", control: <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as ProjectFileSort)}><option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option></select> },
      ]}
    />}

    {state.status === "error" && !workingAreaNotCreated && <section className="notice error" role="alert"><strong>We couldn’t read Audio Prep</strong><span>{state.message}</span><button type="button" onClick={() => void refreshFilesAndValidation()}>Try again</button></section>}
    {actionError && <section className="notice error" role="alert"><strong>We couldn’t complete that file action</strong><span>{actionError}</span></section>}
    {state.status === "loading" && !state.listing && <div className="client-files-loading-inline" role="status" aria-label="Reading Audio Prep"><span className="client-files-spinner" aria-hidden="true" /></div>}

    {showTable && <>
      <div className="table-scroll client-files-table audio-prep-table"><table><thead><tr><th className="client-file-status-heading" aria-label="Status" /><th>Filename</th><th>Original Filename</th><th>Preview</th><th>Audio Details</th><th>Modified</th></tr></thead><tbody>{visibleEntries.map((entry) => {
        const record = validationByPath.get(workingRelativePath(entry));
        const editing = renameState?.path === entry.relativePath;
        const busy = busyPath === entry.relativePath;
        const fileType = entry.entryType === "file" ? entry.extension?.replace(/^\./, "").toUpperCase() || "File" : "Folder";
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
        const sourceLabel = provenanceLabel(sourceName, provenance);
        const actions = [
          entry.entryType === "file" && entry.permissions.canRename ? { label: "Rename", onSelect: () => beginRename(entry) } : null,
          entry.entryType === "file" && entry.permissions.canOpen ? { label: "Open", onSelect: () => void runAction(openProjectFile, entry) } : null,
          entry.permissions.canReveal ? { label: "Reveal", onSelect: () => void runAction(revealProjectFile, entry) } : null,
          entry.entryType === "file" && entry.permissions.canDelete ? { label: "Delete", onSelect: () => void removeEntry(entry), disabled: busy, destructive: true } : null,
        ].filter((action): action is NonNullable<typeof action> => action !== null);
        return <tr key={entry.id} className={`${editing ? "audio-prep-row-editing " : ""}${record?.status ? `validation-${record.status}` : ""}`}>
          <td className="client-file-status-cell"><FileStatusIcon kind={status.kind} label={statusLabel} /></td>
          <td className="client-file-name-cell audio-prep-filename-cell">
            {entry.entryType === "directory" ? <button type="button" className="table-link" onClick={() => navigateTo(entry.relativePath)}>{entry.displayName}</button> : editing ? <div className="audio-prep-inline-rename"><div className="audio-prep-inline-input"><input autoFocus aria-label={`Rename ${entry.displayName}`} value={renameState.stem} disabled={busy} onChange={(event) => setRenameState({ ...renameState, stem: event.target.value, error: null })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveRename(entry); } else if (event.key === "Escape" && !busy) { event.preventDefault(); cancelRename(); } }} /><span className="audio-prep-extension">{entry.extension ? `.${entry.extension}` : ""}</span></div>{renameState.error && <span className="audio-prep-rename-error" role="alert">{renameState.error}</span>}</div> : <button type="button" className="client-file-select audio-prep-name-button" onClick={() => beginRename(entry)} title="Rename filename">{entry.displayName}</button>}
          </td>
          <td className="audio-prep-origin-cell"><span title={provenanceTitle}>{sourceLabel}</span></td>
          <td className="client-file-preview-cell">{entry.playable ? <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} /> : <span className="client-file-preview-empty">—</span>}</td>
          <td className="client-file-audio-details"><span>{fileType}</span></td>
          <td className="client-file-modified-cell"><span>{formatAudioPrepModified(entry.modifiedEpochMs)}</span><RowActionMenu label={`Actions for ${entry.displayName}`} actions={actions} /></td>
        </tr>;
      })}{visibleEntries.length === 0 && <tr><td colSpan={6}>{workingAreaNotCreated ? "No files in Working_Audio." : "No files match the current search or filters."}</td></tr>}</tbody></table></div>
      <FileStatusLegend
        label="Validation status legend"
        className="audio-prep-status-note"
        items={validationAvailable ? [
          { kind: "valid", label: "Valid" },
          { kind: "attention", label: "Needs attention" },
          { kind: "error", label: "Error" },
          { kind: "info", label: "Info" },
        ] : [{ kind: "pending", label: "Validation status requires newer Automation support" }]}
      />
    </>}
  </section>;
}