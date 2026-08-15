import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import {
  overviewAreaHasFailure,
  type ProjectOverviewFileIndex,
} from "./ProjectOverviewFileIndex";
import { projectFilePaths } from "./files/projectFileService";
import { formatOverviewDate, formatOverviewDateTime, getIntakeOverviewStatus, getProjectLastModified, overviewString } from "./ProjectOverviewModel";

const revisionLabel = (value: number) => String(value).padStart(2, "0");

const indexedMetric = (
  loading: boolean,
  unavailable: boolean,
  count: number,
  readyDetail: (count: number) => string,
) => {
  if (loading) return { value: "…", detail: "Indexing" };
  if (unavailable) return { value: "—", detail: "Unavailable" };
  return { value: String(count), detail: readyDetail(count) };
};

export function ProjectOverviewSummary({ project, tasks, intakeReport, fileIndex }: { project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState; fileIndex: ProjectOverviewFileIndex }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const currentRevision = project.revisions.find((revision) => revision.number === project.currentRevision);
  const indexing = fileIndex.status === "loading";
  const audioPrepCount = fileIndex.workingAudioAreaPresent
    ? fileIndex.workingAudioCount
    : fileIndex.folders.audioPreparation.fileCount;
  const audioPrepMetric = indexedMetric(
    indexing,
    overviewAreaHasFailure(fileIndex, projectFilePaths.audioPreparation),
    audioPrepCount,
    (count) => fileIndex.workingAudioAreaPresent
      ? count === 0 ? "No working audio" : "Working audio"
      : count === 0 ? "No audio prep files" : "Audio prep files",
  );
  const referenceMetric = indexedMetric(
    indexing,
    overviewAreaHasFailure(fileIndex, projectFilePaths.references),
    fileIndex.referencesCount,
    (count) => count === 0 ? "No references" : `${count} available`,
  );
  const metrics = [
    { label: "Revisions", value: String(project.revisions.length), detail: project.approvedRevision === null ? "None approved" : `${revisionLabel(project.approvedRevision)} approved` },
    { label: "Current Revision", value: revisionLabel(project.currentRevision), detail: formatOverviewDateTime(overviewString(currentRevision, "createdAt")) },
    { label: "Tasks", value: String(tasks.length), detail: tasks.length === 0 ? "No open tasks" : `${tasks.length} open` },
    { label: "Client Files", value: intake.fileCount === null ? "—" : String(intake.fileCount), detail: intake.label },
    { label: "Audio Prep", value: audioPrepMetric.value, detail: audioPrepMetric.detail },
    { label: "References", value: referenceMetric.value, detail: referenceMetric.detail },
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
