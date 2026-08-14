import { useEffect, useState } from "react";
import { GlobalSearch, RouteHeader, Sidebar } from "./AppViews";
import { type AppPreferences, loadPreferences } from "./AppWorkflowModels";
import { getWorkflowAvailability } from "./AppWorkflowAvailability";
import { getAppRouteContext } from "./AppRouteContext";
import { useWorkspaceResources } from "./app/useWorkspaceResources";
import { AppNotices } from "./app/AppNotices";
import { AppRoutes } from "./app/AppRoutes";
import { AppDialogs } from "./app/AppDialogs";
import { ProjectBreadcrumbs } from "./project/ProjectBreadcrumbs";
import { ProjectOverviewHeader } from "./project/ProjectOverviewHeader";
import type { PrimaryRoute } from "./ui/routes";
import type { ProjectShellView } from "./project/ProjectView";
import { useStudioWorkflow } from "./studio";
import { useClientWorkflow } from "./client";
import { useProjectWorkflow } from "./project";
import { useIntakeWorkflow } from "./intake";
import { useRevisionWorkflow } from "./revision";
import { useApprovalWorkflow } from "./approval";
import { useDeliveryWorkflow } from "./delivery";
import "./App.css";

export default function StudioApp() {
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences);
  const [activeRoute, setActiveRoute] = useState<PrimaryRoute>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<{ clientId: string; projectId: string; fromClient: boolean } | null>(null);
  const [projectView, setProjectView] = useState<ProjectShellView>("overview");
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [clientNotice, setClientNotice] = useState<string | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const resources = useWorkspaceResources();
  const availability = getWorkflowAvailability(resources.workspace, resources.version);
  const explicitlyConfigured = resources.workspaceConfiguration.status === "ready" && resources.workspaceConfiguration.value.configured;
  const configuredUnavailable = explicitlyConfigured && resources.workspace.status === "ready" && resources.workspace.value.status === "unavailable";
  const studioCreationAvailable = availability.studioCreationAvailable && resources.workspaceConfiguration.status === "ready" && !explicitlyConfigured;
  const studioCreationHelp = configuredUnavailable ? "Reconnect the configured workspace or choose another workspace in Settings. Studio will not replace it with a new default workspace." : availability.studioCreationHelp;

  const studio = useStudioWorkflow({ studioCreationAvailable, onWorkspaceRefreshed: (value) => resources.setWorkspace({ status: "ready", value }) });
  const clients = useClientWorkflow({ creationAvailable: availability.clientCreationAvailable, setWorkspace: resources.setWorkspace, setNotice: setClientNotice });
  const projects = useProjectWorkflow({ creationAvailable: availability.projectCreationAvailable, workspace: resources.workspace, setWorkspace: resources.setWorkspace, setNotice: setProjectNotice, onOpen: () => clients.setState({ status: "closed" }), onCreated: (clientId, projectId, fromClient) => { setSelectedClientId(null); setSelectedProject({ clientId, projectId, fromClient }); setProjectView("overview"); setActiveRoute("projects"); setRouteNotice(null); } });
  const route = getAppRouteContext(resources.workspace, resources.version, selectedClientId, selectedProject, activeRoute, projectView, availability.deliveryCreationSupported);
  const intake = useIntakeWorkflow({ validationAvailable: availability.intakeValidationAvailable, clientId: route.resolvedProjectClient?.clientId ?? null, projectId: route.resolvedProject?.projectId ?? null, onOpen: () => { setProjectView("intake"); revision.reset(); approval.reset(); } });
  const revision = useRevisionWorkflow({ creationAvailable: availability.revisionCreationAvailable, clientId: route.resolvedProjectClient?.clientId ?? null, project: route.resolvedProject, setWorkspace: resources.setWorkspace, onOpen: () => { intake.reset(); approval.reset(); }, onCreated: () => setProjectView("revisions") });
  const approval = useApprovalWorkflow({ approvalAvailable: availability.revisionApprovalAvailable, clientId: route.resolvedProjectClient?.clientId ?? null, project: route.resolvedProject, setWorkspace: resources.setWorkspace, onOpen: () => revision.reset() });
  const delivery = useDeliveryWorkflow({ creationAvailable: route.deliveryCreationAvailable, clientId: route.resolvedProjectClient?.clientId ?? null, project: route.resolvedProject, setWorkspace: resources.setWorkspace });

  useEffect(() => {
    if (resources.workspace.status !== "ready") return;
    if (selectedProject) {
      const client = resources.workspace.value.clients.find((item) => item.clientId === selectedProject.clientId);
      const project = client?.projects.find((item) => item.projectId === selectedProject.projectId);
      if (!client || !project) { setSelectedProject(null); setSelectedClientId(null); setProjectView("overview"); setActiveRoute("projects"); intake.clear(); setRouteNotice("The selected project is no longer available in the refreshed workspace."); }
      return;
    }
    if (selectedClientId && !resources.workspace.value.clients.some((item) => item.clientId === selectedClientId)) { setSelectedClientId(null); setActiveRoute("clients"); setRouteNotice("The selected client is no longer available in the refreshed workspace."); }
  }, [resources.workspace, selectedClientId, selectedProject]);

  const openClientWorkflow = () => { if (!availability.clientCreationAvailable) return; projects.setState({ status: "closed" }); clients.open(); };
  const openRevisions = () => { if (!route.resolvedProjectClient || !route.resolvedProject) return; setProjectView("revisions"); intake.reset(); };
  const selectProjectView = (view: ProjectShellView) => { if (view === "intake") { intake.open(); return; } if (view === "revisions") { openRevisions(); return; } setProjectView(view); intake.reset(); revision.reset(); approval.reset(); };
  const navigate = (next: PrimaryRoute) => { setActiveRoute(next); setSelectedClientId(null); setSelectedProject(null); setProjectView("overview"); setRouteNotice(null); intake.clear(); revision.reset(); approval.reset(); };
  const openProject = (clientId: string, projectId: string) => { setSelectedClientId(null); setSelectedProject({ clientId, projectId, fromClient: false }); setProjectView("overview"); setActiveRoute("projects"); setRouteNotice(null); };
  const openClientProject = (clientId: string, projectId: string) => { setSelectedClientId(null); setSelectedProject({ clientId, projectId, fromClient: true }); setProjectView("overview"); setActiveRoute("projects"); setRouteNotice(null); };
  const leaveProject = () => { setSelectedProject(null); setSelectedClientId(null); setProjectView("overview"); setRouteNotice(null); };
  const projectHeaderClient = activeRoute === "projects" && selectedProject !== null ? route.resolvedProjectClient : null;
  const projectHeaderProject = activeRoute === "projects" && selectedProject !== null ? route.resolvedProject : null;
  const workspacePath = resources.workspace.status === "ready" ? resources.workspace.value.workspacePath : "";
  const showOverviewToolbar = projectHeaderProject !== null && projectView === "overview";

  return <div className={`app-shell${preferences.compactLayout ? " compact-layout" : ""}${preferences.reduceMotion ? " reduce-motion" : ""}`}>
    <Sidebar activeRoute={activeRoute} onNavigate={navigate} workspace={resources.workspace} />
    <main className={`main-content${showOverviewToolbar ? " project-overview-open" : ""}`} id="main-content">
      {showOverviewToolbar && <header className="route-header compact-project-route-header"><div><p className="eyebrow">{route.activeRouteDefinition.eyebrow}</p><h1>{route.activeRouteDefinition.title}</h1><p className="lede">{route.activeRouteDefinition.description}</p></div></header>}
      {projectHeaderClient && projectHeaderProject ? <>{showOverviewToolbar && <div className="detail-navigation-row overview-detail-navigation-row"><ProjectBreadcrumbs project={projectHeaderProject} onProjects={leaveProject} /><div className="overview-navigation-search"><GlobalSearch /></div><button type="button" className="secondary overview-refresh-button" onClick={resources.refresh} disabled={resources.loading}>{resources.loading ? "Refreshing…" : "Refresh"}</button></div>}<ProjectOverviewHeader client={projectHeaderClient} project={projectHeaderProject} workspacePath={workspacePath} /></> : <RouteHeader route={route.activeRouteDefinition} />}
      <AppNotices routeNotice={routeNotice} studioNotice={studio.studioNotice} clientNotice={clientNotice} projectNotice={projectNotice} intakeNotice={intake.notice} revisionNotice={revision.notice} approvalNotice={approval.notice} deliveryNotice={delivery.notice} />
      <AppRoutes activeRoute={activeRoute} workspace={resources.workspace} workspaceConfiguration={resources.workspaceConfiguration} version={resources.version} loading={resources.loading} availability={availability} route={route} projectView={projectView} selectedProject={selectedProject !== null} preferences={preferences} setPreferences={setPreferences} studioCreationAvailable={studioCreationAvailable} studioCreationHelp={studioCreationHelp} studio={studio} projects={projects} intake={intake} revision={revision} approval={approval} delivery={delivery} onRefresh={resources.refresh} onWorkspaceConfigurationReload={resources.reloadWorkspaceConfiguration} onNewClient={openClientWorkflow} onNavigate={navigate} onOpenDerivedProject={openProject} onSelectClient={(clientId) => { setSelectedClientId(clientId); setRouteNotice(null); }} onOpenClientProject={openClientProject} onProjects={leaveProject} onSelectProjectView={selectProjectView} onOpenRevisions={openRevisions} />
    </main>
    <AppDialogs workspace={resources.workspace} project={route.resolvedProject} studio={studio} clients={clients} projects={projects} intake={intake} revision={revision} approval={approval} delivery={delivery} onRefresh={resources.refresh} />
  </div>;
}
