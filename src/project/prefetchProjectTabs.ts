import type { ClientSummary, ProjectSummary } from "../types";
import { prefetchDeliveryReads } from "../delivery/deliveryReadCache";
import { prefetchRevisionNotes } from "../revision/revisionWorkspaceService";
import { projectFilePaths } from "./files/projectFileService";
import { prefetchProjectFiles } from "./files/useProjectFiles";

const revisionFolder = (revision: number) => `${projectFilePaths.revisions}/Revision_${String(revision).padStart(2, "0")}`;

export const prefetchProjectTabs = (client: ClientSummary, project: ProjectSummary) => {
  const identity = { clientId: client.clientId, projectId: project.projectId };
  const work: Promise<unknown>[] = [
    prefetchProjectFiles({ ...identity, relativePath: projectFilePaths.references }),
  ];

  if (project.currentRevision > 0) {
    work.push(prefetchRevisionNotes({ ...identity, revision: project.currentRevision }));
    work.push(prefetchProjectFiles({ ...identity, relativePath: revisionFolder(project.currentRevision) }));
  }

  work.push(prefetchDeliveryReads(client.clientId, project.projectId, Boolean(project.delivery)));

  return Promise.allSettled(work).then(() => undefined);
};
