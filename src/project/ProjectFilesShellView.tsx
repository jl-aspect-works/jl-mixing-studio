import type { ClientSummary, ProjectSummary } from "../types";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import type { ProjectShellView } from "./ProjectView";
import { ProjectFilesWorkspace } from "./files/ProjectFilesWorkspace";

export function ProjectFilesShellView({ client, project, onSelectView }: { client: ClientSummary; project: ProjectSummary; onProjects: () => void; onOverview: () => void; onSelectView: (view: ProjectShellView) => void }) {
  return <>
    <ProjectNavigationBar active="files" onSelect={onSelectView} />
    <ProjectFilesWorkspace clientId={client.clientId} projectId={project.projectId} />
  </>;
}
