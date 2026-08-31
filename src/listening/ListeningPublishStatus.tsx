import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./ListeningPublishStatus.css";

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

const sourceName = (path: string | null) => {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? path;
};

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

export function ListeningPublishStatus({
  title,
  event,
  emptyMessage,
  actions,
}: {
  title: string;
  event: ListeningPublishEvent | null;
  emptyMessage: string;
  actions?: React.ReactNode;
}) {
  return <section className="panel listening-publish-status" aria-label={title}>
    <div className="panel-heading listening-publish-heading">
      <div>
        <p className="kicker">Listening</p>
        <h2>{title}</h2>
      </div>
      {actions && <div className="listening-publish-actions">{actions}</div>}
    </div>
    {!event ? <p className="health-detail">{emptyMessage}</p> : <>
      <p className="health-detail">Latest result for Revision {event.revision.toString().padStart(2, "0")}.</p>
      <div className="listening-publish-results">
        {event.results.map((result) => <div className="listening-publish-result" key={`${result.destinationId}-${result.destinationPath ?? "none"}`}>
          <div className="listening-publish-result-heading">
            <span className={`listening-publish-badge ${result.status}`}>{result.status}</span>
            <strong>{result.destinationPath ?? result.destinationId}</strong>
          </div>
          {result.selectedSource && <span className="listening-publish-source">Source: {sourceName(result.selectedSource)}</span>}
          <span className="listening-publish-message">{result.message}</span>
        </div>)}
      </div>
    </>}
  </section>;
}
