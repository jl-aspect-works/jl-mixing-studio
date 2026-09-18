import type { ClientSummary, ProjectSummary } from "../types";
import { CompactAudioPreview } from "./files/CompactAudioPreview";
import "./ProjectsRouteV21.css";

export interface ProjectDirectoryEntry {
  client: ClientSummary;
  project: ProjectSummary;
  hasAttention?: boolean;
}

const projectDirectoryEntryKey = (entry: ProjectDirectoryEntry) =>
  `${entry.client.clientId}:${entry.project.projectId}`;

const compactRevision = (revision: number | null) => revision === null ? "—" : String(revision);
const revisionTooltipValue = (revision: number | null) => revision === null ? "none" : String(revision);
const revisionTooltip = (project: ProjectSummary) => `Revisions: current=${revisionTooltipValue(project.currentRevision)}, approved=${revisionTooltipValue(project.approvedRevision)}, delivered=${revisionTooltipValue(project.deliveredRevision)}`;

const projectStatus = (project: ProjectSummary, hasAttention: boolean) => {
  if (hasAttention) return "Needs Attention";
  if (project.deliveredRevision !== null) return "Delivered";
  if (project.approvedRevision !== null && project.currentRevision === project.approvedRevision) return "Approved";
  return "In Progress";
};

export function ProjectDirectoryList({
  entries,
  ariaLabel,
  selectedKey = null,
  onSelectEntry,
  onOpenProject,
}: {
  entries: ProjectDirectoryEntry[];
  ariaLabel: string;
  selectedKey?: string | null;
  onSelectEntry?: (entry: ProjectDirectoryEntry) => void;
  onOpenProject: (entry: ProjectDirectoryEntry) => void;
}) {
  return <section className="projects-v21-list" aria-label={ariaLabel}>
    <div className="projects-v21-list-head"><span>Name / Client</span><span>Preview</span><span>Revisions</span><span>Status</span></div>
    {entries.map((entry) => {
      const key = projectDirectoryEntryKey(entry);
      const active = key === selectedKey;
      const status = projectStatus(entry.project, entry.hasAttention === true);
      const selectEntry = () => onSelectEntry?.(entry);
      return <div
        key={key}
        className={`projects-v21-row${active ? " selected" : ""}`}
        data-selected={active ? "true" : "false"}
        onClick={onSelectEntry ? selectEntry : undefined}
        onKeyDown={onSelectEntry ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectEntry();
          }
        } : undefined}
        tabIndex={onSelectEntry ? 0 : undefined}
      >
        <span className="projects-v21-row-main"><a href="#project-overview" className="projects-v21-project-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenProject(entry); }}>{entry.project.projectName}</a><span className="projects-v21-row-client">{entry.client.clientName}</span></span>
        <CompactAudioPreview clientId={entry.client.clientId} projectId={entry.project.projectId} revision={entry.project.currentRevision} label={`${entry.project.projectName} current revision`} />
        <span className="projects-v21-cad" title={revisionTooltip(entry.project)} aria-label={revisionTooltip(entry.project)}>{compactRevision(entry.project.currentRevision)} / {compactRevision(entry.project.approvedRevision)} / {compactRevision(entry.project.deliveredRevision)}</span>
        <span className={`projects-v21-status projects-v21-status-${status.toLocaleLowerCase().replaceAll(" ", "-")}`}>{status}</span>
      </div>;
    })}
  </section>;
}
