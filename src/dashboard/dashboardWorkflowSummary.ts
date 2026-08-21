import type { WorkspaceSnapshot } from "../types";

export interface DashboardWorkflowSummary {
  awaitingReview: number;
  readyToDeliver: number;
  completed: number;
}

const projectKey = (clientId: string | null, projectId: string | null) =>
  clientId && projectId ? `${clientId}\u0000${projectId}` : null;

export function deriveDashboardWorkflowSummary(snapshot: WorkspaceSnapshot): DashboardWorkflowSummary {
  const awaitingReview = new Set<string>();
  const readyToDeliver = new Set<string>();

  for (const task of snapshot.tasks) {
    const key = projectKey(task.clientId, task.projectId);
    if (!key) continue;
    if (task.priority === "review") awaitingReview.add(key);
    if (task.priority === "delivery") readyToDeliver.add(key);
  }

  let completed = 0;
  for (const client of snapshot.clients) {
    for (const project of client.projects) {
      if (
        project.approvedRevision === project.currentRevision
        && project.deliveredRevision === project.currentRevision
      ) {
        completed += 1;
      }
    }
  }

  return {
    awaitingReview: awaitingReview.size,
    readyToDeliver: readyToDeliver.size,
    completed,
  };
}
