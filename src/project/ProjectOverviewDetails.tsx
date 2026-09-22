import { useEffect, useState } from "react";
import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { useProjectOverviewFileIndex } from "./ProjectOverviewFileIndex";
import { ProjectOverviewFileSystem } from "./ProjectOverviewFileSystem";
import { ProjectOverviewHealth } from "./ProjectOverviewHealth";
import { ProjectOverviewQuickActions } from "./ProjectOverviewQuickActions";
import { ProjectOverviewRecentRevisions } from "./ProjectOverviewRecentRevisions";
import { ProjectOverviewSummary } from "./ProjectOverviewSummary";
import { ProjectDeleteDialog } from "./ProjectDeleteDialog";
import { getProjectDeleteSupport } from "./projectDeleteService";

export function ProjectOverviewDetails({ client, project, tasks, intakeReport, loading, revisionCreationAvailable, revisionApprovalAvailable, onNewRevision, onApproveRevision, onRevisions, onDeleted }: { client: ClientSummary; project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState; loading: boolean; revisionCreationAvailable: boolean; revisionApprovalAvailable: boolean; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onRevisions: () => void; onDeleted: () => void }) {
  const fileIndex = useProjectOverviewFileIndex(client.clientId, project.projectId);
  const [deleteSupported, setDeleteSupported] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { let active = true; void getProjectDeleteSupport().then((value) => { if (active) setDeleteSupported(value); }).catch(() => undefined); return () => { active = false; }; }, []);

  return (
    <div className="overview-layout">
      <div className="overview-top-grid">
        <ProjectOverviewSummary project={project} tasks={tasks} intakeReport={intakeReport} fileIndex={fileIndex} />
        <ProjectOverviewHealth project={project} tasks={tasks} intakeReport={intakeReport} fileIndex={fileIndex} />
        <ProjectOverviewQuickActions client={client} project={project} loading={loading} revisionCreationAvailable={revisionCreationAvailable} revisionApprovalAvailable={revisionApprovalAvailable} onNewRevision={onNewRevision} onApproveRevision={onApproveRevision} onRevisions={onRevisions} />
      </div>
      <div className="overview-bottom-grid">
        <ProjectOverviewRecentRevisions clientId={client.clientId} project={project} onRevisions={onRevisions} />
        <ProjectOverviewFileSystem fileIndex={fileIndex} />
      </div>
      {deleteSupported && <section className="overview-danger-zone" aria-labelledby="project-danger-heading"><div><h2 id="project-danger-heading">Delete Project</h2><p>Permanently remove this project from the workspace. External Listening copies remain.</p></div><button type="button" className="danger" onClick={() => setDeleting(true)} disabled={loading}>Delete Project…</button></section>}
      {deleting && <ProjectDeleteDialog client={client} project={project} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}
    </div>
  );
}
