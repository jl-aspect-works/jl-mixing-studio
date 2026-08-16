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

const fileName = (path: string) => path.split("/").at(-1) ?? path;

const statusLabel = (file: ManagedDeliverableStatus) => {
  switch (file.status) {
    case "current": return "Verified";
    case "missing": return "Missing";
    case "mismatch": return "Changed";
    case "unsafe": return "Unsafe";
    case "unavailable": return "Unavailable";
    default: return titleCase(file.status);
  }
};

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
      .toSorted((left, right) => {
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
    {files.length > 0 && <div className="delivery-files-toolbar">
      <label>
        <span className="sr-only">Search delivery files</span>
        <input type="search" placeholder="Search delivery files" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label>
        <span className="sr-only">Filter delivery files by status</span>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="current">Verified</option>
          <option value="mismatch">Changed</option>
          <option value="missing">Missing</option>
          <option value="unsafe">Unsafe</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Sort delivery files</span>
        <select value={sort} onChange={(event) => setSort(event.target.value as "filename" | "type" | "status")}>
          <option value="filename">Filename</option>
          <option value="type">Type</option>
          <option value="status">Status</option>
        </select>
      </label>
    </div>}
    {actionMessage && <p className="delivery-inline-message" role="alert">{actionMessage}</p>}
    {files.length === 0 ? <div className="delivery-empty-inline"><span>No managed deliverables have been created yet.</span></div> : filtered.length === 0 ? <div className="delivery-empty-inline"><span>No delivery files match the current search/filter.</span></div> : <div className="table-scroll">
      <table className="delivery-files-table">
        <thead><tr><th>Filename</th><th>Type</th><th>Source</th><th>Size</th><th>Status</th><th>Preview</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{filtered.map((file) => {
          const entry = entries.get(fullRelativePath(file.path));
          return <tr key={file.path} className={`delivery-file-${file.status}`}>
            <td><strong>{fileName(file.path)}</strong>{file.path.includes("/") && <small>{file.path}</small>}</td>
            <td>{titleCase(file.deliverableType)}</td>
            <td>{sourceRevision ? `Rev ${sourceRevision.toString().padStart(2, "0")}` : "—"}</td>
            <td>{formatBytes(file.sizeBytes)}</td>
            <td><span className={`delivery-file-status delivery-file-status-${file.status}`}>{statusLabel(file)}</span></td>
            <td className="delivery-preview-cell">{entry?.playable && file.status === "current"
              ? <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={entry} />
              : <span className="delivery-preview-unavailable">—</span>}</td>
            <td className="delivery-row-actions">{entry && <>
              <button type="button" className="secondary" disabled={!entry.permissions.canOpen || file.status === "missing"} onClick={() => void runFileAction("open", entry)}>Open</button>
              <button type="button" className="secondary" disabled={!entry.permissions.canReveal || file.status === "missing"} onClick={() => void runFileAction("reveal", entry)}>Reveal</button>
            </>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}
