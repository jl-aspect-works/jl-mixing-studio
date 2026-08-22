import { useEffect, useState } from "react";
import { addWorkspaceRefreshListener } from "../app/workspaceRefreshEvents";
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

const projectOverviewFileIndexCache = new Map<string, ProjectOverviewFileIndex>();
const cacheKey = (clientId: string, projectId: string) => `${clientId}\u0000${projectId}`;

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

const fromSummary = (summary: Awaited<ReturnType<typeof summarizeProjectFiles>>): ProjectOverviewFileIndex => ({
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

export function useProjectOverviewFileIndex(clientId: string, projectId: string) {
  const key = cacheKey(clientId, projectId);
  const [index, setIndex] = useState<ProjectOverviewFileIndex>(() =>
    projectOverviewFileIndexCache.get(key) ?? emptyProjectOverviewFileIndex(),
  );

  useEffect(() => {
    let cancelled = false;
    const cached = projectOverviewFileIndexCache.get(key);
    setIndex(cached ?? emptyProjectOverviewFileIndex());

    const load = () => {
      void summarizeProjectFiles({ clientId, projectId })
        .then((summary) => {
          if (cancelled) return;
          const next = fromSummary(summary);
          projectOverviewFileIndexCache.set(key, next);
          setIndex(next);
        })
        .catch(() => {
          if (!cancelled) setIndex((current) => ({ ...current, status: "error" }));
        });
    };

    load();
    const removeRefreshListener = addWorkspaceRefreshListener(load);

    return () => {
      cancelled = true;
      removeRefreshListener();
    };
  }, [clientId, key, projectId]);

  return index;
}
