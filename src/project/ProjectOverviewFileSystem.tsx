import type { ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { getIntakeOverviewStatus } from "./ProjectOverviewModel";

export function ProjectOverviewFileSystem({ project, intakeReport }: { project: ProjectSummary; intakeReport: IntakeReportState }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const deliveryFiles = project.delivery?.files.length ?? 0;
  const rows = [
    { label: "01_Client_Files", value: intake.fileCount === null ? "Not indexed" : `${intake.fileCount} files` },
    { label: "02_Audio_Preparation", value: "Index pending" },
    { label: "03_Mix_Revisions", value: `${project.revisions.length} revisions` },
    { label: "04_References", value: "Index pending" },
    { label: "05_Final_Delivery", value: `${deliveryFiles} files` },
  ];

  return (
    <section className="overview-card overview-filesystem-card" aria-labelledby="overview-filesystem-heading">
      <div className="overview-card-heading"><div><h2 id="overview-filesystem-heading">Project File System</h2><p>High-level project storage orientation</p></div><span className="overview-index-pill">Partial index</span></div>
      <div className="overview-storage-summary">
        <div className="overview-storage-ring" aria-hidden="true"><strong>{project.revisions.length + (intake.fileCount ?? 0) + deliveryFiles}</strong><span>known items</span></div>
        <div className="overview-folder-list">{rows.map((row) => <div key={row.label}><code>{row.label}</code><span>{row.value}</span></div>)}</div>
      </div>
      <p className="overview-index-note">Full folder sizes and distribution will populate from the shared project file service; this screen does not perform its own filesystem scan.</p>
    </section>
  );
}
