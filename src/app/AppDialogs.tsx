import type { ProjectSummary, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";
import { ApprovalDialog, ClientDialog, DeliveryDialog, DeliveryOptionsDialog, IntakeDialog, ProjectDialog, RevisionDialog, StudioDialog } from "../AppWorkflows";
import { useStudioWorkflow } from "../studio";
import { useClientWorkflow } from "../client";
import { useProjectWorkflow } from "../project";
import { useIntakeWorkflow } from "../intake";
import { ManagedFileOperationDialog } from "../intake/ManagedFileOperationDialog";
import { useRevisionWorkflow } from "../revision";
import { useApprovalWorkflow } from "../approval";
import { useDeliveryWorkflow } from "../delivery";

export interface AppDialogsProps {
  workspace: ResourceState<WorkspaceSnapshot>;
  project: ProjectSummary | null;
  studio: ReturnType<typeof useStudioWorkflow>;
  clients: ReturnType<typeof useClientWorkflow>;
  projects: ReturnType<typeof useProjectWorkflow>;
  intake: ReturnType<typeof useIntakeWorkflow>;
  revision: ReturnType<typeof useRevisionWorkflow>;
  approval: ReturnType<typeof useApprovalWorkflow>;
  delivery: ReturnType<typeof useDeliveryWorkflow>;
  onRefresh: () => void;
}

export function AppDialogs({ workspace, project, studio, clients, projects, intake, revision, approval, delivery, onRefresh }: AppDialogsProps) {
  return <>
    {studio.studioWorkflow.status !== "closed" && <StudioDialog state={studio.studioWorkflow} values={studio.studioForm} onChange={studio.setStudioForm} onChooseLocation={studio.chooseWorkspaceLocation} onCreate={studio.createStudio} onClose={studio.closeStudioWorkflow} />}
    {clients.state.status !== "closed" && <ClientDialog state={clients.state} values={clients.form} onChange={clients.setForm} onPreflight={clients.preflight} onConfirm={clients.confirm} onBack={() => clients.setState({ status: "editing" })} onClose={clients.close} />}
    {projects.state.status !== "closed" && <ProjectDialog state={projects.state} values={projects.form} clients={workspace.status === "ready" ? workspace.value.clients : []} onChange={projects.setForm} onPreflight={projects.preflight} onConfirm={projects.confirm} onBack={() => {
      if (projects.state.status !== "confirming") return;
      projects.setState({ status: "editing", lockedClientId: projects.state.fromClient ? projects.state.request.clientId : null, fromClient: projects.state.fromClient });
    }} onClose={projects.close} />}
    {projects.postCreateImport && <ManagedFileOperationDialog
      clientId={projects.postCreateImport.clientId}
      projectId={projects.postCreateImport.projectId}
      mode="import"
      title="Add Client Files"
      sourceCancelLabel="Skip for now"
      followupRunning={intake.state.status === "preflighting"}
      followupProgress={intake.progress}
      onCompleted={() => { intake.refreshStructured(); }}
      onClose={() => { projects.setPostCreateImport(null); void onRefresh(); }}
    />}
    {intake.state.status !== "closed" && intake.state.status !== "preflighting" && <IntakeDialog state={intake.state} progress={intake.progress} onConfirm={intake.confirm} onClose={intake.closeDialog} />}
    {revision.state.status !== "closed" && project && <RevisionDialog state={revision.state} values={revision.form} project={project} onChange={revision.setForm} onPreflight={revision.preflight} onConfirm={revision.confirm} onBack={revision.back} onClose={revision.close} />}
    {approval.state.status !== "closed" && project && <ApprovalDialog state={approval.state} values={approval.form} project={project} onChange={approval.setForm} onPreflight={approval.preflight} onConfirm={approval.confirm} onBack={approval.back} onClose={approval.close} />}
    {delivery.state.status === "options" && project?.approvedRevision !== null && project?.approvedRevision !== undefined && <DeliveryOptionsDialog approvedRevision={project.approvedRevision} showCleanOption={project.delivery !== null} cleanFirst={delivery.state.cleanFirst} onCleanFirstChange={delivery.setCleanFirst} onBuild={delivery.preflight} onClose={delivery.close} />}
    {delivery.state.status !== "closed" && delivery.state.status !== "options" && project?.approvedRevision !== null && project?.approvedRevision !== undefined && <DeliveryDialog state={delivery.state} approvedRevision={project.approvedRevision} onClose={() => { delivery.close(); if (delivery.state.status === "uncertain") onRefresh(); }} />}
  </>;
}
