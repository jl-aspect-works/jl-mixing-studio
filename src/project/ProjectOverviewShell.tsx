import type { ClientSummary, ProjectSummary } from "../types";
import { ProjectBreadcrumbs } from "./ProjectBreadcrumbs";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import { ProjectOverviewDetails } from "./ProjectOverviewDetails";
import { ProjectOverviewSummary } from "./ProjectOverviewSummary";
import type { ProjectShellView } from "./ProjectView";

export function ProjectOverviewShell({ client, project, loading, revisionCreationAvailable, revisionCreationHelp, onProjects, onRefresh, onIntake, onRevisions, onNewRevision, onSelectView }: { client: ClientSummary; project: ProjectSummary; loading: boolean; revisionCreationAvailable: boolean; revisionCreationHelp: string; onProjects: () => void; onRefresh: () => void; onIntake: () => void; onRevisions: () => void; onNewRevision: () => void; onSelectView: (view: ProjectShellView) => void }) {
  return <><div className="detail-navigation-row"><ProjectBreadcrumbs project={project} onProjects={onProjects} /><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div><ProjectNavigationBar active="overview" onSelect={onSelectView} /><ProjectOverviewSummary project={project} /><ProjectOverviewDetails client={client} project={project} onIntake={onIntake} onRevisions={onRevisions} onNewRevision={onNewRevision} revisionCreationAvailable={revisionCreationAvailable} revisionCreationHelp={revisionCreationHelp} loading={loading} /></>;
}
