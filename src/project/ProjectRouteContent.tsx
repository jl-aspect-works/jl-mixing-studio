import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { IntakeView } from "../intake/IntakeViews";
import { RevisionsView } from "../revision/RevisionViews";
import { DeliveryView } from "../delivery/DeliveryView";
import { ProjectFilesShellView } from "./ProjectFilesShellView";
import { ProjectOverviewShell } from "./ProjectOverviewShell";
import { ProjectPlaceholderView } from "./ProjectPlaceholderView";
import type { ProjectShellView } from "./ProjectView";

export interface ProjectRouteContentProps {
  view: ProjectShellView; client: ClientSummary; project: ProjectSummary; workspacePath: string; projectTasks: DerivedTask[]; loading: boolean;
  intakeReport: IntakeReportState; intakeActionError: string | null; intakeValidationAvailable: boolean; intakeValidationHelp: string; intakeLoading: boolean;
  revisionActionError: string | null; revisionCreationAvailable: boolean; revisionCreationHelp: string; revisionApprovalAvailable: boolean; revisionApprovalHelp: string;
  deliveryActionError: string | null; deliveryCreationAvailable: boolean; deliveryCreationHelp: string; deliveryLoading: boolean;
  onProjects: () => void; onRefresh: () => void; onIntakeRefresh: () => void; onSelectView: (view: ProjectShellView) => void; onOpenIntake: () => void; onPreviewIntake: () => void; onOpenRevisions: () => void; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onCreateDelivery: () => void;
}

export function ProjectRouteContent(p: ProjectRouteContentProps) {
  const common = { onProjects: p.onProjects, onOverview: () => p.onSelectView("overview"), onSelectView: p.onSelectView };
  if (p.view === "intake") return <IntakeView client={p.client} project={p.project} reportState={p.intakeReport} actionError={p.intakeActionError} validationAvailable={p.intakeValidationAvailable} validationHelp={p.intakeValidationHelp} loading={p.intakeLoading} onPreview={p.onPreviewIntake} onRefresh={p.onIntakeRefresh} {...common} />;
  if (p.view === "audioPrep" || p.view === "references") return <ProjectPlaceholderView active={p.view} project={p.project} {...common} />;
  if (p.view === "revisions") return <RevisionsView client={p.client} project={p.project} loading={p.loading} actionError={p.revisionActionError} creationAvailable={p.revisionCreationAvailable} creationHelp={p.revisionCreationHelp} approvalAvailable={p.revisionApprovalAvailable} approvalHelp={p.revisionApprovalHelp} onRefresh={p.onRefresh} onNewRevision={p.onNewRevision} onApprove={p.onApproveRevision} {...common} />;
  if (p.view === "delivery") return <DeliveryView clientId={p.client.clientId} project={p.project} loading={p.deliveryLoading} actionError={p.deliveryActionError} creationAvailable={p.deliveryCreationAvailable} creationHelp={p.deliveryCreationHelp} onCreate={p.onCreateDelivery} onRefresh={p.onRefresh} {...common} />;
  if (p.view === "files") return <ProjectFilesShellView client={p.client} project={p.project} {...common} />;
  return <ProjectOverviewShell client={p.client} project={p.project} workspacePath={p.workspacePath} projectTasks={p.projectTasks} intakeReport={p.intakeReport} loading={p.loading} revisionCreationAvailable={p.revisionCreationAvailable} revisionApprovalAvailable={p.revisionApprovalAvailable} onProjects={p.onProjects} onRefresh={p.onRefresh} onRevisions={p.onOpenRevisions} onNewRevision={p.onNewRevision} onApproveRevision={p.onApproveRevision} onSelectView={p.onSelectView} />;
}
