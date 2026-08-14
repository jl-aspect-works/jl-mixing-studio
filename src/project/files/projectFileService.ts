import { invoke } from "@tauri-apps/api/core";

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

export type ProjectFileListRequest = {
  clientId: string;
  projectId: string;
  relativePath?: string;
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

export const listProjectFiles = ({ clientId, projectId, relativePath = "" }: ProjectFileListRequest) =>
  invoke<ProjectFileListing>("list_project_files", {
    request: { clientId, projectId, relativePath },
  });

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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(modifiedEpochMs));
};
