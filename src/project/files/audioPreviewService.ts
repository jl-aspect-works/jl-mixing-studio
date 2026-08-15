import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { ProjectFileMutationRequest } from "./projectFileService";

export type ProjectAudioPreviewResult = {
  supported: boolean;
  relativePath: string;
  filePath: string | null;
};

export type PreparedAudioPreview = {
  relativePath: string;
  sourceUrl: string;
};

export async function prepareProjectAudioPreview(
  request: ProjectFileMutationRequest,
): Promise<PreparedAudioPreview | null> {
  const result = await invoke<ProjectAudioPreviewResult>("prepare_project_audio_preview", {
    request,
  });
  if (!result.supported || !result.filePath) return null;
  return {
    relativePath: result.relativePath,
    sourceUrl: convertFileSrc(result.filePath),
  };
}
