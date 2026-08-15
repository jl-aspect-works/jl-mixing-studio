import { useEffect, useState } from "react";
import {
  listProjectFiles,
  projectFilePaths,
  type ProjectFileEntry,
} from "./files/projectFileService";

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

const folderPrefixes: Array<[ProjectOverviewFolderKey, string]> = [
  ["clientFiles", "01_Client_Files"],
  ["audioPreparation", projectFilePaths.audioPreparation],
  ["dawProject", projectFilePaths.dawProject],
  ["revisions", projectFilePaths.revisions],
  ["finalDelivery", projectFilePaths.finalDelivery],
  ["recall", projectFilePaths.recall],
];

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

const accountFile = (index: ProjectOverviewFileIndex, entry: ProjectFileEntry) => {
  for (const [key, prefix] of folderPrefixes) {
    if (pathMatches(entry.relativePath, prefix)) {
      index.folders[key].fileCount += 1;
      index.folders[key].sizeBytes += entry.sizeBytes ?? 0;
      break;
    }
  }
  if (pathMatches(entry.relativePath, projectFilePaths.references)) index.referencesCount += 1;
  if (pathMatches(entry.relativePath, projectFilePaths.audioPreparationWorking)) index.workingAudioCount += 1;
};

const buildProjectOverviewFileIndex = async (clientId: string, projectId: string): Promise<ProjectOverviewFileIndex> => {
  const index: ProjectOverviewFileIndex = {
    status: "ready",
    folders: emptyFolders(),
    referencesCount: 0,
    workingAudioCount: 0,
    workingAudioAreaPresent: false,
    failedPaths: [],
  };
  const visited = new Set<string>();

  const walk = async (relativePath: string, depth = 0): Promise<void> => {
    if (depth > 16 || visited.has(relativePath)) return;
    visited.add(relativePath);

    let listing;
    try {
      listing = await listProjectFiles({ clientId, projectId, relativePath });
    } catch {
      if (relativePath === "") throw new Error("Project files could not be indexed");
      index.failedPaths.push(relativePath);
      return;
    }

    const directories: ProjectFileEntry[] = [];
    for (const entry of listing.entries) {
      if (entry.entryType === "file") {
        accountFile(index, entry);
      } else if (entry.entryType === "directory") {
        if (entry.relativePath === projectFilePaths.audioPreparationWorking) {
          index.workingAudioAreaPresent = true;
        }
        directories.push(entry);
      }
    }

    await Promise.all(directories.map((entry) => walk(entry.relativePath, depth + 1)));
  };

  try {
    await walk("");
  } catch {
    return { ...index, status: "error" };
  }

  index.status = index.failedPaths.length > 0 ? "partial" : "ready";
  return index;
};

export const overviewAreaHasFailure = (index: ProjectOverviewFileIndex, prefix: string) =>
  index.status === "error" || index.failedPaths.some((path) =>
    pathMatches(path, prefix) || pathMatches(prefix, path),
  );

export function useProjectOverviewFileIndex(clientId: string, projectId: string) {
  const [index, setIndex] = useState<ProjectOverviewFileIndex>(emptyProjectOverviewFileIndex);

  useEffect(() => {
    let cancelled = false;
    setIndex(emptyProjectOverviewFileIndex());
    void buildProjectOverviewFileIndex(clientId, projectId).then((next) => {
      if (!cancelled) setIndex(next);
    });
    return () => { cancelled = true; };
  }, [clientId, projectId]);

  return index;
}
