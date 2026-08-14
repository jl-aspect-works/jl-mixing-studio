import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import { GlobalSearch, type IntakeReportState } from "../AppShellViews";
import { ProjectBreadcrumbs } from "./ProjectBreadcrumbs";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import { ProjectOverviewDetails } from "./ProjectOverviewDetails";
import type { ProjectShellView } from "./ProjectView";
import "./ProjectOverview.css";

export function ProjectOverviewShell({ client, project, projectTasks, intakeReport, loading, revisionCreationAvailable, revisionApprovalAvailable, onProjects, onRefresh, onRevisions, onNewRevision, onApproveRevision, onSelectView }: { client: ClientSummary; project: ProjectSummary; projectTasks: DerivedTask[]; intakeReport: IntakeReportState; loading: boolean; revisionCreationAvailable: boolean; revisionApprovalAvailable: boolean; onProjects: () => void; onRefresh: () => void; onRevisions: () => void; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onSelectView: (view: ProjectShellView) => void }) {
  return (
    <>
      <div className="detail-navigation-row overview-detail-navigation-row">
        <ProjectBreadcrumbs project={project} onProjects={onProjects} />
        <div className="overview-navigation-search"><GlobalSearch /></div>
        <button type="button" className="secondary overview-refresh-button" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      <ProjectNavigationBar active="overview" onSelect={onSelectView} />
      <ProjectOverviewDetails client={client} project={project} tasks={projectTasks} intakeReport={intakeReport} loading={loading} revisionCreationAvailable={revisionCreationAvailable} revisionApprovalAvailable={revisionApprovalAvailable} onNewRevision={onNewRevision} onApproveRevision={onApproveRevision} onRevisions={onRevisions} />
    </>
  );
}
