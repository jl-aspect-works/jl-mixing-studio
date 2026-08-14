import type { ProjectSummary, RevisionSummary } from "../types";
import { formatOverviewDateTime, overviewString } from "./ProjectOverviewModel";

const statusLabels = (project: ProjectSummary, revision: RevisionSummary) => {
  const labels: string[] = [];
  if (revision.number === project.currentRevision) labels.push("Current");
  if (revision.number === project.approvedRevision) labels.push("Approved");
  if (revision.number === project.deliveredRevision) labels.push("Delivered");
  return labels;
};

export function ProjectOverviewRecentRevisions({ project, onRevisions }: { project: ProjectSummary; onRevisions: () => void }) {
  const revisions = [...project.revisions].sort((a, b) => b.number - a.number).slice(0, 4);
  return (
    <section className="overview-card overview-revisions-card" aria-labelledby="overview-revisions-heading">
      <div className="overview-card-heading"><h2 id="overview-revisions-heading">Recent Revisions</h2><button type="button" className="secondary overview-compact-button" onClick={onRevisions}>View All Revisions</button></div>
      {revisions.length === 0 ? <p className="overview-empty-copy">No revisions have been created yet.</p> : <div className="overview-revision-list">
        {revisions.map((revision) => {
          const labels = statusLabels(project, revision);
          return <article key={revision.revisionId}><div className="overview-revision-number">{String(revision.number).padStart(2, "0")}</div><div><strong>Revision {revision.number}</strong><p>{revision.description || "No revision description"}</p></div><div className="overview-revision-meta"><span>{formatOverviewDateTime(overviewString(revision, "createdAt"))}</span><div>{labels.map((label) => <small key={label} className={`overview-revision-badge ${label.toLowerCase()}`}>{label}</small>)}</div></div></article>;
        })}
      </div>}
    </section>
  );
}
