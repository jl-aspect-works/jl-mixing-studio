import { ComparisonLoading } from "./ComparisonLoading";
import { measureComparison } from "./performance";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientSummary, ProjectSummary } from "../types";
import type { CompletedComparisonSession, ComparisonResultsData, FrozenComparisonSession } from "./models";
import { ComparisonSetup } from "./ComparisonSetup";
import { ComparisonWorkspace } from "./ComparisonWorkspace";
import { ComparisonResults } from "./ComparisonResults";
import { clearComparisonHistory, completeComparisonSession, deleteComparisonSession, getComparisonResults } from "./comparisonService";
import "./ComparisonFlow.css";

export function ComparisonFlow({
  client,
  project,
  onClose,
  onOpenRevision,
  onApproveRevision,
  initialView = "setup",
}: {
  client: ClientSummary;
  project: ProjectSummary;
  onClose: () => void;
  onOpenRevision?: (revisionNumber: number) => void;
  onApproveRevision?: (revisionNumber: number) => void;
  initialView?: "setup" | "results";
}) {
  const [session, setSession] = useState<FrozenComparisonSession | null>(null);
  const [results, setResults] = useState<ComparisonResultsData | null>(null);
  const [revealedSession, setRevealedSession] = useState<CompletedComparisonSession | null>(null);
  const [resultsBusy, setResultsBusy] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const resultsRequest = useRef<Promise<ComparisonResultsData> | null>(null);
  const readResults = useCallback(() => {
    if (resultsRequest.current) return resultsRequest.current;
    const request = measureComparison("results", () => getComparisonResults({ clientId: client.clientId, projectId: project.projectId }));
    resultsRequest.current = request;
    const clearRequest = () => {
      if (resultsRequest.current === request) resultsRequest.current = null;
    };
    void request.then(clearRequest, clearRequest);
    return request;
  }, [client.clientId, project.projectId]);
  const loadResults = useCallback(async () => {
    setResultsBusy(true);
    setResultsError(null);
    try {
      setResults(await readResults());
      setSession(null);
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : "Comparison results could not be loaded.");
    } finally {
      setResultsBusy(false);
    }
  }, [readResults]);
  useEffect(() => {
    if (initialView === "results" && !results && !session) void loadResults();
  }, [initialView, loadResults, results, session]);
  const finishSession = async (draft: CompletedComparisonSession) => {
    const completed = await measureComparison("save_session", () => completeComparisonSession({
      clientId: client.clientId,
      projectId: project.projectId,
      candidates: draft.candidates,
      regions: draft.regions,
      loudnessMatch: draft.loudnessMatch,
    }));
    const nextResults = await measureComparison("results", () => getComparisonResults({ clientId: client.clientId, projectId: project.projectId }));
    setRevealedSession(completed);
    setResults(nextResults);
    setSession(null);
  };
  const deleteSession = async (sessionId: string) => {
    setResultsBusy(true);
    setResultsError(null);
    try {
      const next = await deleteComparisonSession({ clientId: client.clientId, projectId: project.projectId, sessionId });
      setResults(next);
      if (revealedSession?.sessionId === sessionId) setRevealedSession(null);
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : "Comparison session could not be deleted.");
    } finally {
      setResultsBusy(false);
    }
  };
  const clearHistory = async () => {
    setResultsBusy(true);
    setResultsError(null);
    try {
      setResults(await clearComparisonHistory({ clientId: client.clientId, projectId: project.projectId }));
      setRevealedSession(null);
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : "Comparison ranking history could not be cleared.");
    } finally {
      setResultsBusy(false);
    }
  };
  if (resultsBusy && !results) return <ComparisonLoading text="Loading Comparison Results: reading completed sessions and calculating standings…" />;
  if ((initialView === "results" || resultsError) && !results && !session) return <section className="comparison-loading" aria-labelledby="comparison-results-loading-title">
    <h2 id="comparison-results-loading-title">Comparison Results</h2>
    {resultsError
      ? <><div className="inline-notice error" role="alert">{resultsError}</div><button type="button" className="secondary" onClick={onClose}>Back to Revision History</button></>
      : <ComparisonLoading text="Loading Comparison Results: reading completed sessions and calculating standings…" />}
  </section>;
  if (results) return <ComparisonResults
    project={project}
    results={results}
    selectedSession={revealedSession}
    onBack={onClose}
    onOpenRevision={(revisionNumber) => {
      onOpenRevision?.(revisionNumber);
      onClose();
    }}
    onApproveRevision={(revisionNumber) => {
      onApproveRevision?.(revisionNumber);
      onClose();
    }}
    onDeleteSession={(sessionId) => void deleteSession(sessionId)}
    onClearHistory={() => void clearHistory()}
    busy={resultsBusy}
    error={resultsError}
  />;
  if (session) return <ComparisonWorkspace clientId={client.clientId} projectId={project.projectId} session={session} onCancel={onClose} onComplete={finishSession} />;
  return <ComparisonSetup client={client} project={project} onCancel={onClose} onStart={setSession} onShowResults={() => void loadResults()} />;
}
