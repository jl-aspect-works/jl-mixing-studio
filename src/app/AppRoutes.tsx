import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceConfiguration } from "../settings/models";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";
import { ActivityRoute, ClientDetails, ClientsRoute, Dashboard, TasksRoute } from "../AppViews";
import { SettingsRoute, StudioRoute } from "../AppWorkflows";
import { AppProjectSection } from "../project/AppProjectSection";
import type { ProjectShellView } from "../project/ProjectView";
import type { AppPreferences } from "../AppWorkflowModels";
import { getWorkflowAvailability } from "../AppWorkflowAvailability";
import type { AppRouteContext } from "../shell/route-context";
import type { PrimaryRoute } from "../ui/routes";
import { useStudioWorkflow } from "../studio";
import { useProjectWorkflow } from "../project";
import { useIntakeWorkflow } from "../intake";
import { useRevisionWorkflow } from "../revision";
import { useApprovalWorkflow } from "../approval";
import { useDeliveryWorkflow } from "../delivery";
import type { WorkspaceStorageState } from "./useWorkspaceStorageSummary";

export interface AppRoutesProps {
  activeRoute: PrimaryRoute;
  workspace: ResourceState<WorkspaceSnapshot>;
  workspaceStorage: WorkspaceStorageState;
  workspaceConfiguration: ResourceState<WorkspaceConfiguration>;
  version: ResourceState<VersionCheck>;
  loading: boolean;
  availability: ReturnType<typeof getWorkflowAvailability>;
  route: AppRouteContext;
  projectView: ProjectShellView;
  selectedProject: boolean;
  preferences: AppPreferences;
  setPreferences: Dispatch<SetStateAction<AppPreferences>>;
  studioCreationAvailable: boolean;
  studioCreationHelp: string;
  studio: ReturnType<typeof useStudioWorkflow>;
  projects: ReturnType<typeof useProjectWorkflow>;
  intake: ReturnType<typeof useIntakeWorkflow>;
  revision: ReturnType<typeof useRevisionWorkflow>;
  approval: ReturnType<typeof useApprovalWorkflow>;
  delivery: ReturnType<typeof useDeliveryWorkflow>;
  onRefresh: () => void;
  onWorkspaceConfigurationReload: () => void;
  onNewClient: () => void;
  onNavigate: (route: PrimaryRoute) => void;
  onOpenDerivedProject: (clientId: string, projectId: string) => void;
  onSelectClient: (clientId: string | null) => void;
  onOpenClientProject: (clientId: string, projectId: string) => void;
  onProjects: () => void;
  onSelectProjectView: (view: ProjectShellView) => void;
  onOpenRevisions: () => void;
}

export function AppRoutes(p: AppRoutesProps) {
  if (p.activeRoute === "dashboard") return <Dashboard workspace={p.workspace} storage={p.workspaceStorage} version={p.version} automationReady={p.availability.automationReady} loading={p.loading} clientCreationAvailable={p.availability.clientCreationAvailable} clientCreationHelp={p.availability.clientCreationHelp} projectCreationAvailable={p.availability.projectCreationAvailable} projectCreationHelp={p.availability.projectCreationHelp} onRefresh={p.onRefresh} onNewClient={p.onNewClient} onNewProject={() => p.projects.open(null, false)} onTasks={() => p.onNavigate("tasks")} onActivity={() => p.onNavigate("activity")} onOpenProject={p.onOpenDerivedProject} />;
  if (p.activeRoute === "studio") return <StudioRoute workspace={p.workspace} version={p.version} loading={p.loading} setupAvailable={p.studioCreationAvailable} setupHelp={p.studioCreationHelp} onSetup={() => p.studio.openStudioWorkflow()} onRefresh={p.onRefresh} />;
  if (p.activeRoute === "tasks") return <TasksRoute workspace={p.workspace} loading={p.loading} onRefresh={p.onRefresh} onOpenProject={p.onOpenDerivedProject} />;
  if (p.activeRoute === "activity") return <ActivityRoute workspace={p.workspace} loading={p.loading} onRefresh={p.onRefresh} onOpenProject={p.onOpenDerivedProject} />;
  if (p.activeRoute === "settings") return <SettingsRoute preferences={p.preferences} onChange={p.setPreferences} workspace={p.workspace} workspaceConfiguration={p.workspaceConfiguration} version={p.version} onWorkspaceChanged={() => { p.onRefresh(); p.onWorkspaceConfigurationReload(); }} onCreateWorkspace={() => p.studio.openStudioWorkflow()} onRefresh={p.onRefresh} />;
  if (p.activeRoute === "clients") return p.route.resolvedClient ? <ClientDetails client={p.route.resolvedClient} onBack={() => p.onSelectClient(null)} onRefresh={p.onRefresh} loading={p.loading} onNewProject={() => p.projects.open(p.route.resolvedClient!.clientId, true)} projectCreationAvailable={p.availability.projectCreationAvailable} projectCreationHelp={p.availability.projectCreationHelp} onSelectProject={(projectId) => p.onOpenClientProject(p.route.resolvedClient!.clientId, projectId)} /> : <ClientsRoute workspace={p.workspace} onSelectClient={p.onSelectClient} onNewClient={p.onNewClient} onRefresh={p.onRefresh} loading={p.loading} clientCreationAvailable={p.availability.clientCreationAvailable} clientCreationHelp={p.availability.clientCreationHelp} />;
  if (p.activeRoute !== "projects") return null;
  return <AppProjectSection workspace={p.workspace} selected={p.selectedProject} client={p.route.resolvedProjectClient} project={p.route.resolvedProject} view={p.projectView} loading={p.loading} intakeReport={p.intake.reportState} intakeActionError={p.intake.actionError} intakeValidationAvailable={p.availability.intakeValidationAvailable} intakeValidationHelp={p.availability.intakeValidationHelp} intakeLoading={p.loading || p.intake.state.status === "preflighting"} revisionActionError={p.revision.actionError ?? p.approval.actionError} revisionCreationAvailable={p.availability.revisionCreationAvailable} revisionCreationHelp={p.availability.revisionCreationHelp} revisionApprovalAvailable={p.availability.revisionApprovalAvailable} revisionApprovalHelp={p.availability.revisionApprovalHelp} deliveryActionError={p.delivery.actionError} deliveryCreationAvailable={p.route.deliveryCreationAvailable} deliveryCreationHelp={p.route.deliveryCreationHelp} deliveryLoading={p.loading || p.delivery.state.status === "preflighting" || p.delivery.state.status === "creating"} projectCreationAvailable={p.availability.projectCreationAvailable} projectCreationHelp={p.availability.projectCreationHelp} onProjects={p.onProjects} onRefresh={p.onRefresh} onIntakeRefresh={() => { p.onRefresh(); p.intake.reload(); }} onStructuredValidationRefresh={p.intake.refreshStructured} onSelectView={p.onSelectProjectView} onOpenIntake={p.intake.open} onRecheckIntake={p.intake.recheck} onOpenRevisions={p.onOpenRevisions} onNewRevision={p.revision.open} onApproveRevision={p.approval.open} onCreateDelivery={p.delivery.open} onNewProject={() => p.projects.open(null, false)} onSelectProject={p.onOpenDerivedProject} />;
}
