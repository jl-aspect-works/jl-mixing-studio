import { formatProjectFileSize } from "./files/projectFileService";
import type { ProjectOverviewFileIndex, ProjectOverviewFolderKey } from "./ProjectOverviewFileIndex";

const overviewFolders: Array<{ label: string; key: ProjectOverviewFolderKey; color: string }> = [
  { label: "01_Client_Files", key: "clientFiles", color: "#2b5fc5" },
  { label: "02_Audio_Preparation", key: "audioPreparation", color: "#5e8de3" },
  { label: "03_DAW_Project", key: "dawProject", color: "#28a36a" },
  { label: "04_Revisions", key: "revisions", color: "#d39a36" },
  { label: "05_Final_Delivery", key: "finalDelivery", color: "#8a6cc4" },
  { label: "06_Recall", key: "recall", color: "#7b8799" },
];

const ringBackground = (fileIndex: ProjectOverviewFileIndex, totalSize: number) => {
  if (fileIndex.status === "loading" || totalSize <= 0) return "#e8edf5";
  let cursor = 0;
  const segments = overviewFolders.flatMap((folder) => {
    const size = fileIndex.folders[folder.key].sizeBytes;
    if (size <= 0) return [];
    const start = cursor;
    cursor += (size / totalSize) * 360;
    return [`${folder.color} ${start}deg ${cursor}deg`];
  });
  return segments.length > 0 ? `conic-gradient(${segments.join(", ")})` : "#e8edf5";
};

export function ProjectOverviewFileSystem({ fileIndex }: { fileIndex: ProjectOverviewFileIndex }) {
  const loading = fileIndex.status === "loading";
  const partial = fileIndex.status === "partial" || fileIndex.status === "error";
  const totals = overviewFolders.reduce((total, folder) => {
    const summary = fileIndex.folders[folder.key];
    return {
      fileCount: total.fileCount + summary.fileCount,
      sizeBytes: total.sizeBytes + summary.sizeBytes,
    };
  }, { fileCount: 0, sizeBytes: 0 });
  const storageRingBackground = ringBackground(fileIndex, totals.sizeBytes);

  return (
    <section className="overview-card overview-filesystem-card" aria-labelledby="overview-filesystem-heading">
      <div className="overview-card-heading">
        <div><h2 id="overview-filesystem-heading">Project File System</h2><p>High-level project storage orientation</p></div>
        <span className="overview-index-pill">{loading ? "Indexing…" : partial ? "Partial index" : "Indexed"}</span>
      </div>
      <div className="overview-storage-summary">
        <div
          className="overview-storage-ring"
          style={{ background: storageRingBackground, border: 0, padding: 18, boxSizing: "border-box" }}
          aria-label={loading ? "Project storage indexing" : `${totals.fileCount} project files using ${formatProjectFileSize(totals.sizeBytes)}`}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff", display: "grid", placeContent: "center", justifyItems: "center" }}>
            <strong>{loading ? "…" : totals.fileCount}</strong>
            <span>{loading ? "indexing" : `${formatProjectFileSize(totals.sizeBytes)} total`}</span>
          </div>
        </div>
        <div className="overview-folder-list">
          {overviewFolders.map((folder) => {
            const summary = fileIndex.folders[folder.key];
            const unavailable = fileIndex.status === "error" || fileIndex.failedPaths.some((path) => path === folder.label || path.startsWith(`${folder.label}/`));
            return (
              <div key={folder.label}>
                <code>
                  <i
                    style={{ display: "inline-block", width: 7, height: 7, marginRight: 6, borderRadius: "50%", background: folder.color }}
                    aria-hidden="true"
                  />
                  {folder.label}
                </code>
                <span>{loading ? "Loading…" : unavailable ? "Unavailable" : `${summary.fileCount} files · ${formatProjectFileSize(summary.sizeBytes)}`}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="overview-index-note">Counts and sizes come from one background project-only index pass. Symlinks and unsupported entries are not traversed.</p>
    </section>
  );
}
