import type { WorkspaceSnapshot } from "../types";
import type { IntakeReportState, ResourceState } from "../AppShellViews";
import { ProjectsRoute } from "./ProjectViews";
import { ProjectRouteContent, type ProjectRouteContentProps } from "./ProjectRouteContent";

export interface AppProjectSectionProps extends Omit<ProjectRouteContentProps, "client" | "project" | "workspacePath" | "projectTasks"> {
  workspace: ResourceState<WorkspaceSnapshot>;
  selected: boolean;
  client: ProjectRouteContentProps["client"] | null;
  project: ProjectRouteContentProps["project"] | null;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
  onNewProject: () => void;
  onSelectProject: (clientId: string, projectId: string) => void;
  intakeReport: IntakeReportState;
}

export function AppProjectSection({ workspace, selected, client, project, projectCreationAvailable, projectCreationHelp, onNewProject, onSelectProject, ...projectProps }: AppProjectSectionProps) {
  if (selected && client && project) {
    const snapshot = workspace.status === "ready" ? workspace.value : null;
    const projectTasks = snapshot?.tasks.filter((task) => task.clientId === client.clientId && task.projectId === project.projectId) ?? [];
    return <ProjectRouteContent client={client} project={project} workspacePath={snapshot?.workspacePath ?? ""} projectTasks={projectTasks} {...projectProps} />;
  }
  return <ProjectsRoute workspace={workspace} onRefresh={projectProps.onRefresh} loading={projectProps.loading} onNewProject={onNewProject} projectCreationAvailable={projectCreationAvailable} projectCreationHelp={projectCreationHelp} onSelectProject={onSelectProject} />;
}
