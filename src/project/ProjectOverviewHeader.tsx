import type { ClientSummary, ProjectSummary } from "../types";
import { formatOverviewDate } from "./ProjectOverviewModel";

const revisionLabel = (value: number | null) => value === null ? "—" : String(value).padStart(2, "0");

export function ProjectOverviewHeader({ client, project, workspacePath }: { client: ClientSummary; project: ProjectSummary; workspacePath: string }) {
  const deliveryLabel = project.deliveredRevision === project.currentRevision
    ? "Delivered"
    : project.approvedRevision === null
      ? "Waiting for approval"
      : "Ready to package";

  return (
    <section className="overview-project-header" aria-label="Project identity and status">
      <div className="overview-project-identity">
        <div className="overview-project-icon" aria-hidden="true">♫</div>
        <div>
          <h1>{project.projectName}</h1>
          <p><strong>Client:</strong> {client.clientName}<span aria-hidden="true">·</span><strong>Artist:</strong> {project.artist}<span aria-hidden="true">·</span><strong>Created:</strong> {formatOverviewDate(project.createdAt)}</p>
        </div>
      </div>
      <div className="overview-workspace-block">
        <span>Workspace</span>
        <code>{workspacePath}</code>
      </div>
      <dl className="overview-header-status">
        <div><dt>Revisions</dt><dd>{project.revisions.length}</dd></div>
        <div><dt>Current</dt><dd>{revisionLabel(project.currentRevision)}</dd></div>
        <div className="wide"><dt>Delivery</dt><dd>{deliveryLabel}</dd></div>
      </dl>
    </section>
  );
}
