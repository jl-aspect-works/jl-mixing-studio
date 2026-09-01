import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import type { IntakeValidationProgress } from "../intake/models";
import { IntakeView } from "../intake/IntakeViews";
import { AudioPrepView } from "../audioPrep/AudioPrepView";
import { ReferencesView } from "../references/ReferencesView";
import { RevisionsView } from "../revision/RevisionViews";
import { DeliveryView } from "../delivery/DeliveryView";
import { ListeningProjectActivity } from "../listening/ListeningProjectActivity";
import { ProjectFilesShellView } from "./ProjectFilesShellView";
import { ProjectOverviewShell } from "./ProjectOverviewShell";
import type { ProjectShellView } from "./ProjectView";

export interface ProjectRouteContentProps {
  view: ProjectShellView; client: ClientSummary; project: ProjectSummary; workspacePath: string; projectTasks: DerivedTask[]; loading: boolean;
  intakeReport: IntakeReportState; intakeActionError: string | null; intakeValidationAvailable: boolean; intakeValidationHelp: string; intakeLoading: boolean; intakeProgress: IntakeValidationProgress | null;
  revisionActionError: string | null; revisionCreationAvailable: boolean; revisionCreationHelp: string; revisionApprovalAvailable: boolean; revisionApprovalHelp: string;
  deliveryActionError: string | null; deliveryCreationAvailable: boolean; deliveryCreationHelp: string; deliveryLoading: boolean;
  onProjects: () => void; onRefresh: () => void; onIntakeRefresh: () => void; onStructuredValidationRefresh: () => void; onSelectView: (view: ProjectShellView) => void; onOpenIntake: () => void; onRecheckIntake: () => void; onOpenRevisions: () => void; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onCreateDelivery: () => void;
}

export function ProjectRouteContent(p: ProjectRouteContentProps) {
  const common = { onProjects: p.onProjects, onOverview: () => p.onSelectView("overview"), onSelectView: p.onSelectView };

  if (p.view === "intake") {
    return <IntakeView client={p.client} project={p.project} reportState={p.intakeReport} actionError={p.intakeActionError} validationAvailable={p.intakeValidationAvailable} validationHelp={p.intakeValidationHelp} loading={p.intakeLoading} progress={p.intakeProgress} onRecheck={p.onRecheckIntake} onRefresh={p.onIntakeRefresh} {...common} />;
  }
  if (p.view === "audioPrep") {
    return <AudioPrepView client={p.client} project={p.project} reportState={p.intakeReport} onValidationRefresh={p.onStructuredValidationRefresh} {...common} />;
  }
  if (p.view === "references") {
    return <ReferencesView client={p.client} project={p.project} {...common} />;
  }
  if (p.view === "revisions") {
    return <RevisionsView client={p.client} project={p.project} loading={p.loading} actionError={p.revisionActionError} creationAvailable={p.revisionCreationAvailable} creationHelp={p.revisionCreationHelp} approvalAvailable={p.revisionApprovalAvailable} approvalHelp={p.revisionApprovalHelp} deliveryAvailable={p.deliveryCreationAvailable} deliveryHelp={p.deliveryCreationHelp} onRefresh={p.onRefresh} onNewRevision={p.onNewRevision} onApprove={p.onApproveRevision} onCreateDelivery={() => { p.onSelectView("delivery"); p.onCreateDelivery(); }} {...common} />;
  }
  if (p.view === "delivery") {
    return <>
      <DeliveryView clientId={p.client.clientId} project={p.project} loading={p.deliveryLoading} actionError={p.deliveryActionError} creationAvailable={p.deliveryCreationAvailable} creationHelp={p.deliveryCreationHelp} onCreate={p.onCreateDelivery} onRefresh={p.onRefresh} {...common} />
      <ListeningProjectActivity clientId={p.client.clientId} projectId={p.project.projectId} deliveredRevision={p.project.deliveredRevision} mode="delivery" />
    </>;
  }
  if (p.view === "files") {
    return <ProjectFilesShellView client={p.client} project={p.project} {...common} />;
  }
  return <ProjectOverviewShell client={p.client} project={p.project} projectTasks={p.projectTasks} intakeReport={p.intakeReport} loading={p.loading} revisionCreationAvailable={p.revisionCreationAvailable} revisionApprovalAvailable={p.revisionApprovalAvailable} onProjects={p.onProjects} onRefresh={p.onRefresh} onRevisions={p.onOpenRevisions} onNewRevision={p.onNewRevision} onApproveRevision={p.onApproveRevision} onSelectView={p.onSelectView} />;
}
