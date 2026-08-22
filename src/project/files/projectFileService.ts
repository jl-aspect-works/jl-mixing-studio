import { invoke } from "@tauri-apps/api/core";
import type { FolderLocation, FolderResult } from "../../types";
import { stopActiveAudioPlayback } from "./audioPlaybackController";

export type ProjectFileArea =
  | "projectRoot"
  | "admin"
  | "clientOriginalDelivery"
  | "clientReferences"
  | "clientDocumentation"
  | "audioPreparation"
  | "dawProject"
  | "revisions"
  | "finalDelivery"
  | "recall"
  | "otherManaged";

export type ProjectFileEntryType = "file" | "directory" | "symlink" | "other";

export type ProjectFilePermissions = {
  canOpen: boolean;
  canReveal: boolean;
  canRename: boolean;
  canDelete: boolean;
  canCopy: boolean;
};

export type ProjectFileEntry = {
  id: string;
  relativePath: string;
  displayName: string;
  extension: string | null;
  entryType: ProjectFileEntryType;
  area: ProjectFileArea;
  sizeBytes: number | null;
  modifiedEpochMs: number | null;
  isAudio: boolean;
  playable: boolean;
  permissions: ProjectFilePermissions;
};

export type ProjectFileListing = {
  relativePath: string;
  area: ProjectFileArea;
  permissions: ProjectFilePermissions;
  entries: ProjectFileEntry[];
};

export type ProjectFileFolderSummary = {
  fileCount: number;
  sizeBytes: number;
};

export type ProjectFileSummary = {
  clientFiles: ProjectFileFolderSummary;
  audioPreparation: ProjectFileFolderSummary;
  dawProject: ProjectFileFolderSummary;
  revisions: ProjectFileFolderSummary;
  finalDelivery: ProjectFileFolderSummary;
  recall: ProjectFileFolderSummary;
  referencesCount: number;
  workingAudioCount: number;
  workingAudioAreaPresent: boolean;
  failedPaths: string[];
};

export type ProjectFileListRequest = {
  clientId: string;
  projectId: string;
  relativePath?: string;
};

export type ProjectFileMutationRequest = {
  clientId: string;
  projectId: string;
  relativePath: string;
};

export type ProjectFileMutationResult = {
  relativePath: string;
};

export const projectFilePaths = {
  projectRoot: "",
  admin: "00_Admin",
  originalDelivery: "01_Client_Files/Original_Delivery",
  references: "01_Client_Files/References",
  clientDocumentation: "01_Client_Files/Documentation",
  audioPreparation: "02_Audio_Preparation",
  audioPreparationWorking: "02_Audio_Preparation/Working_Audio",
  audioPreparationRejected: "02_Audio_Preparation/Rejected_Files",
  dawProject: "03_DAW_Project",
  revisions: "04_Revisions",
  finalDelivery: "05_Final_Delivery",
  recall: "06_Recall",
} as const;

const nativePreviewExtensions = new Set(["wav", "wave", "aif", "aiff", "mp3"]);
let nativePreviewSupport: Promise<boolean> | null = null;

const isManagedRevisionFile = (entry: ProjectFileEntry) => {
  if (entry.area !== "revisions" || entry.entryType !== "file" || entry.displayName === "Revision_Notes.md") {
    return false;
  }
  const components = entry.relativePath.split("/");
  return components.length >= 3
    && components[0] === projectFilePaths.revisions
    && /^Revision_\d{2,}$/.test(components[1]);
};

const withManagedMutationPermissions = (listing: ProjectFileListing): ProjectFileListing => ({
  ...listing,
  entries: listing.entries.map((entry) => isManagedRevisionFile(entry)
    ? {
        ...entry,
        permissions: {
          ...entry.permissions,
          canRename: true,
          canDelete: true,
        },
      }
    : entry),
});

const isNativePreviewCandidate = (entry: ProjectFileEntry) =>
  entry.entryType === "file"
  && entry.isAudio
  && !entry.playable
  && entry.extension !== null
  && nativePreviewExtensions.has(entry.extension.toLowerCase());

