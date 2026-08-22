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

const notesCache = new Map<string, RevisionNotesDocument>();
const notesInFlight = new Map<string, Promise<RevisionNotesDocument>>();
const notesKey = ({ clientId, projectId, revision }: RevisionIdentity) => `${clientId}\u0000${projectId}\u0000${revision}`;

export const getCachedRevisionNotes = (request: RevisionIdentity) => notesCache.get(notesKey(request)) ?? null;

export const getRevisionNotes = (request: RevisionIdentity) => {
  const key = notesKey(request);
  const active = notesInFlight.get(key);
  if (active) return active;
  const pending = invoke<RevisionNotesDocument>("get_revision_notes", { request })
    .then((document) => {
      notesCache.set(key, document);
      return document;
    })
    .finally(() => {
      if (notesInFlight.get(key) === pending) notesInFlight.delete(key);
    });
  notesInFlight.set(key, pending);
  return pending;
};

export const prefetchRevisionNotes = (request: RevisionIdentity) => {
  const cached = getCachedRevisionNotes(request);
  return cached ? Promise.resolve(cached) : getRevisionNotes(request);
};

export const updateRevisionNotes = (request: RevisionIdentity & { content: string }) =>
  invoke<RevisionNotesDocument>("update_revision_notes", { request }).then((document) => {
    notesCache.set(notesKey(request), document);
    return document;
  });

export const updateRevisionDescription = (
  request: RevisionIdentity & { description: string },
) => invoke<RevisionDescriptionUpdateResult>("update_revision_description", { request });
