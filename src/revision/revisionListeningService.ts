import { invoke } from "@tauri-apps/api/core";

export type RevisionListeningProject = {
  clientId: string;
  projectId: string;
};

export const setRevisionListeningProject = (request: RevisionListeningProject | null) =>
  invoke<void>("set_revision_listening_project", { request });
