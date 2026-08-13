import type { WorkspaceSnapshot } from "../types";
import type { IntakeReportState, ResourceState } from "../AppShellViews";
import { ProjectsRoute } from "./ProjectViews";
import { ProjectRouteContent, type ProjectRouteContentProps } from "./ProjectRouteContent";

export interface AppProjectSectionProps extends Omit<ProjectRouteContentProps, "client" | "project"> {
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
  if (selected && client && project) return <ProjectRouteContent client={client} project={project} {...projectProps} />;
  return <ProjectsRoute workspace={workspace} onRefresh={projectProps.onRefresh} loading={projectProps.loading} onNewProject={onNewProject} projectCreationAvailable={projectCreationAvailable} projectCreationHelp={projectCreationHelp} onSelectProject={onSelectProject} />;
}
