import type { ListeningPublishEvent, ListeningPublishResult } from "./listeningPublishEvents";
import "./ListeningPublishStatus.css";

const sourceName = (path: string | null) => {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
};

function isMissingSource(result: ListeningPublishResult): boolean {
  return result.status === "skipped"
    && /^No \.[A-Za-z0-9]+ source is available$/i.test(result.message.trim());
}

function resultMessage(result: ListeningPublishResult): string {
  return result.message;
}

export function ListeningPublishStatus({
  title,
  event,
  emptyTitle = "No activity yet",
  emptyMessage,
  destinationNames = {},
  actions,
}: {
  title: string;
  event: ListeningPublishEvent | null;
  emptyTitle?: string;
  emptyMessage: string;
  destinationNames?: Record<string, string>;
  actions?: React.ReactNode;
}) {
  const visibleResults = event?.results.filter((result) => !isMissingSource(result)) ?? [];
  const visibleEvent = event && visibleResults.length > 0 ? { ...event, results: visibleResults } : null;

  return <section className="panel listening-publish-status" aria-label={title}>
    <div className="panel-heading listening-publish-heading">
      <div>
        <p className="kicker">Listening activity</p>
        <h3>{title}</h3>
      </div>
      {actions && <div className="listening-publish-actions">{actions}</div>}
    </div>
    {!visibleEvent ? <div className="listening-publish-empty">
      <strong>{emptyTitle}</strong>
      <span>{emptyMessage}</span>
    </div> : <>
      <p className="health-detail listening-publish-context">{visibleEvent.clientId} / {visibleEvent.projectId} · Revision {visibleEvent.revision.toString().padStart(2, "0")}</p>
      <div className="listening-publish-results">
        {visibleEvent.results.map((result) => {
          const destinationName = destinationNames[result.destinationId]?.trim() || result.destinationId;
          return <div className={`listening-publish-result result-${result.status}`} key={`${result.destinationId}-${result.destinationPath ?? "none"}`}>
            <div className="listening-publish-result-heading">
              <span className={`listening-publish-badge ${result.status}`}>{result.status}</span>
              <strong>{destinationName}</strong>
            </div>
            {result.selectedSource && <span className="listening-publish-source">Selected source: {sourceName(result.selectedSource)}</span>}
            {result.destinationPath && <span className="listening-publish-path">Published file: {result.destinationPath}</span>}
            <span className="listening-publish-message">{resultMessage(result)}</span>
          </div>;
        })}
      </div>
    </>}
  </section>;
}