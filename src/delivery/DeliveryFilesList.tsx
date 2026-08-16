import { useEffect, useMemo, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import {
  listProjectFiles,
  openProjectFile,
  projectFilePaths,
  revealProjectFile,
  type ProjectFileEntry,
} from "../project/files/projectFileService";
import type { ManagedDeliverableStatus } from "./statusModels";
import "../intake/ClientFilesBrowser.css";

const formatBytes = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  if (value < 1024) return `${value.toLocaleString()} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[index]}`;
};

const titleCase = (value: string | null | undefined) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";

const fileName = (path: string) => {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
};

const statusPresentation = (file: ManagedDeliverableStatus) => {
  switch (file.status) {
    case "current": return { kind: "valid", symbol: "✓", label: "Verified" };
    case "missing": return { kind: "error", symbol: "×", label: "Missing" };
    case "mismatch": return { kind: "attention", symbol: "!", label: "Changed" };
    case "unsafe": return { kind: "error", symbol: "×", label: "Unsafe" };
    case "unavailable": return { kind: "pending", symbol: "·", label: "Unavailable" };
    default: return { kind: "pending", symbol: "·", label: titleCase(file.status) };
  }
};

type ControlIconKind = "search" | "health" | "sort";

function ControlIcon({ kind }: { kind: ControlIconKind }) {
  if (kind === "search") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  if (kind === "health") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3" /></svg>;
}

const fullRelativePath = (path: string) => `${projectFilePaths.finalDelivery}/${path}`;

export function DeliveryFilesList({
  clientId,
  projectId,
  files,
  sourceRevision,
}: {
  clientId: string;
  projectId: string;
  files: ManagedDeliverableStatus[];
  sourceRevision: number | null;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<"filename" | "type" | "status">("filename");
  const [entries, setEntries] = useState<Map<string, ProjectFileEntry>>(new Map());
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parents = [...new Set(files.map((file) => {
      const full = fullRelativePath(file.path);
      const separator = full.lastIndexOf("/");
      return separator < 0 ? "" : full.slice(0, separator);
    }))];
    void Promise.all(parents.map(async (relativePath) => {
      try {
        return await listProjectFiles({ clientId, projectId, relativePath });
      } catch {
        return null;
      }
    })).then((listings) => {
      if (cancelled) return;
      const next = new Map<string, ProjectFileEntry>();
      for (const listing of listings) {
        for (const entry of listing?.entries ?? []) next.set(entry.relativePath, entry);
      }
      setEntries(next);
    });
    return () => { cancelled = true; };
  }, [clientId, projectId, files]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return files
      .filter((file) => statusFilter === "all" || file.status === statusFilter)
      .filter((file) => !normalized || file.path.toLocaleLowerCase().includes(normalized) || (file.deliverableType ?? "").toLocaleLowerCase().includes(normalized))
      .slice()
      .sort((left, right) => {
        if (sort === "type") return (left.deliverableType ?? "").localeCompare(right.deliverableType ?? "") || left.path.localeCompare(right.path);
        if (sort === "status") return left.status.localeCompare(right.status) || left.path.localeCompare(right.path);
        return left.path.localeCompare(right.path);
      });
  }, [files, query, sort, statusFilter]);

  const totalBytes = files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);

  const runFileAction = async (action: "open" | "reveal", entry: ProjectFileEntry) => {
    setActionMessage(null);
    const request = { clientId, projectId, relativePath: entry.relativePath };
    try {
      if (action === "open") await openProjectFile(request);
      else await revealProjectFile(request);
    } catch (error: unknown) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return <section className="panel delivery-files-panel" aria-labelledby="delivery-files-heading">
    <div className="panel-heading delivery-files-heading">
      <div><p className="kicker">Deliverables</p><h2 id="delivery-files-heading">Delivery Files</h2></div>
      <span>{files.length} files · {formatBytes(totalBytes)}</span>
    </div>
    {files.length > 0 && <div className="project-file-controls client-files-controls delivery-files-toolbar" aria-label="Delivery file view controls">
      <label className="client-files-control" title="Search"><span className="client-files-control-icon"><ControlIcon kind="search" /></span><input aria-label="Search" type="search" placeholder="Search delivery files" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="client-files-control" title="Status"><span className="client-files-control-icon"><ControlIcon kind="health" /></span><select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All states</option><option value="current">Verified</option><option value="mismatch">Changed</option><option value="missing">Missing</option><option value="unsafe">Unsafe</option><option value="unavailable">Unavailable</option></select></label>
      <label className="client-files-control" title="Sort"><span className="client-files-control-icon"><ControlIcon kind="sort" /></span><select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as "filename" | "type" | "status")}><option value="filename">Filename</option><option value="type">Type</option><option value="status">Status</option></select></label>
    </div>}
    {actionMessage && <p className="delivery-inline-message" role="alert">{actionMessage}</p>}
    {files.length === 0 ? <div className="delivery-empty-inline"><span>No managed deliverables have been created yet.</span></div> : filtered.length === 0 ? <div className="delivery-empty-inline"><span>No delivery files match the current search/filter.</span></div> : <div className="table-scroll client-files-table delivery-files-table">
      <table>
        <thead><tr><th className="client-file-status-heading" aria-label="Status" /><th>Filename</th><th>Type</th><th>Source</th><th>Preview</th><th>Size</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{filtered.map((file) => {
          const entry = entries.get(fullRelativePath(file.path));
          const status = statusPresentation(file);
          const hasActions = Boolean(entry && ((entry.permissions.canOpen && file.status !== "missing") || (entry.permissions.canReveal && file.status !== "missing")));
          return <tr key={file.path} className={`delivery-file-${file.status}`}>
            <td className="client-file-status-cell"><span className={`client-file-status-icon client-file-status-${status.kind}`} aria-label={status.label} title={status.label}>{status.symbol}</span></td>
            <td className="delivery-file-name-cell"><strong>{fileName(file.path)}</strong>{file.path.includes("/") && <small>{file.path}</small>}</td>
            <td>{titleCase(file.deliverableType)}</td>
            <td>{sourceRevision ? `Rev ${sourceRevision.toString().padStart(2, "0")}` : "—"}</td>
            <td className="delivery-preview-cell">{entry?.playable && file.status === "current" ? <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} /> : <span className="delivery-preview-unavailable">—</span>}</td>
            <td>{formatBytes(file.sizeBytes)}</td>
            <td className="client-file-actions-cell">{hasActions && entry && <details className="client-file-action-menu"><summary aria-label={`Actions for ${entry.displayName}`} title="File actions">⋮</summary><div className="client-file-action-popover" role="menu">
              {entry.permissions.canOpen && file.status !== "missing" && <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void runFileAction("open", entry); }}>Open</button>}
              {entry.permissions.canReveal && file.status !== "missing" && <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void runFileAction("reveal", entry); }}>Reveal</button>}
            </div></details>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    {files.length > 0 && <div className="client-file-status-legend delivery-status-legend" aria-label="Delivery file status legend"><span><span className="client-file-status-icon client-file-status-valid" aria-hidden="true">✓</span>Verified</span><span><span className="client-file-status-icon client-file-status-attention" aria-hidden="true">!</span>Changed</span><span><span className="client-file-status-icon client-file-status-error" aria-hidden="true">×</span>Missing / unsafe</span><span><span className="client-file-status-icon client-file-status-pending" aria-hidden="true">·</span>Unavailable</span></div>}
  </section>;
}
