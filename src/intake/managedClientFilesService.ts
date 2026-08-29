import { Channel, invoke } from "@tauri-apps/api/core";
import { stopActiveAudioPlayback } from "../project/files/audioPlaybackController";
import type { ManagedImportProgress } from "./models";

export type ManagedImportSourceKind = "zip" | "folder" | "files";
export type ManagedConflictDecision = "replace" | "skip";

export type ManagedPlanItem = {
  id: string;
  area: "original_delivery" | "audio_prep" | string;
  source_relative_path: string;
  destination_relative_path: string;
  action: string;
  conflict: boolean;
  destination_state: string;
  size_bytes: number;
  depends_on?: string;
};

export type ManagedPlan = {
  operation: string;
  source_kind: string;
  sources: string[];
  plan_id: string;
  files: Array<{
    relative_path: string;
    source_path?: string | null;
    zip_member?: string | null;
    size: number;
    fingerprint: string;
  }>;
  items: ManagedPlanItem[];
};

export type ManagedExecutionResult = {
  items?: Array<{ id: string; result: "created" | "replaced" | "skipped" | string }>;
  invalidations?: string[];
};

export type ManagedOperationResult = {
  ok: boolean;
  status: "success" | "planned" | "blocked" | "error" | string;
  message: string;
  data: {
    plan?: ManagedPlan;
    plan_id?: string;
    result?: ManagedExecutionResult;
    [key: string]: unknown;
  };
};

export type ManagedImportRequest = {
  clientId: string;
  projectId: string;
  sourceKind: ManagedImportSourceKind;
  sources: string[];
  planId?: string | null;
  decisions?: Record<string, ManagedConflictDecision>;
  selectedRelativePaths?: string[];
};

export type AudioPrepResetRequest = {
  clientId: string;
  projectId: string;
  relativePaths: string[];
  planId?: string | null;
  decisions?: Record<string, ManagedConflictDecision>;
};

export const chooseManagedImportSources = (sourceKind: ManagedImportSourceKind) =>
  invoke<string[]>("choose_managed_import_sources", { sourceKind });

export const planManagedImport = (
  request: ManagedImportRequest,
  onProgress?: (progress: ManagedImportProgress) => void,
) => {
  const progress = new Channel<ManagedImportProgress>();
  if (onProgress) progress.onmessage = onProgress;
  return invoke<ManagedOperationResult>("plan_managed_client_import", { request, progress });
};

export const executeManagedImport = async (
  request: ManagedImportRequest,
  onProgress?: (progress: ManagedImportProgress) => void,
) => {
  await stopActiveAudioPlayback();
  const progress = new Channel<ManagedImportProgress>();
  if (onProgress) progress.onmessage = onProgress;
  return invoke<ManagedOperationResult>("execute_managed_client_import", { request, progress });
};

export const planAudioPrepReset = (request: AudioPrepResetRequest) =>
  invoke<ManagedOperationResult>("plan_audio_prep_reset", { request });

export const executeAudioPrepReset = async (request: AudioPrepResetRequest) => {
  await stopActiveAudioPlayback();
  return invoke<ManagedOperationResult>("execute_audio_prep_reset", { request });
};

export const sourceRelativePathFromOriginalDelivery = (relativePath: string) => {
  const prefix = "01_Client_Files/Original_Delivery/";
  return relativePath.startsWith(prefix) ? relativePath.slice(prefix.length) : relativePath;
};
