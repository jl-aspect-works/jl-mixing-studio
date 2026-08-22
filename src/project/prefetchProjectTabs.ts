import type { ClientSummary, ProjectSummary } from "../types";
import { prefetchDeliveryReads } from "../delivery/deliveryReadCache";
import { prefetchRevisionNotes } from "../revision/revisionWorkspaceService";
import { projectFilePaths } from "./files/projectFileService";
import { prefetchProjectFiles } from "./files/useProjectFiles";

const revisionFolder = (revision: number) => `${projectFilePaths.revisions}/Revision_${String(revision).padStart(2, "0")}`;

/**
 * Warm secondary project tabs without competing with the initial Overview load.
 * Work is deliberately sequential. Delivery goes first because its Automation-backed
 * reconciliation is the highest-latency secondary read and the Delivery screen can join
 * an in-flight request through the shared cache.
 */
export const prefetchProjectTabs = async (client: ClientSummary, project: ProjectSummary) => {
  const identity = { clientId: client.clientId, projectId: project.projectId };

  try {
    await prefetchDeliveryReads(client.clientId, project.projectId, Boolean(project.delivery));
  } catch {
    // Prefetch is opportunistic; the tab owns user-visible error handling.
  }

  try {
    await prefetchProjectFiles({ ...identity, relativePath: projectFilePaths.references });
  } catch {
    // Prefetch is opportunistic; the tab owns user-visible error handling.
  }

  if (project.currentRevision > 0) {
    try {
      await prefetchRevisionNotes({ ...identity, revision: project.currentRevision });
    } catch {
      // Prefetch is opportunistic.
    }
    try {
      await prefetchProjectFiles({ ...identity, relativePath: revisionFolder(project.currentRevision) });
    } catch {
      // Prefetch is opportunistic.
    }
  }
};
