import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export type ListeningPublishStatusValue = "published" | "skipped" | "failed";
export type ListeningPublishEventName = "revision-listening-publish-results" | "delivered-listening-publish-results";

export interface ListeningPublishResult {
  destinationId: string;
  status: ListeningPublishStatusValue;
  message: string;
  selectedSource: string | null;
  destinationPath: string | null;
}

export interface ListeningPublishEvent {
  clientId: string;
  projectId: string;
  revision: number;
  results: ListeningPublishResult[];
}

type ListeningActivitySnapshot = Partial<Record<ListeningPublishEventName, ListeningPublishEvent>>;

const STORAGE_KEY = "jl-mixing-listening-activity-v1";
const ACTIVITY_EVENT = "jl-mixing-listening-activity-updated";

function readSnapshot(): ListeningActivitySnapshot {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ListeningActivitySnapshot : {};
  } catch {
    return {};
  }
}

function recordEvent(eventName: ListeningPublishEventName, event: ListeningPublishEvent) {
  const next = { ...readSnapshot(), [eventName]: event };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Session persistence is best-effort; the in-app update still fires.
  }
  window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, { detail: next }));
}

export async function startListeningPublishCapture(): Promise<() => void> {
  const eventNames: ListeningPublishEventName[] = [
    "revision-listening-publish-results",
    "delivered-listening-publish-results",
  ];
  const unlisteners = await Promise.all(eventNames.map((eventName) =>
    listen<ListeningPublishEvent>(eventName, (message) => recordEvent(eventName, message.payload))));
  return () => unlisteners.forEach((unlisten) => unlisten());
}

export function useLatestListeningPublishEvent(eventName: ListeningPublishEventName) {
  const [event, setEvent] = useState<ListeningPublishEvent | null>(() => readSnapshot()[eventName] ?? null);

  useEffect(() => {
    const onUpdate = (message: Event) => {
      const snapshot = (message as CustomEvent<ListeningActivitySnapshot>).detail;
      setEvent(snapshot[eventName] ?? null);
    };
    window.addEventListener(ACTIVITY_EVENT, onUpdate);
    return () => window.removeEventListener(ACTIVITY_EVENT, onUpdate);
  }, [eventName]);

  return event;
}
