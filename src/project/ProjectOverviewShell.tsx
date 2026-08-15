import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import { ProjectOverviewDetails } from "./ProjectOverviewDetails";
import type { ProjectShellView } from "./ProjectView";
import "./ProjectOverview.css";

export function ProjectOverviewShell({ client, project, projectTasks, intakeReport, loading, revisionCreationAvailable, revisionApprovalAvailable, onRevisions, onNewRevision, onApproveRevision, onSelectView }: { client: ClientSummary; project: ProjectSummary; projectTasks: DerivedTask[]; intakeReport: IntakeReportState; loading: boolean; revisionCreationAvailable: boolean; revisionApprovalAvailable: boolean; onProjects: () => void; onRefresh: () => void; onRevisions: () => void; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onSelectView: (view: ProjectShellView) => void }) {
  return (
    <>
      <ProjectNavigationBar active="overview" onSelect={onSelectView} />
      <ProjectOverviewDetails client={client} project={project} tasks={projectTasks} intakeReport={intakeReport} loading={loading} revisionCreationAvailable={revisionCreationAvailable} revisionApprovalAvailable={revisionApprovalAvailable} onNewRevision={onNewRevision} onApproveRevision={onApproveRevision} onRevisions={onRevisions} />
    </>
  );
}