const nativePreviewSupported = () => {
  if (!nativePreviewSupport) {
    nativePreviewSupport = invoke<{ supported: boolean }>("get_native_project_audio_preview_status")
      .then((status) => status.supported)
      .catch(() => false);
  }
  return nativePreviewSupport;
};

const withNativePlaybackEligibility = async (listing: ProjectFileListing): Promise<ProjectFileListing> => {
  if (!listing.entries.some(isNativePreviewCandidate)) return listing;
  if (!(await nativePreviewSupported())) return listing;
  return {
    ...listing,
    entries: listing.entries.map((entry) => isNativePreviewCandidate(entry)
      ? { ...entry, playable: true }
      : entry),
  };
};

export const listProjectFiles = ({ clientId, projectId, relativePath = "" }: ProjectFileListRequest) =>
  invoke<ProjectFileListing>("list_project_files", {
    request: { clientId, projectId, relativePath },
  })
    .then(withManagedMutationPermissions)
    .then(withNativePlaybackEligibility);

export const summarizeProjectFiles = ({ clientId, projectId }: ProjectFileListRequest) =>
  invoke<ProjectFileSummary>("summarize_project_files", {
    request: { clientId, projectId, relativePath: "" },
  });

export const openProjectFile = ({ clientId, projectId, relativePath }: ProjectFileMutationRequest) =>
  invoke<ProjectFileMutationResult>("open_project_file", {
    request: { clientId, projectId, relativePath },
  });

export const revealProjectFile = ({ clientId, projectId, relativePath }: ProjectFileMutationRequest) =>
  invoke<ProjectFileMutationResult>("reveal_project_file", {
    request: { clientId, projectId, relativePath },
  });

export const openManagedProjectFolder = (
  { clientId, projectId }: ProjectFileListRequest,
  location: Extract<FolderLocation, "audioPrep" | "references">,
) => invoke<FolderResult>("open_folder", {
  request: { location, clientId, projectId },
});

export const addProjectReference = ({ clientId, projectId }: ProjectFileListRequest) =>
  invoke<ProjectFileMutationResult | null>("add_project_reference", {
    request: { clientId, projectId, relativePath: projectFilePaths.references },
  });

export const deleteProjectReference = async ({ clientId, projectId, relativePath }: ProjectFileMutationRequest) => {
  await stopActiveAudioPlayback();
  return invoke<ProjectFileMutationResult>("delete_project_reference", {
    request: { clientId, projectId, relativePath },
  });
};

export const renameAudioPrepFile = async (
  { clientId, projectId, relativePath }: ProjectFileMutationRequest,
  newName: string,
) => {
  await stopActiveAudioPlayback();
  return invoke<ProjectFileMutationResult>("rename_project_file", {
    request: { clientId, projectId, relativePath, newName },
  });
};

export const deleteAudioPrepFile = async ({ clientId, projectId, relativePath }: ProjectFileMutationRequest) => {
  await stopActiveAudioPlayback();
  return invoke<ProjectFileMutationResult>("delete_project_file", {
    request: { clientId, projectId, relativePath },
  });
};

export const renameRevisionFile = async (
  { clientId, projectId, relativePath }: ProjectFileMutationRequest,
  newName: string,
) => {
  await stopActiveAudioPlayback();
  return invoke<ProjectFileMutationResult>("rename_revision_file", {
    request: { clientId, projectId, relativePath, newName },
  });
};

export const deleteRevisionFile = async ({ clientId, projectId, relativePath }: ProjectFileMutationRequest) => {
  await stopActiveAudioPlayback();
  return invoke<ProjectFileMutationResult>("delete_revision_file", {
    request: { clientId, projectId, relativePath },
  });
};

export const formatProjectFileSize = (sizeBytes: number | null) => {
  if (sizeBytes === null) return "—";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = sizeBytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
};

export const formatProjectFileModified = (modifiedEpochMs: number | null) => {
  if (modifiedEpochMs === null) return "—";
  const date = new Date(modifiedEpochMs);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("month")}/${value("day")}/${value("year")} ${value("hour")}:${value("minute")}${value("dayPeriod").toLowerCase()}`;
};
