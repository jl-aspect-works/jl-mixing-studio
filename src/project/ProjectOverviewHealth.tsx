import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { getDeliveryOverviewStatus, getIntakeOverviewStatus, getRevisionOverviewStatus, getTaskOverviewStatus, type OverviewStatus } from "./ProjectOverviewModel";

function HealthRow({ label, status }: { label: string; status: OverviewStatus }) {
  return <div className="overview-health-row"><span className={`overview-status-dot ${status.tone}`} aria-hidden="true"/><strong>{label}</strong><span>{status.label}</span><small>{status.detail}</small></div>;
}

export function ProjectOverviewHealth({ project, tasks, intakeReport }: { project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const taskStatus = getTaskOverviewStatus(tasks);
  const revisionStatus = getRevisionOverviewStatus(project);
  const deliveryStatus = getDeliveryOverviewStatus(project);
  const overallAttention = intake.tone === "attention" || taskStatus.tone === "attention";

  return (
    <section className="overview-card overview-health-card" aria-labelledby="overview-health-heading">
      <div className="overview-card-heading"><h2 id="overview-health-heading">Project Health</h2><span className={`overview-status-pill ${overallAttention ? "attention" : "good"}`}>{overallAttention ? "Needs Attention" : "On Track"}</span></div>
      <p>{overallAttention ? "Review the highlighted project items below." : "No critical project workflow issues are currently surfaced."}</p>
      <div className="overview-health-list">
        <HealthRow label="Client Files / Intake" status={intake} />
        <HealthRow label="Audio Prep" status={{ label: "Pending", detail: "File index not available yet", tone: "neutral" }} />
        <HealthRow label="Tasks" status={taskStatus} />
        <HealthRow label="Revisions" status={revisionStatus} />
        <HealthRow label="Delivery" status={deliveryStatus} />
      </div>
    </section>
  );
}
