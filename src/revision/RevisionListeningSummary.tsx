import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  useLatestListeningPublishEvent,
  type ListeningPublishResult,
  type ListeningPublishStatusValue,
} from "../listening/listeningPublishEvents";
import "./RevisionListeningSummary.css";

interface ListeningDestinationConfiguration {
  id: string;
  name: string;
}

interface ListeningConfiguration {
  destinations: ListeningDestinationConfiguration[];
}

export interface RevisionListeningSummaryValue {
  status: ListeningPublishStatusValue;
  results: Array<ListeningPublishResult & { destinationName: string }>;
}

function overallStatus(results: ListeningPublishResult[]): ListeningPublishStatusValue {
  if (results.some((result) => result.status === "failed")) return "failed";
  if (results.some((result) => result.status === "published")) return "published";
  return "skipped";
}

function filename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function useRevisionListeningSummary(
  clientId: string,
  projectId: string,
  revision: number,
): RevisionListeningSummaryValue | null {
  const latest = useLatestListeningPublishEvent("revision-listening-publish-results");
  const [destinationNames, setDestinationNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void invoke<ListeningConfiguration>("get_listening_configuration")
      .then((configuration) => {
        if (!active) return;
        setDestinationNames(Object.fromEntries(
          configuration.destinations.map((destination) => [destination.id, destination.name || destination.id]),
        ));
      })
      .catch(() => {
        if (active) setDestinationNames({});
      });
    return () => { active = false; };
  }, []);

  return useMemo(() => {
    if (!latest
      || latest.clientId !== clientId
      || latest.projectId !== projectId
      || latest.revision !== revision
      || latest.results.length === 0) return null;

    return {
      status: overallStatus(latest.results),
      results: latest.results.map((result) => ({
        ...result,
        destinationName: destinationNames[result.destinationId] || result.destinationId,
      })),
    };
  }, [clientId, destinationNames, latest, projectId, revision]);
}

export function RevisionListeningBadge({ summary }: { summary: RevisionListeningSummaryValue | null }) {
  if (!summary) return null;
  const label = summary.status === "published"
    ? "Listening Published"
    : summary.status === "failed"
      ? "Listening Failed"
      : "Listening Skipped";
  return <span className={`revision-badge listening ${summary.status}`}>{label}</span>;
}

export function RevisionListeningDetails({ summary }: { summary: RevisionListeningSummaryValue | null }) {
  if (!summary) return null;

  return <section className="revision-listening-details" aria-labelledby="revision-listening-heading">
    <h3 id="revision-listening-heading">Listening</h3>
    <div className="revision-listening-destinations">
      {summary.results.map((result) => <div
        key={result.destinationId}
        className={`revision-listening-destination ${result.status}`}
      >
        <div className="revision-listening-destination-heading">
          <strong>{result.destinationName}</strong>
          <span className={`revision-listening-result ${result.status}`}>
            {result.status === "published" ? "Published" : result.status === "failed" ? "Failed" : "Skipped"}
          </span>
        </div>
        {result.destinationPath && <div className="revision-listening-detail-row">
          <span>Published file</span>
          <code title={result.destinationPath}>{result.destinationPath}</code>
        </div>}
        {result.selectedSource && <div className="revision-listening-detail-row">
          <span>Source</span>
          <code title={result.selectedSource}>{filename(result.selectedSource)}</code>
        </div>}
        {result.status !== "published" && result.message && <div
          className={`inline-notice ${result.status === "failed" ? "error" : "warning"}`}
          role={result.status === "failed" ? "alert" : "status"}
        >{result.message}</div>}
      </div>)}
    </div>
  </section>;
}
