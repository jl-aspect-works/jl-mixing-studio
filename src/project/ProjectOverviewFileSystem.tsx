import { useEffect, useMemo, useState } from "react";
import {
  formatProjectFileSize,
  listProjectFiles,
  projectFilePaths,
  type ProjectFileEntry,
} from "./files/projectFileService";

type FolderSummary = {
  label: string;
  relativePath: string;
  fileCount: number;
  sizeBytes: number;
  status: "loading" | "ready" | "error";
};

const overviewFolders = [
  { label: "01_Client_Files", relativePath: "01_Client_Files" },
  { label: "02_Audio_Preparation", relativePath: projectFilePaths.audioPreparation },
  { label: "03_DAW_Project", relativePath: projectFilePaths.dawProject },
  { label: "04_Revisions", relativePath: projectFilePaths.revisions },
  { label: "05_Final_Delivery", relativePath: projectFilePaths.finalDelivery },
  { label: "06_Recall", relativePath: projectFilePaths.recall },
] as const;

const emptyRows = (): FolderSummary[] => overviewFolders.map((folder) => ({
  ...folder,
  fileCount: 0,
  sizeBytes: 0,
  status: "loading",
}));

const summarizeListing = async (
  clientId: string,
  projectId: string,
  relativePath: string,
  visited: Set<string>,
  depth = 0,
): Promise<{ fileCount: number; sizeBytes: number }> => {
  if (depth > 16 || visited.has(relativePath)) return { fileCount: 0, sizeBytes: 0 };
  visited.add(relativePath);

  const listing = await listProjectFiles({ clientId, projectId, relativePath });
  let fileCount = 0;
  let sizeBytes = 0;
  const directories: ProjectFileEntry[] = [];

  for (const entry of listing.entries) {
    if (entry.entryType === "file") {
      fileCount += 1;
      sizeBytes += entry.sizeBytes ?? 0;
    } else if (entry.entryType === "directory") {
      directories.push(entry);
    }
  }

  const nested = await Promise.all(directories.map((entry) =>
    summarizeListing(clientId, projectId, entry.relativePath, visited, depth + 1),
  ));
  for (const summary of nested) {
    fileCount += summary.fileCount;
    sizeBytes += summary.sizeBytes;
  }

  return { fileCount, sizeBytes };
};

export function ProjectOverviewFileSystem({ clientId, projectId }: { clientId: string; projectId: string }) {
  const [rows, setRows] = useState<FolderSummary[]>(emptyRows);

  useEffect(() => {
    let cancelled = false;
    setRows(emptyRows());

    Promise.all(overviewFolders.map(async (folder): Promise<FolderSummary> => {
      try {
        const summary = await summarizeListing(clientId, projectId, folder.relativePath, new Set<string>());
        return { ...folder, ...summary, status: "ready" };
      } catch {
        return { ...folder, fileCount: 0, sizeBytes: 0, status: "error" };
      }
    })).then((nextRows) => {
      if (!cancelled) setRows(nextRows);
    });

    return () => { cancelled = true; };
  }, [clientId, projectId]);

  const totals = useMemo(() => rows.reduce((total, row) => row.status === "ready"
    ? { fileCount: total.fileCount + row.fileCount, sizeBytes: total.sizeBytes + row.sizeBytes }
    : total, { fileCount: 0, sizeBytes: 0 }), [rows]);
  const loading = rows.some((row) => row.status === "loading");
  const partial = rows.some((row) => row.status === "error");

  return (
    <section className="overview-card overview-filesystem-card" aria-labelledby="overview-filesystem-heading">
      <div className="overview-card-heading">
        <div><h2 id="overview-filesystem-heading">Project File System</h2><p>High-level project storage orientation</p></div>
        <span className="overview-index-pill">{loading ? "Indexing…" : partial ? "Partial index" : "Indexed"}</span>
      </div>
      <div className="overview-storage-summary">
        <div className="overview-storage-ring" aria-hidden="true"><strong>{loading ? "…" : totals.fileCount}</strong><span>{loading ? "indexing" : `${formatProjectFileSize(totals.sizeBytes)} total`}</span></div>
        <div className="overview-folder-list">{rows.map((row) => <div key={row.label}><code>{row.label}</code><span>{row.status === "loading" ? "Loading…" : row.status === "error" ? "Unavailable" : `${row.fileCount} files · ${formatProjectFileSize(row.sizeBytes)}`}</span></div>)}</div>
      </div>
      <p className="overview-index-note">Counts and sizes come from the validated shared project file service. Symlinks and unsupported entries are not traversed.</p>
    </section>
  );
}
