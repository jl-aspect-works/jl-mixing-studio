import type { ClientSummary, ProjectSummary } from "../types";
import { prefetchDeliveryReads } from "../delivery/deliveryReadCache";
import { prefetchRevisionNotes } from "../revision/revisionWorkspaceService";
import { projectFilePaths } from "./files/projectFileService";
import { prefetchProjectFiles } from "./files/useProjectFiles";

const revisionFolder = (revision: number) => `${projectFilePaths.revisions}/Revision_${String(revision).padStart(2, "0")}`;

/**
 * Warm secondary project tabs without competing with the initial Overview load.
 * Work is deliberately sequential, with the Automation-backed delivery reconciliation last.
 */
export const prefetchProjectTabs = async (client: ClientSummary, project: ProjectSummary) => {
  const identity = { clientId: client.clientId, projectId: project.projectId };

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

  try {
    await prefetchDeliveryReads(client.clientId, project.projectId, Boolean(project.delivery));
  } catch {
    // Prefetch is opportunistic.
  }
};
