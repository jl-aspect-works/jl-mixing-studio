import { invoke } from "@tauri-apps/api/core";
import type { DeliveryNotesDocument, DeliveryNotesRequest } from "../types";
import type { DeliveryStatusRequest, DeliveryStatusResult, ManagedDeliveryStatus } from "./statusModels";

const statusCache = new Map<string, ManagedDeliveryStatus>();
const statusInFlight = new Map<string, Promise<ManagedDeliveryStatus>>();
const notesCache = new Map<string, DeliveryNotesDocument>();
const notesInFlight = new Map<string, Promise<DeliveryNotesDocument>>();
const key = (clientId: string, projectId: string) => `${clientId}\u0000${projectId}`;

export const cachedDeliveryStatus = (clientId: string, projectId: string) => statusCache.get(key(clientId, projectId)) ?? null;
export const cachedDeliveryNotes = (clientId: string, projectId: string) => notesCache.get(key(clientId, projectId)) ?? null;

export const cacheDeliveryNotes = (clientId: string, projectId: string, document: DeliveryNotesDocument) => {
  notesCache.set(key(clientId, projectId), document);
};

export const readDeliveryStatus = (request: DeliveryStatusRequest) => {
  const cacheKey = key(request.clientId, request.projectId);
  const active = statusInFlight.get(cacheKey);
  if (active) return active;
  const pending = invoke<DeliveryStatusResult>("get_delivery_status", { request })
    .then((result) => {
      if (!result.ok || !result.delivery) throw new Error(result.message || "Delivery status is not available.");
      statusCache.set(cacheKey, result.delivery);
      return result.delivery;
    })
    .finally(() => {
      if (statusInFlight.get(cacheKey) === pending) statusInFlight.delete(cacheKey);
    });
  statusInFlight.set(cacheKey, pending);
  return pending;
};

export const readDeliveryNotes = (request: DeliveryNotesRequest) => {
  const cacheKey = key(request.clientId, request.projectId);
  const active = notesInFlight.get(cacheKey);
  if (active) return active;
  const pending = invoke<DeliveryNotesDocument>("get_delivery_notes", { request })
    .then((document) => {
      notesCache.set(cacheKey, document);
      return document;
    })
    .finally(() => {
      if (notesInFlight.get(cacheKey) === pending) notesInFlight.delete(cacheKey);
    });
  notesInFlight.set(cacheKey, pending);
  return pending;
};

export const prefetchDeliveryReads = (clientId: string, projectId: string, includeNotes: boolean) => {
  const status = cachedDeliveryStatus(clientId, projectId) ? Promise.resolve() : readDeliveryStatus({ clientId, projectId }).then(() => undefined).catch(() => undefined);
  const notes = !includeNotes || cachedDeliveryNotes(clientId, projectId)
    ? Promise.resolve()
    : readDeliveryNotes({ clientId, projectId }).then(() => undefined).catch(() => undefined);
  return Promise.all([status, notes]).then(() => undefined);
};
