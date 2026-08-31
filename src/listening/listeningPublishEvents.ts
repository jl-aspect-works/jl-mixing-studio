import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export type ListeningPublishStatusValue = "published" | "skipped" | "failed";

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

export function useListeningPublishEvent(
  eventName: "revision-listening-publish-results" | "delivered-listening-publish-results",
  clientId: string,
  projectId: string,
) {
  const [event, setEvent] = useState<ListeningPublishEvent | null>(null);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;
    void listen<ListeningPublishEvent>(eventName, (message) => {
      if (!active) return;
      if (message.payload.clientId !== clientId || message.payload.projectId !== projectId) return;
      setEvent(message.payload);
    }).then((value) => {
      if (active) unlisten = value;
      else value();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [clientId, eventName, projectId]);

  return { event, setEvent };
}
