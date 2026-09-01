import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  useLatestListeningPublishEvent,
  type ListeningPublishResult,
  type ListeningPublishStatusValue,
} from "../listening/listeningPublishEvents";
import "./DeliveredListeningSummary.css";

interface ListeningDestinationConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  publishClass: "revisionListening" | "deliveredListening";
}

interface ListeningConfiguration {
  destinations: ListeningDestinationConfiguration[];
}

export interface DeliveredListeningSummaryValue {
  status: ListeningPublishStatusValue;
  results: Array<ListeningPublishResult & { destinationName: string }>;
}

function overallStatus(results: ListeningPublishResult[]): ListeningPublishStatusValue {
  if (results.some((result) => result.status === "failed")) return "failed";
  if (results.some((result) => result.status === "published")) return "published";
  return "skipped";
}

function isMissingSource(result: ListeningPublishResult): boolean {
  return result.status === "skipped"
    && /^No \.[A-Za-z0-9]+ source is available$/i.test(result.message.trim());
}

function filename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function useDeliveredListeningSummary(
  clientId: string,
  projectId: string,
  deliveredRevision: number | null,
): DeliveredListeningSummaryValue | null {
  const latest = useLatestListeningPublishEvent("delivered-listening-publish-results");
  const [configuration, setConfiguration] = useState<ListeningConfiguration | null>(null);

  useEffect(() => {
    let active = true;
    void invoke<ListeningConfiguration>("get_listening_configuration")
      .then((value) => {
        if (active) setConfiguration(value);
      })
      .catch(() => {
        if (active) setConfiguration(null);
      });
    return () => { active = false; };
  }, []);

  const deliveredDestinations = useMemo(
    () => (configuration?.destinations ?? []).filter((destination) =>
      destination.enabled && destination.publishClass === "deliveredListening"),
    [configuration],
  );
  const deliveredDestinationKey = useMemo(
    () => deliveredDestinations.map((destination) => destination.id).sort().join("\u0000"),
    [deliveredDestinations],
  );

  useEffect(() => {
    if (deliveredRevision === null || !deliveredDestinationKey) return;
    void invoke<ListeningPublishResult[]>("republish_delivered_listening", {
      request: { clientId, projectId },
    }).catch(() => undefined);
  }, [clientId, deliveredDestinationKey, deliveredRevision, projectId]);

  const destinationNames = useMemo(
    () => Object.fromEntries(
      (configuration?.destinations ?? []).map((destination) => [
        destination.id,
        destination.name || destination.id,
      ]),
    ),
    [configuration],
  );

  return useMemo(() => {
    if (!latest
      || deliveredRevision === null
      || latest.clientId !== clientId
      || latest.projectId !== projectId
      || latest.revision !== deliveredRevision
      || latest.results.length === 0) return null;

    const visibleResults = latest.results.filter((result) => !isMissingSource(result));
    if (visibleResults.length === 0) return null;

    return {
      status: overallStatus(visibleResults),
      results: visibleResults.map((result) => ({
        ...result,
        destinationName: destinationNames[result.destinationId] || result.destinationId,
      })),
    };
  }, [clientId, deliveredRevision, destinationNames, latest, projectId]);
}

export function DeliveredListeningBadge({
  summary,
}: {
  summary: DeliveredListeningSummaryValue | null;
}) {
  if (!summary) return null;
  const label = summary.status === "published"
    ? "Listening Published"
    : summary.status === "failed"
      ? "Listening Failed"
      : "Listening Skipped";
  return <span className={`delivery-listening-badge ${summary.status}`}>{label}</span>;
}

export function DeliveredListeningDetails({
  summary,
}: {
  summary: DeliveredListeningSummaryValue | null;
}) {
  if (!summary) return null;

  return <section className={`delivery-listening-details ${summary.status}`} aria-labelledby="delivery-listening-heading">
    <h3 id="delivery-listening-heading">Listening</h3>
    <div className="delivery-listening-destinations">
      {summary.results.map((result) => <div
        key={result.destinationId}
        className={`delivery-listening-destination ${result.status}`}
      >
        <div className="delivery-listening-destination-heading">
          <strong>{result.destinationName}</strong>
          <span className={`delivery-listening-result ${result.status}`}>
            {result.status === "published" ? "Published" : result.status === "failed" ? "Failed" : "Skipped"}
          </span>
        </div>
        {(result.destinationPath || result.selectedSource) && <div className="delivery-listening-file-summary">
          {result.destinationPath && <span className="delivery-listening-file-item" title={result.destinationPath}>
            <span className="delivery-listening-file-label">Published</span>
            <span>{filename(result.destinationPath)}</span>
          </span>}
          {result.selectedSource && <span className="delivery-listening-file-item" title={result.selectedSource}>
            <span className="delivery-listening-file-label">Source</span>
            <span>{filename(result.selectedSource)}</span>
          </span>}
        </div>}
        {result.status !== "published" && result.message && <div
          className={`inline-notice ${result.status === "failed" ? "error" : "warning"}`}
          role={result.status === "failed" ? "alert" : "status"}
        >{result.message}</div>}
      </div>)}
    </div>
  </section>;
}
