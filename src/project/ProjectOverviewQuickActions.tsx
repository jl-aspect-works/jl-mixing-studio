import type { ClientSummary, ProjectSummary, RevisionSummary } from "../types";
import { FolderControl } from "../AppShellViews";

export function ProjectOverviewQuickActions({ client, project, loading, revisionCreationAvailable, revisionApprovalAvailable, onNewRevision, onApproveRevision, onRevisions }: { client: ClientSummary; project: ProjectSummary; loading: boolean; revisionCreationAvailable: boolean; revisionApprovalAvailable: boolean; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onRevisions: () => void }) {
  const currentRevision = project.revisions.find((revision) => revision.number === project.currentRevision) ?? null;
  const canApproveCurrent = Boolean(currentRevision) && project.approvedRevision !== project.currentRevision && revisionApprovalAvailable && !loading;

  return (
    <section className="overview-card overview-actions-card" aria-labelledby="overview-actions-heading">
      <h2 id="overview-actions-heading">Quick Actions</h2>
      <div className="overview-action-stack">
        <button type="button" aria-label="New revision" onClick={onNewRevision} disabled={!revisionCreationAvailable || loading}>Create New Revision</button>
        <button type="button" className="secondary" onClick={() => currentRevision && onApproveRevision(currentRevision)} disabled={!canApproveCurrent}>Approve Current Revision</button>
        <button type="button" className="secondary" onClick={onRevisions}>View Revisions</button>
        <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} label="Open Project Folder" />
      </div>
    </section>
  );
}
