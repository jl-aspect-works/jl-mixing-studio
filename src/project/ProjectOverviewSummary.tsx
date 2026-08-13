import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { formatOverviewDate, formatOverviewDateTime, getIntakeOverviewStatus, getProjectLastModified, overviewString } from "./ProjectOverviewModel";

const revisionLabel = (value: number) => String(value).padStart(2, "0");

export function ProjectOverviewSummary({ project, tasks, intakeReport }: { project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const currentRevision = project.revisions.find((revision) => revision.number === project.currentRevision);
  const metrics = [
    { label: "Revisions", value: String(project.revisions.length), detail: project.approvedRevision === null ? "None approved" : `${revisionLabel(project.approvedRevision)} approved` },
    { label: "Current Revision", value: revisionLabel(project.currentRevision), detail: formatOverviewDateTime(overviewString(currentRevision, "createdAt")) },
    { label: "Tasks", value: String(tasks.length), detail: tasks.length === 0 ? "No open tasks" : `${tasks.length} open` },
    { label: "Client Files", value: intake.fileCount === null ? "—" : String(intake.fileCount), detail: intake.label },
    { label: "Audio Prep", value: "—", detail: "Index pending" },
    { label: "References", value: "—", detail: "Index pending" },
  ];

  return (
    <section className="overview-card overview-summary-card" aria-labelledby="overview-summary-heading">
      <h2 id="overview-summary-heading">Project Summary</h2>
      <div className="overview-metric-grid">
        {metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}
      </div>
      <footer><span>Project created: {formatOverviewDate(project.createdAt)}</span><span>Last modified: {formatOverviewDateTime(getProjectLastModified(project))}</span></footer>
    </section>
  );
}
