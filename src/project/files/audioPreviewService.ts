import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { ProjectFileMutationRequest } from "./projectFileService";

export type ProjectAudioPreviewResult = {
  supported: boolean;
  relativePath: string;
  filePath: string | null;
};

export type NativeAudioPreviewStatus = {
  supported: boolean;
  relativePath: string | null;
  playing: boolean;
  currentSeconds: number;
  durationSeconds: number;
};

export type PreparedAudioPreview =
  | {
      provider: "web";
      relativePath: string;
      sourceUrl: string;
    }
  | {
      provider: "native";
      relativePath: string;
      sourceUrl: null;
    };

export async function prepareProjectAudioPreview(
  request: ProjectFileMutationRequest,
): Promise<PreparedAudioPreview | null> {
  const result = await invoke<ProjectAudioPreviewResult>("prepare_project_audio_preview", {
    request,
  });
  if (result.supported && result.filePath) {
    return {
      provider: "web",
      relativePath: result.relativePath,
      sourceUrl: convertFileSrc(result.filePath),
    };
  }

  const nativeStatus = await invoke<NativeAudioPreviewStatus>("get_native_project_audio_preview_status");
  if (!nativeStatus.supported) return null;
  return {
    provider: "native",
    relativePath: result.relativePath,
    sourceUrl: null,
  };
}

export const loadNativeProjectAudioPreview = (request: ProjectFileMutationRequest) =>
  invoke<NativeAudioPreviewStatus>("load_native_project_audio_preview", { request });

export const playNativeProjectAudioPreview = () =>
  invoke<NativeAudioPreviewStatus>("play_native_project_audio_preview");

export const pauseNativeProjectAudioPreview = () =>
  invoke<NativeAudioPreviewStatus>("pause_native_project_audio_preview");

export const seekNativeProjectAudioPreview = (seconds: number) =>
  invoke<NativeAudioPreviewStatus>("seek_native_project_audio_preview", { seconds });

export const setNativeProjectAudioPreviewVolume = (volume: number) =>
  invoke<NativeAudioPreviewStatus>("set_native_project_audio_preview_volume", { volume });

export const stopNativeProjectAudioPreview = () =>
  invoke<NativeAudioPreviewStatus>("stop_native_project_audio_preview");

export const getNativeProjectAudioPreviewStatus = () =>
  invoke<NativeAudioPreviewStatus>("get_native_project_audio_preview_status");
