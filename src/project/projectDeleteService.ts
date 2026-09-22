import { invoke } from "@tauri-apps/api/core";
import { stopActiveAudioPlayback } from "./files/audioPlaybackController";
import { setRevisionListeningProject } from "../revision/revisionListeningService";

export interface ProjectDeleteSummary {
  client: { id: string; name: string };
  project: { id: string; name: string; path: string; document_id: string };
  file_count: number;
  total_bytes: number;
  includes: string[];
  recoverable: false;
  external_listening_copies: "retained";
  fingerprint: string;
}

export interface ProjectDeleteResult {
  ok: boolean;
  status: string;
  message: string;
  data: { summary?: ProjectDeleteSummary; deleted?: boolean; partial_cleanup?: boolean; remaining_path?: string };
}

export const getProjectDeleteSupport = () => invoke<boolean>("get_project_delete_support");

export const planProjectDeletion = (clientId: string, projectId: string) =>
  invoke<ProjectDeleteResult>("plan_project_deletion", { request: { clientId, projectId } });

export async function executeProjectDeletion(clientId: string, projectId: string, fingerprint: string, confirmedName: string) {
  await stopActiveAudioPlayback();
  await setRevisionListeningProject(null);
  return invoke<ProjectDeleteResult>("execute_project_deletion", { request: { clientId, projectId, fingerprint, confirmedName } });
}
