import type { ClientSummary, ProjectSummary, VersionCheck, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";
import type { ProjectShellView } from "../project/ProjectView";
import { routes, type PrimaryRoute, type RouteDefinition } from "../ui/routes";

export interface SelectedProject {
  clientId: string;
  projectId: string;
  fromClient: boolean;
}

export interface AppRouteContext {
  resolvedClient: ClientSummary | null;
  resolvedProjectClient: ClientSummary | null;
  resolvedProject: ProjectSummary | null;
  deliveryCreationAvailable: boolean;
  deliveryCreationHelp: string;
  activeRouteDefinition: RouteDefinition;
}

const projectRouteCopy: Record<ProjectShellView, { eyebrow: string; description: string }> = {
  overview: { eyebrow: "Project overview", description: "Project details and next steps." },
  intake: { eyebrow: "Client Files", description: "Original delivery and intake status." },
  audioPrep: { eyebrow: "Audio Prep", description: "Prepare working audio for the mix." },
  references: { eyebrow: "References", description: "Reference material for the project." },
  revisions: { eyebrow: "Project revisions", description: "Revisions, approvals, and mix history." },
  delivery: { eyebrow: "Project delivery", description: "Final files and delivery status." },
  files: { eyebrow: "Project files", description: "Project-wide file inspection." },
  reports: { eyebrow: "Project reports", description: "Project reports." },
  metadata: { eyebrow: "Project metadata", description: "Project metadata." },
};

export function getAppRouteContext(
  workspace: ResourceState<WorkspaceSnapshot>,
  version: ResourceState<VersionCheck>,
  selectedClientId: string | null,
  selectedProject: SelectedProject | null,
  activeRoute: PrimaryRoute,
  projectView: ProjectShellView,
  deliveryCreationSupported: boolean,
): AppRouteContext {
  const resolvedClient = workspace.status === "ready" && selectedClientId
    ? workspace.value.clients.find((client) => client.clientId === selectedClientId) ?? null
    : null;
  const resolvedProjectClient = workspace.status === "ready" && selectedProject
    ? workspace.value.clients.find((client) => client.clientId === selectedProject.clientId) ?? null
    : null;
  const resolvedProject = resolvedProjectClient && selectedProject
    ? resolvedProjectClient.projects.find((project) => project.projectId === selectedProject.projectId) ?? null
    : null;

  const deliveryCreationAvailable = deliveryCreationSupported && resolvedProject !== null && resolvedProject.approvedRevision !== null && ((resolvedProject.deliveredRevision === null && resolvedProject.delivery === null) || (resolvedProject.deliveredRevision !== null && resolvedProject.delivery !== null));

  const deliveryCreationHelp = (() => {
    if (!resolvedProject) return "Select a project before creating a delivery.";
    if (workspace.status !== "ready" || version.status !== "ready") return "Finishing the studio checks first…";
    if (workspace.value.status !== "healthy") return "You can still read the delivery history, but fix the studio setup issues before creating a package.";
    if (!version.value.deliveryCreationSupported) return version.value.message;
    if (resolvedProject.approvedRevision === null) return "Approve a revision before creating the first delivery package.";
    if (resolvedProject.deliveredRevision !== null && resolvedProject.delivery !== null) return "Preview a same-path overwrite that preserves edited Delivery Notes and unrelated package files; optionally rebuild the ZIP.";
    return "Preview the first delivery package, then create it with SHA-256 file verification and an optional ZIP.";
  })();

  const baseRouteDefinition = routes.find((route) => route.id === activeRoute) ?? routes[0];
  const activeRouteDefinition: RouteDefinition = resolvedProject
    ? {
        id: "projects",
        label: "Projects",
        eyebrow: projectRouteCopy[projectView].eyebrow,
        title: resolvedProject.projectName,
        description: `${resolvedProject.artist} · ${projectRouteCopy[projectView].description}`,
      }
    : resolvedClient
      ? { id: "clients", label: "Clients", eyebrow: "Client details", title: resolvedClient.clientName, description: "Client details, defaults, and projects in your studio." }
      : baseRouteDefinition;

  return { resolvedClient, resolvedProjectClient, resolvedProject, deliveryCreationAvailable, deliveryCreationHelp, activeRouteDefinition };
}
