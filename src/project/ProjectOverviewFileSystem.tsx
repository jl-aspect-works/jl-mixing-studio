import { formatProjectFileSize } from "./files/projectFileService";
import type { ProjectOverviewFileIndex, ProjectOverviewFolderKey } from "./ProjectOverviewFileIndex";

const overviewFolders: Array<{ label: string; key: ProjectOverviewFolderKey }> = [
  { label: "01_Client_Files", key: "clientFiles" },
  { label: "02_Audio_Preparation", key: "audioPreparation" },
  { label: "03_DAW_Project", key: "dawProject" },
  { label: "04_Revisions", key: "revisions" },
  { label: "05_Final_Delivery", key: "finalDelivery" },
  { label: "06_Recall", key: "recall" },
];

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

  return (
    <section className="overview-card overview-filesystem-card" aria-labelledby="overview-filesystem-heading">
      <div className="overview-card-heading">
        <div><h2 id="overview-filesystem-heading">Project File System</h2><p>High-level project storage orientation</p></div>
        <span className="overview-index-pill">{loading ? "Indexing…" : partial ? "Partial index" : "Indexed"}</span>
      </div>
      <div className="overview-storage-summary">
        <div className="overview-storage-ring" aria-hidden="true"><strong>{loading ? "…" : totals.fileCount}</strong><span>{loading ? "indexing" : `${formatProjectFileSize(totals.sizeBytes)} total`}</span></div>
        <div className="overview-folder-list">
          {overviewFolders.map((folder) => {
            const summary = fileIndex.folders[folder.key];
            const unavailable = fileIndex.status === "error" || fileIndex.failedPaths.some((path) => path === folder.label || path.startsWith(`${folder.label}/`));
            return <div key={folder.label}><code>{folder.label}</code><span>{loading ? "Loading…" : unavailable ? "Unavailable" : `${summary.fileCount} files · ${formatProjectFileSize(summary.sizeBytes)}`}</span></div>;
          })}
        </div>
      </div>
      <p className="overview-index-note">Counts and sizes come from one validated project-file index pass. Symlinks and unsupported entries are not traversed.</p>
    </section>
  );
}
