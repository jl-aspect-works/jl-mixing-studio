import { useEffect, useMemo, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import { FileStatusIcon, FileStatusLegend, FileViewControls, ManagedFolderToolbar, RowActionMenu, type FileStatusKind } from "../project/files/FileUiPrimitives";
import type { ProjectFileEntry } from "../project/files/projectFileService";
import {
  openProjectFile,
  projectFilePaths,
  revealProjectFile,
} from "../project/files/projectFileService";
import { canNavigateProjectFilesUp, projectFilePathUp } from "../project/files/projectFileNavigation";
import {
  presentProjectFileListing,
  type ProjectFileKindFilter,
  type ProjectFileSort,
} from "../project/files/projectFilePresentation";
import { useProjectFiles } from "../project/files/useProjectFiles";
import "./ClientFilesBrowser.css";

export type IntakeValidationFinding = {
  code: string;
  severity: "critical" | "warning" | "info" | string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  relatedPaths?: string[];
  related_paths?: string[];
};

export type IntakeValidationMetadata = {
  sampleRate?: number | null;
  sample_rate?: number | null;
  bitDepth?: number | null;
  bit_depth?: number | null;
  channels?: number | null;
  duration?: number | null;
  codecName?: string | null;
  codec_name?: string | null;
  formatName?: string | null;
  format_name?: string | null;
};

export type IntakeValidationFile = {
  relativePath?: string;
  relative_path?: string;
  isAudio?: boolean;
  is_audio?: boolean;
  sha256?: string | null;
  metadata?: IntakeValidationMetadata | null;
  decodeOk?: boolean | null;
  decode_ok?: boolean | null;
  dualMono?: boolean | null;
  dual_mono?: boolean | null;
  findings?: IntakeValidationFinding[];
  cacheState?: "validated" | "reused" | string;
  cache_state?: "validated" | "reused" | string;
  status?: "valid" | "needs_attention" | "blocked" | "info" | "not_applicable" | string;
};

export type ClientFilesSelection = {
  entry: ProjectFileEntry;
  validation: IntakeValidationFile | null;
};

type ValidationFilter = "all" | "attention" | "info" | "valid";

const normalizedValidationPath = (record: IntakeValidationFile) =>
  (record.relativePath ?? record.relative_path ?? "").replace(/\\/g, "/").replace(/^\/+/, "");

const sourceRelativePath = (entry: ProjectFileEntry) => {
  const prefix = `${projectFilePaths.originalDelivery}/`;
  return entry.relativePath.startsWith(prefix)
    ? entry.relativePath.slice(prefix.length)
    : entry.relativePath === projectFilePaths.originalDelivery
      ? ""
      : entry.relativePath;
};

export const intakeMetadataValue = <T,>(metadata: IntakeValidationMetadata | null | undefined, camel: keyof IntakeValidationMetadata, snake: keyof IntakeValidationMetadata) =>
  (metadata?.[camel] ?? metadata?.[snake]) as T | null | undefined;

export const intakeStatusLabel = (record: IntakeValidationFile | undefined | null, entry: ProjectFileEntry) => {
  if (entry.entryType !== "file") return "—";
  if (!entry.isAudio) return "Not applicable";
  if (!record) return "Checking…";
  if (record.status === "blocked") return "Blocked";
  if (record.status === "needs_attention") return "Needs attention";
  if (record.status === "info") return "Info";
  if (record.status === "not_applicable") return "Not applicable";
  if (record.status === "valid") return "Valid";
  return "Unknown";
};

const statusIconPresentation = (record: IntakeValidationFile | undefined | null, entry: ProjectFileEntry): { kind: FileStatusKind; label: string } => {
  if (entry.entryType !== "file" || !entry.isAudio || record?.status === "not_applicable") return { kind: "none", label: "Not applicable" };
  if (!record) return { kind: "pending", label: "Checking" };
  if (record.status === "blocked") return { kind: "error", label: "Error" };
  if (record.status === "needs_attention") return { kind: "attention", label: "Needs attention" };
  if (record.status === "info") return { kind: "info", label: "Info" };
  if (record.status === "valid") return { kind: "valid", label: "Valid" };
  return { kind: "pending", label: "Status unavailable" };
};

const matchesValidationFilter = (entry: ProjectFileEntry, record: IntakeValidationFile | undefined, filter: ValidationFilter) => {
  if (filter === "all" || entry.entryType === "directory") return true;
  if (filter === "attention") return record?.status === "blocked" || record?.status === "needs_attention";
  if (filter === "info") return record?.status === "info";
  return record?.status === "valid";
};

export const formatIntakeDuration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

export const formatClientFileModified = (epochMs: number | null | undefined) => {
  if (epochMs === null || epochMs === undefined || !Number.isFinite(epochMs)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(epochMs));
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

const actionErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The project file action could not be completed.";

export function ClientFilesBrowser({ clientId, projectId, validationFiles = [], selectedPath = null, onSelectionChange }: {
  clientId: string;
  projectId: string;
  validationFiles?: IntakeValidationFile[];
  selectedPath?: string | null;
  onSelectionChange?: (selection: ClientFilesSelection | null) => void;
}) {
  const rootPath = projectFilePaths.originalDelivery;
  const [relativePath, setRelativePath] = useState<string>(rootPath);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ProjectFileKindFilter>("all");
  const [sort, setSort] = useState<ProjectFileSort>("name");
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const { state, refresh } = useProjectFiles({ clientId, projectId, relativePath });

  useEffect(() => {
    setRelativePath(rootPath);
    setQuery("");
    setKind("all");
    setSort("name");
    setValidationFilter("all");
    setActionError(null);
    onSelectionChange?.(null);
  }, [clientId, projectId, rootPath]);

  const validationByPath = useMemo(() => new Map(
    validationFiles.map((record) => [normalizedValidationPath(record), record] as const).filter(([path]) => path !== ""),
  ), [validationFiles]);

  const listing = useMemo(() => {
    if (!state.listing) return null;
    const presented = presentProjectFileListing(state.listing, { query, kind, sort });
    return { ...presented, entries: presented.entries.filter((entry) => matchesValidationFilter(entry, validationByPath.get(sourceRelativePath(entry)), validationFilter)) };
  }, [state.listing, query, kind, sort, validationFilter, validationByPath]);

  const navigateTo = (path: string) => {
    setRelativePath(path);
    setQuery("");
    setActionError(null);
    onSelectionChange?.(null);
  };

  const selectEntry = (entry: ProjectFileEntry) => {
    if (entry.entryType !== "file") return;
    onSelectionChange?.({ entry, validation: validationByPath.get(sourceRelativePath(entry)) ?? null });
  };

  const canNavigateUp = canNavigateProjectFilesUp(relativePath, rootPath);
  const runAction = async (action: typeof openProjectFile | typeof revealProjectFile, entry: ProjectFileEntry) => {
    setActionError(null);
    try { await action({ clientId, projectId, relativePath: entry.relativePath }); }
    catch (error) { setActionError(actionErrorMessage(error)); }
  };

  return <section className="client-files-browser" aria-label="Original Delivery files">
    <ManagedFolderToolbar
      path={relativePath}
      canNavigateUp={canNavigateUp}
      loading={state.status === "loading"}
      onUp={() => navigateTo(projectFilePathUp(relativePath, rootPath))}
      onRefresh={() => void refresh()}
      refreshLabel="Refresh files"
    />

    {state.listing && <FileViewControls
      label="Client file view controls"
      controls={[
        { icon: "search", label: "Search", control: <input aria-label="Search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder" /> },
        { icon: "show", label: "Show file types", control: <select aria-label="Show file types" value={kind} onChange={(event) => setKind(event.target.value as ProjectFileKindFilter)}><option value="all">Everything</option><option value="audio">Audio</option><option value="files">Files</option><option value="folders">Folders</option></select> },
        { icon: "health", label: "Filter by validation", control: <select aria-label="Filter by validation" value={validationFilter} onChange={(event) => setValidationFilter(event.target.value as ValidationFilter)}><option value="all">All states</option><option value="attention">Needs attention</option><option value="info">Info</option><option value="valid">Valid</option></select> },
        { icon: "sort", label: "Sort", control: <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as ProjectFileSort)}><option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option></select> },
      ]}
    />}

    {state.status === "error" && <section className="notice error" role="alert"><strong>We couldn’t read Original Delivery</strong><span>{state.message}</span><button type="button" onClick={() => void refresh()}>Try again</button></section>}
    {actionError && <section className="notice error" role="alert"><strong>We couldn’t complete that file action</strong><span>{actionError}</span></section>}
    {state.status === "loading" && !state.listing && <div className="client-files-loading-inline" role="status" aria-label="Reading Original Delivery"><span className="client-files-spinner" aria-hidden="true" /></div>}

    {listing && <>
      <div className="table-scroll client-files-table"><table><thead><tr><th className="client-file-status-heading" aria-label="Status" /><th>Name</th><th>Preview</th><th>Audio Details</th><th>Modified</th></tr></thead><tbody>{listing.entries.map((entry) => {
        const record = validationByPath.get(sourceRelativePath(entry));
        const metadata = record?.metadata;
        const sampleRate = intakeMetadataValue<number>(metadata, "sampleRate", "sample_rate");
        const bitDepth = intakeMetadataValue<number>(metadata, "bitDepth", "bit_depth");
        const channels = intakeMetadataValue<number>(metadata, "channels", "channels");
        const duration = intakeMetadataValue<number>(metadata, "duration", "duration");
        const codec = intakeMetadataValue<string>(metadata, "codecName", "codec_name");
        const format = intakeMetadataValue<string>(metadata, "formatName", "format_name");
        const decodeOk = record?.decodeOk ?? record?.decode_ok;
        const dualMono = record?.dualMono ?? record?.dual_mono;
        const cacheState = record?.cacheState ?? record?.cache_state;
        const findings = record?.findings ?? [];
        const fileType = entry.entryType === "file" ? entry.extension?.replace(/^\./, "").toUpperCase() || "File" : "Folder";
        const audioDetails = entry.isAudio ? [fileType, formatIntakeDuration(duration), sampleRate ? `${(sampleRate / 1000).toLocaleString()}kHz` : null, bitDepth ? `${bitDepth}-bit` : null, channels ? `${channels}ch` : null].filter(Boolean) : [fileType];
        const status = statusIconPresentation(record, entry);
        const statusLabel = findings.length > 0 ? `${status.label} — ${findings.length} ${findings.length === 1 ? "finding" : "findings"}` : status.label;
        const actions = [
          entry.entryType === "file" && entry.permissions.canOpen ? { label: "Open", onSelect: () => void runAction(openProjectFile, entry) } : null,
          entry.permissions.canReveal ? { label: "Reveal", onSelect: () => void runAction(revealProjectFile, entry) } : null,
        ].filter((action): action is NonNullable<typeof action> => action !== null);
        const validationDetails = record && entry.entryType === "file" ? <details className="client-file-menu-validation"><summary>Validation details</summary><div className="validation-details-content">
          {(codec || format || cacheState) && <p>{codec && <>Codec: <strong>{codec}</strong></>}{codec && (format || cacheState) ? " · " : ""}{format && <>Format: <strong>{format}</strong></>}{format && cacheState ? " · " : ""}{cacheState && <>Cache: <strong>{cacheState}</strong></>}</p>}
          {(decodeOk !== null && decodeOk !== undefined) && <p>Decode integrity: <strong>{decodeOk ? "Passed" : "Failed"}</strong></p>}
          {dualMono === true && <p>Channels: <strong>Exact dual mono</strong></p>}
          {record.sha256 && <p className="validation-hash">SHA-256: <code>{record.sha256}</code></p>}
          {findings.length > 0 ? <ul>{findings.map((finding, index) => { const related = finding.relatedPaths ?? finding.related_paths ?? []; const expected = displayValue(finding.expected); const actual = displayValue(finding.actual); return <li key={`${finding.code}-${index}`}><strong>{finding.message}</strong>{(expected || actual) && <span>{expected && <> Expected: {expected}.</>}{actual && <> Actual: {actual}.</>}</span>}{related.length > 0 && <span> Related: {related.join(", ")}.</span>}</li>; })}</ul> : <p>No findings.</p>}
        </div></details> : undefined;
        return <tr key={entry.id} className={`${record?.status ? `validation-${record.status}` : ""}${selectedPath === entry.relativePath ? " client-file-selected" : ""}`}>
          <td className="client-file-status-cell"><FileStatusIcon kind={status.kind} label={statusLabel} /></td>
          <td className="client-file-name-cell">
            {entry.entryType === "directory" ? <button type="button" className="table-link" onClick={() => navigateTo(entry.relativePath)}>{entry.displayName}</button> : <button type="button" className="client-file-select" aria-pressed={selectedPath === entry.relativePath} onClick={() => selectEntry(entry)}>{entry.displayName}</button>}
          </td>
          <td className="client-file-preview-cell">{entry.playable ? <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} durationSeconds={duration} /> : <span className="client-file-preview-empty">—</span>}</td>
          <td className="client-file-audio-details">{audioDetails.map((detail, index) => <span key={`${detail}-${index}`}>{detail}</span>)}</td>
          <td className="client-file-modified-cell"><span>{formatClientFileModified(entry.modifiedEpochMs)}</span><RowActionMenu label={`Actions for ${entry.displayName}`} actions={actions} extraContent={validationDetails} /></td>
        </tr>;
      })}{listing.entries.length === 0 && <tr><td colSpan={5}>No files match the current search or filters.</td></tr>}</tbody></table></div>
      <FileStatusLegend
        label="Validation status legend"
        items={[
          { kind: "valid", label: "Valid" },
          { kind: "attention", label: "Needs attention" },
          { kind: "error", label: "Error" },
          { kind: "info", label: "Info" },
        ]}
      />
    </>}
  </section>;
}
