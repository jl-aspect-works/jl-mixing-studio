import type { ClientSummary, ProjectSummary } from "../types";
import { FolderControl } from "../AppShellViews";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import type { ProjectShellView } from "./ProjectView";
import { ProjectFilesWorkspace } from "./files/ProjectFilesWorkspace";

export function ProjectFilesShellView({ client, project, onSelectView }: { client: ClientSummary; project: ProjectSummary; onProjects: () => void; onOverview: () => void; onSelectView: (view: ProjectShellView) => void }) {
  return <>
    <ProjectNavigationBar active="files" onSelect={onSelectView} />
    <section className="directory-toolbar">
      <div>
        <p className="kicker">{client.clientName}</p>
        <h2>Files</h2>
      </div>
      <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} />
    </section>
    <ProjectFilesWorkspace clientId={client.clientId} projectId={project.projectId} />
  </>;
}
