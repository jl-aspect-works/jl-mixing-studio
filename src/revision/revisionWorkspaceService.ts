import { invoke } from "@tauri-apps/api/core";

export type RevisionNotesDocument = {
  content: string;
  maxBytes: number;
};

export type RevisionDescriptionUpdateResult = {
  ok: boolean;
  message: string;
  revision: {
    clientId: string;
    projectId: string;
    revision: number;
    description: string;
  } | null;
};

type RevisionIdentity = {
  clientId: string;
  projectId: string;
  revision: number;
};

export const getRevisionNotes = (request: RevisionIdentity) =>
  invoke<RevisionNotesDocument>("get_revision_notes", { request });

export const updateRevisionNotes = (request: RevisionIdentity & { content: string }) =>
  invoke<RevisionNotesDocument>("update_revision_notes", { request });

export const updateRevisionDescription = (
  request: RevisionIdentity & { description: string },
) => invoke<RevisionDescriptionUpdateResult>("update_revision_description", { request });
