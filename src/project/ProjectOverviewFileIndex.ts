import { useEffect, useState } from "react";
import { summarizeProjectFiles } from "./files/projectFileService";

export type ProjectOverviewFolderKey =
  | "clientFiles"
  | "audioPreparation"
  | "dawProject"
  | "revisions"
  | "finalDelivery"
  | "recall";

export type ProjectOverviewFolderSummary = {
  fileCount: number;
  sizeBytes: number;
};

export type ProjectOverviewFileIndex = {
  status: "loading" | "ready" | "partial" | "error";
  folders: Record<ProjectOverviewFolderKey, ProjectOverviewFolderSummary>;
  referencesCount: number;
  workingAudioCount: number;
  workingAudioAreaPresent: boolean;
  failedPaths: string[];
};

const emptyFolders = (): Record<ProjectOverviewFolderKey, ProjectOverviewFolderSummary> => ({
  clientFiles: { fileCount: 0, sizeBytes: 0 },
  audioPreparation: { fileCount: 0, sizeBytes: 0 },
  dawProject: { fileCount: 0, sizeBytes: 0 },
  revisions: { fileCount: 0, sizeBytes: 0 },
  finalDelivery: { fileCount: 0, sizeBytes: 0 },
  recall: { fileCount: 0, sizeBytes: 0 },
});

export const emptyProjectOverviewFileIndex = (): ProjectOverviewFileIndex => ({
  status: "loading",
  folders: emptyFolders(),
  referencesCount: 0,
  workingAudioCount: 0,
  workingAudioAreaPresent: false,
  failedPaths: [],
});

const pathMatches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export const overviewAreaHasFailure = (index: ProjectOverviewFileIndex, prefix: string) =>
  index.status === "error" || index.failedPaths.some((path) =>
    pathMatches(path, prefix) || pathMatches(prefix, path),
  );

export function useProjectOverviewFileIndex(clientId: string, projectId: string) {
  const [index, setIndex] = useState<ProjectOverviewFileIndex>(emptyProjectOverviewFileIndex);

  useEffect(() => {
    let cancelled = false;
    setIndex(emptyProjectOverviewFileIndex());

    void summarizeProjectFiles({ clientId, projectId })
      .then((summary) => {
        if (cancelled) return;
        setIndex({
          status: summary.failedPaths.length > 0 ? "partial" : "ready",
          folders: {
            clientFiles: summary.clientFiles,
            audioPreparation: summary.audioPreparation,
            dawProject: summary.dawProject,
            revisions: summary.revisions,
            finalDelivery: summary.finalDelivery,
            recall: summary.recall,
          },
          referencesCount: summary.referencesCount,
          workingAudioCount: summary.workingAudioCount,
          workingAudioAreaPresent: summary.workingAudioAreaPresent,
          failedPaths: summary.failedPaths,
        });
      })
      .catch(() => {
        if (!cancelled) setIndex({ ...emptyProjectOverviewFileIndex(), status: "error" });
      });

    return () => { cancelled = true; };
  }, [clientId, projectId]);

  return index;
}
