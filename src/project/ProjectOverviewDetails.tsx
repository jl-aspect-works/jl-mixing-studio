import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { ProjectOverviewFileSystem } from "./ProjectOverviewFileSystem";
import { ProjectOverviewHealth } from "./ProjectOverviewHealth";
import { ProjectOverviewQuickActions } from "./ProjectOverviewQuickActions";
import { ProjectOverviewRecentRevisions } from "./ProjectOverviewRecentRevisions";
import { ProjectOverviewSummary } from "./ProjectOverviewSummary";

export function ProjectOverviewDetails({ client, project, tasks, intakeReport, loading, revisionCreationAvailable, revisionApprovalAvailable, onNewRevision, onApproveRevision, onRevisions }: { client: ClientSummary; project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState; loading: boolean; revisionCreationAvailable: boolean; revisionApprovalAvailable: boolean; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onRevisions: () => void }) {
  return (
    <div className="overview-layout">
      <div className="overview-top-grid">
        <ProjectOverviewSummary project={project} tasks={tasks} intakeReport={intakeReport} />
        <ProjectOverviewHealth project={project} tasks={tasks} intakeReport={intakeReport} />
        <ProjectOverviewQuickActions client={client} project={project} loading={loading} revisionCreationAvailable={revisionCreationAvailable} revisionApprovalAvailable={revisionApprovalAvailable} onNewRevision={onNewRevision} onApproveRevision={onApproveRevision} onRevisions={onRevisions} />
      </div>
      <div className="overview-bottom-grid">
        <ProjectOverviewRecentRevisions project={project} onRevisions={onRevisions} />
        <ProjectOverviewFileSystem clientId={client.clientId} projectId={project.projectId} />
      </div>
    </div>
  );
}
