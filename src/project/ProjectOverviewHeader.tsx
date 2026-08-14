import type { ClientSummary, ProjectSummary } from "../types";
import { ProjectBreadcrumbs } from "./ProjectBreadcrumbs";
import "./ProjectOverviewHeader.css";

const revisionLabel = (value: number | null) => value === null ? "—" : String(value).padStart(2, "0");

export function ProjectOverviewHeader({ client, project, workspacePath, loading, onProjects, onRefresh }: { client: ClientSummary; project: ProjectSummary; workspacePath: string; loading: boolean; onProjects: () => void; onRefresh: () => void }) {
  const deliveryLabel = project.deliveredRevision === project.currentRevision
    ? "Delivered"
    : project.approvedRevision === null
      ? "Waiting for approval"
      : "Ready to package";

  return (
    <header className="overview-project-header" aria-label="Project identity and status">
      <div className="overview-project-header-topline">
        <ProjectBreadcrumbs project={project} onProjects={onProjects} />
        <button type="button" className="secondary overview-header-refresh" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      <div className="overview-project-strip">
        <div className="overview-project-identity">
          <div className="overview-project-title">{project.projectName}</div>
          <p><span>{client.clientName}</span><span aria-hidden="true">·</span><span>{project.artist}</span></p>
        </div>

        <div className="overview-workspace-block">
          <span>Workspace</span>
          <code title={workspacePath || "Workspace path unavailable"}>{workspacePath || "Workspace path unavailable"}</code>
        </div>

        <dl className="overview-header-status">
          <div><dt>Revisions</dt><dd>{project.revisions.length}</dd></div>
          <div><dt>Current</dt><dd>{revisionLabel(project.currentRevision)}</dd></div>
          <div className="wide"><dt>Delivery</dt><dd>{deliveryLabel}</dd></div>
        </dl>
      </div>
    </header>
  );
}
