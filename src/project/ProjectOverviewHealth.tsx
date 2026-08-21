import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import {
  overviewAreaHasFailure,
  type ProjectOverviewFileIndex,
} from "./ProjectOverviewFileIndex";
import { projectFilePaths } from "./files/projectFileService";
import { getAudioValidationOverviewStatus, getDeliveryOverviewStatus, getIntakeOverviewStatus, getRevisionOverviewStatus, getTaskOverviewStatus, type OverviewStatus } from "./ProjectOverviewModel";

function HealthRow({ label, status }: { label: string; status: OverviewStatus }) {
  return <div className="overview-health-row"><span className={`overview-status-dot ${status.tone}`} aria-hidden="true"/><strong>{label}</strong><span>{status.label}</span><small>{status.detail}</small></div>;
}

const getAudioPrepStatus = (fileIndex: ProjectOverviewFileIndex, validation: OverviewStatus): OverviewStatus => {
  if (validation.tone === "attention") return validation;
  if (fileIndex.status === "loading") return { label: "Checking", detail: "Reading Audio Prep files", tone: "neutral" };
  if (overviewAreaHasFailure(fileIndex, projectFilePaths.audioPreparation)) {
    return { label: "Unavailable", detail: "Audio Prep files could not be indexed", tone: "neutral" };
  }
  const count = fileIndex.workingAudioAreaPresent
    ? fileIndex.workingAudioCount
    : fileIndex.folders.audioPreparation.fileCount;
  if (count === 0) {
    return { label: "Empty", detail: fileIndex.workingAudioAreaPresent ? "No working audio files" : "No Audio Prep files", tone: "neutral" };
  }
  if (validation.label === "Validated") return validation;
  return {
    label: "Available",
    detail: fileIndex.workingAudioAreaPresent
      ? `${count} working audio ${count === 1 ? "file" : "files"}`
      : `${count} Audio Prep ${count === 1 ? "file" : "files"}`,
    tone: "good",
  };
};

export function ProjectOverviewHealth({ project, tasks, intakeReport, fileIndex }: { project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState; fileIndex: ProjectOverviewFileIndex }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const audioValidation = getAudioValidationOverviewStatus(intakeReport);
  const taskStatus = getTaskOverviewStatus(tasks);
  const revisionStatus = getRevisionOverviewStatus(project);
  const deliveryStatus = getDeliveryOverviewStatus(project);
  const audioPrepStatus = getAudioPrepStatus(fileIndex, audioValidation);
  const overallAttention = audioValidation.tone === "attention" || taskStatus.tone === "attention";

  return (
    <section className="overview-card overview-health-card" aria-labelledby="overview-health-heading">
      <div className="overview-card-heading"><h2 id="overview-health-heading">Project Health</h2><span className={`overview-status-pill ${overallAttention ? "attention" : "good"}`}>{overallAttention ? "Needs Attention" : "On Track"}</span></div>
      <p>{overallAttention ? "Review the highlighted project items below." : "No critical project workflow issues are currently surfaced."}</p>
      <div className="overview-health-list">
        <HealthRow label="Client Files / Intake" status={intake} />
        <HealthRow label="Audio Prep" status={audioPrepStatus} />
        <HealthRow label="Tasks" status={taskStatus} />
        <HealthRow label="Revisions" status={revisionStatus} />
        <HealthRow label="Delivery" status={deliveryStatus} />
      </div>
    </section>
  );
}
