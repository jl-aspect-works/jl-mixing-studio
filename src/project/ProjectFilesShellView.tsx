import type { ClientSummary, ProjectSummary } from "../types";
import { FolderControl } from "../AppShellViews";
import { ProjectBreadcrumbs } from "./ProjectBreadcrumbs";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import type { ProjectShellView } from "./ProjectView";

export function ProjectFilesShellView({ client, project, onProjects, onOverview, onSelectView }: { client: ClientSummary; project: ProjectSummary; onProjects: () => void; onOverview: () => void; onSelectView: (view: ProjectShellView) => void }) {
  return <><div className="detail-navigation-row"><ProjectBreadcrumbs project={project} screen="Files" onProjects={onProjects} onOverview={onOverview} /></div><ProjectNavigationBar active="files" onSelect={onSelectView} /><section className="directory-toolbar"><div><p className="kicker">{client.clientName}</p><h2>Files</h2></div></section><section className="empty-state"><h2>Project file workspace</h2><p>The project-wide Files browser will be implemented in issue #195 on top of the shared file service.</p></section><FolderControl location="project" clientId={client.clientId} projectId={project.projectId} /></>;
}
