import type { ListeningPublishEvent } from "./listeningPublishEvents";
import "./ListeningPublishStatus.css";

const sourceName = (path: string | null) => {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
};

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
        <p className="kicker">Listening activity</p>
        <h3>{title}</h3>
      </div>
      {actions && <div className="listening-publish-actions">{actions}</div>}
    </div>
    {!event ? <p className="health-detail">{emptyMessage}</p> : <>
      <p className="health-detail">{event.clientId} / {event.projectId} · Revision {event.revision.toString().padStart(2, "0")}</p>
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
