import type { DerivedTask, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";

export type OverviewTone = "good" | "attention" | "neutral";

export interface OverviewStatus {
  label: string;
  detail: string;
  tone: OverviewTone;
}

export const formatOverviewDate = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

export const formatOverviewDateTime = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export const getProjectLastModified = (project: ProjectSummary) => {
  const timestamps = [
    project.createdAt,
    project.delivery?.createdAt,
    ...project.revisions.flatMap((revision) => [revision.createdAt, revision.approvedAt]),
  ].filter((value): value is string => Boolean(value));
  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? project.createdAt;
};

export const getIntakeOverviewStatus = (state: IntakeReportState): OverviewStatus & { fileCount: number | null } => {
  if (state.status === "loading") return { label: "Checking", detail: "Loading intake status", tone: "neutral", fileCount: null };
  if (state.status === "error") return { label: "Needs attention", detail: state.message, tone: "attention", fileCount: null };
  if (state.status === "idle") return { label: "Not validated", detail: "No intake report loaded", tone: "neutral", fileCount: null };
  if (!state.value.report) return { label: "Not validated", detail: state.value.message, tone: "neutral", fileCount: null };
  const report = state.value.report;
  if (report.blockingErrors > 0) return { label: "Needs attention", detail: `${report.blockingErrors} blocking finding${report.blockingErrors === 1 ? "" : "s"}`, tone: "attention", fileCount: report.filesDiscovered };
  if (report.warnings > 0) return { label: "Review", detail: `${report.warnings} warning${report.warnings === 1 ? "" : "s"}`, tone: "attention", fileCount: report.filesDiscovered };
  return { label: "Validated", detail: `${report.filesDiscovered} file${report.filesDiscovered === 1 ? "" : "s"}`, tone: "good", fileCount: report.filesDiscovered };
};

export const getTaskOverviewStatus = (tasks: DerivedTask[]): OverviewStatus => {
  if (tasks.length === 0) return { label: "Clear", detail: "No open project tasks", tone: "good" };
  return { label: "Needs attention", detail: `${tasks.length} open task${tasks.length === 1 ? "" : "s"}`, tone: "attention" };
};

export const getRevisionOverviewStatus = (project: ProjectSummary): OverviewStatus => {
  const current = `Revision ${String(project.currentRevision).padStart(2, "0")}`;
  if (project.approvedRevision === project.currentRevision) return { label: "Approved", detail: `${current} approved`, tone: "good" };
  return { label: "Current", detail: current, tone: "neutral" };
};

export const getDeliveryOverviewStatus = (project: ProjectSummary): OverviewStatus => {
  if (project.deliveredRevision === project.currentRevision) return { label: "Delivered", detail: `Revision ${String(project.currentRevision).padStart(2, "0")}`, tone: "good" };
  if (project.approvedRevision === null) return { label: "Waiting", detail: "Approve a revision before delivery", tone: "neutral" };
  return { label: "Ready", detail: `Approved revision ${String(project.approvedRevision).padStart(2, "0")}`, tone: "good" };
};
