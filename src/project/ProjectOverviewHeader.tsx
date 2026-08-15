import type { ClientSummary, ProjectSummary } from "../types";
import { formatOverviewDate } from "./ProjectOverviewModel";
import "./ProjectOverviewHeader.css";

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
          <div className="overview-project-title">{project.projectName}</div>
          <p><strong>Client:</strong> <span>{client.clientName}</span><span aria-hidden="true">·</span><strong>Artist:</strong> <span>{project.artist}</span><span aria-hidden="true">·</span><strong>Created:</strong> {formatOverviewDate(project.createdAt)}</p>
          <small>{project.sampleRate / 1000} kHz / {project.bitDepth}-bit / {project.fileFormat}</small>
        </div>
      </div>
      <div className="overview-workspace-block">
        <span>Workspace:</span>
        <code>{workspacePath || "Workspace path unavailable"}</code>
      </div>
      <dl className="overview-header-status">
        <div><dt>Revisions:</dt><dd>{project.revisions.length}</dd></div>
        <div><dt>Current:</dt><dd>{revisionLabel(project.currentRevision)}</dd></div>
        <div className="wide"><dt>Delivery:</dt><dd>{deliveryLabel}</dd></div>
      </dl>
    </section>
  );
}
