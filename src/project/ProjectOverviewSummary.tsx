import { useEffect, useState } from "react";
import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { listProjectFiles, projectFilePaths } from "./files/projectFileService";
import { formatOverviewDate, formatOverviewDateTime, getIntakeOverviewStatus, getProjectLastModified, overviewString } from "./ProjectOverviewModel";

const revisionLabel = (value: number) => String(value).padStart(2, "0");

type FileMetric = { count: number | null; state: "loading" | "ready" | "error" };

const countFiles = async (clientId: string, projectId: string, relativePath: string, visited = new Set<string>(), depth = 0): Promise<number> => {
  if (depth > 16 || visited.has(relativePath)) return 0;
  visited.add(relativePath);
  const listing = await listProjectFiles({ clientId, projectId, relativePath });
  let count = listing.entries.filter((entry) => entry.entryType === "file").length;
  const nested = await Promise.all(listing.entries
    .filter((entry) => entry.entryType === "directory")
    .map((entry) => countFiles(clientId, projectId, entry.relativePath, visited, depth + 1)));
  count += nested.reduce((total, value) => total + value, 0);
  return count;
};

const metricText = (metric: FileMetric, readyDetail: (count: number) => string) => {
  if (metric.state === "loading") return { value: "…", detail: "Indexing" };
  if (metric.state === "error" || metric.count === null) return { value: "—", detail: "Unavailable" };
  return { value: String(metric.count), detail: readyDetail(metric.count) };
};

export function ProjectOverviewSummary({ clientId, project, tasks, intakeReport }: { clientId: string; project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const currentRevision = project.revisions.find((revision) => revision.number === project.currentRevision);
  const [audioPrep, setAudioPrep] = useState<FileMetric>({ count: null, state: "loading" });
  const [references, setReferences] = useState<FileMetric>({ count: null, state: "loading" });

  useEffect(() => {
    let cancelled = false;
    setAudioPrep({ count: null, state: "loading" });
    setReferences({ count: null, state: "loading" });

    countFiles(clientId, project.projectId, projectFilePaths.audioPreparationWorking)
      .then((count) => { if (!cancelled) setAudioPrep({ count, state: "ready" }); })
      .catch(() => { if (!cancelled) setAudioPrep({ count: null, state: "error" }); });
    countFiles(clientId, project.projectId, projectFilePaths.references)
      .then((count) => { if (!cancelled) setReferences({ count, state: "ready" }); })
      .catch(() => { if (!cancelled) setReferences({ count: null, state: "error" }); });

    return () => { cancelled = true; };
  }, [clientId, project.projectId]);

  const audioPrepMetric = metricText(audioPrep, (count) => count === 0 ? "No working audio" : "Working audio");
  const referenceMetric = metricText(references, (count) => count === 0 ? "No references" : `${count} available`);
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
