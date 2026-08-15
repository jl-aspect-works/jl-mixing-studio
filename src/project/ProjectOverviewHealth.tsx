import { useEffect, useState } from "react";
import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { listProjectFiles, projectFilePaths } from "./files/projectFileService";
import { getDeliveryOverviewStatus, getIntakeOverviewStatus, getRevisionOverviewStatus, getTaskOverviewStatus, type OverviewStatus } from "./ProjectOverviewModel";

function HealthRow({ label, status }: { label: string; status: OverviewStatus }) {
  return <div className="overview-health-row"><span className={`overview-status-dot ${status.tone}`} aria-hidden="true"/><strong>{label}</strong><span>{status.label}</span><small>{status.detail}</small></div>;
}

const countWorkingAudio = async (clientId: string, projectId: string, relativePath: string, visited = new Set<string>(), depth = 0): Promise<number> => {
  if (depth > 16 || visited.has(relativePath)) return 0;
  visited.add(relativePath);
  const listing = await listProjectFiles({ clientId, projectId, relativePath });
  let count = listing.entries.filter((entry) => entry.entryType === "file").length;
  const nested = await Promise.all(listing.entries
    .filter((entry) => entry.entryType === "directory")
    .map((entry) => countWorkingAudio(clientId, projectId, entry.relativePath, visited, depth + 1)));
  count += nested.reduce((total, value) => total + value, 0);
  return count;
};

export function ProjectOverviewHealth({ clientId, project, tasks, intakeReport }: { clientId: string; project: ProjectSummary; tasks: DerivedTask[]; intakeReport: IntakeReportState }) {
  const intake = getIntakeOverviewStatus(intakeReport);
  const taskStatus = getTaskOverviewStatus(tasks);
  const revisionStatus = getRevisionOverviewStatus(project);
  const deliveryStatus = getDeliveryOverviewStatus(project);
  const [audioPrepStatus, setAudioPrepStatus] = useState<OverviewStatus>({ label: "Checking", detail: "Reading working audio", tone: "neutral" });

  useEffect(() => {
    let cancelled = false;
    setAudioPrepStatus({ label: "Checking", detail: "Reading working audio", tone: "neutral" });
    countWorkingAudio(clientId, project.projectId, projectFilePaths.audioPreparationWorking)
      .then((count) => {
        if (cancelled) return;
        setAudioPrepStatus(count > 0
          ? { label: "Available", detail: `${count} working audio ${count === 1 ? "file" : "files"}`, tone: "good" }
          : { label: "Empty", detail: "No working audio files", tone: "neutral" });
      })
      .catch(() => {
        if (!cancelled) setAudioPrepStatus({ label: "Unavailable", detail: "Working audio could not be indexed", tone: "neutral" });
      });
    return () => { cancelled = true; };
  }, [clientId, project.projectId]);

  const overallAttention = intake.tone === "attention" || taskStatus.tone === "attention";

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
