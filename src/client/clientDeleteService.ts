import { invoke } from "@tauri-apps/api/core";
import { stopActiveAudioPlayback } from "../project/files/audioPlaybackController";
import { setRevisionListeningProject } from "../revision/revisionListeningService";

export interface ClientDeleteSummary {
  client: { id: string; name: string; path: string; document_id: string };
  project_count: 0;
  file_count: number;
  total_bytes: number;
  includes: string[];
  recoverable: false;
  fingerprint: string;
}

export interface ClientDeleteResult {
  ok: boolean;
  status: string;
  message: string;
  data: {
    summary?: ClientDeleteSummary;
    deleted?: boolean;
    project_count?: number;
    partial_cleanup?: boolean;
    remaining_path?: string;
  };
}

export const getClientDeleteSupport = () => invoke<boolean>("get_client_delete_support");

export const planClientDeletion = (clientId: string) =>
  invoke<ClientDeleteResult>("plan_client_deletion", { request: { clientId } });

export async function executeClientDeletion(clientId: string, fingerprint: string, confirmedName: string) {
  await stopActiveAudioPlayback();
  await setRevisionListeningProject(null);
  return invoke<ClientDeleteResult>("execute_client_deletion", {
    request: { clientId, fingerprint, confirmedName },
  });
}
