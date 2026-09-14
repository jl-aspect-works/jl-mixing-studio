import { useMemo, useState } from "react";
import type { ProjectSummary } from "../types";
import { ActionIcon } from "../components/ActionIcon";
import type {
  CompletedComparisonCandidate,
  CompletedComparisonRegionResult,
  CompletedComparisonSession,
  ComparisonResultsData,
  CumulativeStanding,
} from "./models";
import { formatTimestamp } from "./session";
import { cumulativeTopRevisionId, sessionFullSongWinner, sessionRegionWinner } from "./results";

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const formatAverage = (value: number) => value.toFixed(2);

const revisionLabel = (revisionNumber: number) => `Revision ${String(revisionNumber).padStart(2, "0")}`;
const lastSession = (sessions: readonly CompletedComparisonSession[]) => sessions[sessions.length - 1] ?? null;

function CandidateName({
  candidate,
  showBlind = true,
}: {
  candidate: CompletedComparisonCandidate;
  showBlind?: boolean;
}) {
  return <span>{revisionLabel(candidate.revisionNumber)}{showBlind ? ` (${candidate.blindId})` : ""}</span>;
}

function RegionRankingRow({
  result,
  candidates,
}: {
  result: CompletedComparisonRegionResult;
  candidates: Map<string, CompletedComparisonCandidate>;
}) {
  let nextRank = 1;
  return <tr>
    <th scope="row">
      <strong>{result.region.name}</strong>
      <small>{formatTimestamp(result.region.startSeconds)} - {result.region.endSeconds === null ? "End" : formatTimestamp(result.region.endSeconds)}</small>
    </th>
    <td>
      <div className="comparison-results-ranking compact">
        {result.rankRows.map((row) => {
          const rank = nextRank;
          nextRank += row.length;
          return <div key={`${result.region.regionId}:${rank}`} className="comparison-results-rank-row">
            <strong>{rank}</strong>
            <span>{row.map((revisionId) => {
              const candidate = candidates.get(revisionId);
              return candidate ? <CandidateName key={revisionId} candidate={candidate} /> : <span key={revisionId}>{revisionId}</span>;
            })}</span>
          </div>;
        })}
      </div>
    </td>
    <td>
      {Object.keys(result.notes).length > 0 ? <div className="comparison-results-notes compact">
        {Object.entries(result.notes).map(([revisionId, note]) => {
          const candidate = candidates.get(revisionId);
          return <p key={revisionId}><strong>{candidate ? revisionLabel(candidate.revisionNumber) : revisionId}:</strong> {note}</p>;
        })}
      </div> : <span className="comparison-placeholder">No notes</span>}
    </td>
  </tr>;
}

function StandingsTable({
  title,
  standings,
  topRevisionId,
}: {
  title: string;
  standings: readonly CumulativeStanding[];
  topRevisionId?: string | null;
}) {
  return <section className="comparison-results-standings" aria-labelledby={`${title.replace(/\W+/g, "-").toLowerCase()}-title`}>
    <h4 id={`${title.replace(/\W+/g, "-").toLowerCase()}-title`}>{title}</h4>
    {standings.length === 0 ? <p className="comparison-placeholder">No cumulative evidence yet.</p> : <table>
      <thead><tr><th>Rank</th><th>Revision</th><th>Avg</th><th>Sessions</th><th>Status</th></tr></thead>
      <tbody>{standings.map((standing, index) => <tr key={standing.revisionId}>
        <td>{index + 1}</td>
        <td>{revisionLabel(standing.revisionNumber)}</td>
        <td>{formatAverage(standing.averagePlacement)}</td>
        <td>{standing.contributingSessions}</td>
        <td>{standing.revisionId === topRevisionId ? <span className="comparison-top-pill">TOP</span> : ""}</td>
      </tr>)}</tbody>
    </table>}
  </section>;
}

export function ComparisonResults({
  project,
  results,
  selectedSession,
  onBack,
  onOpenRevision,
  onApproveRevision,
  onDeleteSession,
  onClearHistory,
  busy = false,
  error = null,
}: {
  project: ProjectSummary;
  results: ComparisonResultsData;
  selectedSession: CompletedComparisonSession | null;
  onBack: () => void;
  onOpenRevision: (revisionNumber: number) => void;
  onApproveRevision: (revisionNumber: number) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearHistory: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [deleteTarget, setDeleteTarget] = useState<CompletedComparisonSession | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(selectedSession?.sessionId ?? lastSession(results.document.completedSessions)?.sessionId ?? null);
  const activeSession = results.document.completedSessions.find((session) => session.sessionId === activeSessionId)
    ?? selectedSession
    ?? lastSession(results.document.completedSessions)
    ?? null;
  const candidates = useMemo(() => new Map<string, CompletedComparisonCandidate>(activeSession?.candidates.map((candidate) => [candidate.revisionId, candidate]) ?? []), [activeSession]);
  const topRevisionId = cumulativeTopRevisionId(results.fullSongStandings);
  const sessionWinnerId = activeSession ? sessionFullSongWinner(activeSession) ?? sessionRegionWinner(activeSession.regions[0]) : null;
  const sessionWinner = sessionWinnerId ? candidates.get(sessionWinnerId) ?? null : null;
  const cumulativeTop = topRevisionId ? results.fullSongStandings.find((standing) => standing.revisionId === topRevisionId) ?? null : null;
  const rankedRegionCount = activeSession?.regions.length ?? 0;

  return <section className="comparison-results" aria-labelledby="comparison-results-title">
    <header className="comparison-screen-header comparison-results-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-results-title">Comparison Results</h2><p>{project.projectName}</p></div>
      <div className="comparison-session-facts"><span>{results.document.completedSessions.length} completed sessions</span><button type="button" className="secondary" onClick={onBack}><ActionIcon name="back" />Back to Revision History</button></div>
    </header>
    {error && <div className="inline-notice error" role="alert">{error}</div>}

    {activeSession ? <div className="comparison-results-grid">
      <section className="panel comparison-results-summary" aria-labelledby="comparison-session-result-title">
        <h3 id="comparison-session-result-title">Revealed Session</h3>
        <dl className="comparison-results-stat-grid">
          <div><dt>Completed</dt><dd>{formatDate(activeSession.completedAt)}</dd></div>
          <div><dt>Candidates</dt><dd>{activeSession.candidates.length}</dd></div>
          <div><dt>Loudness</dt><dd>{activeSession.loudnessMatch ? "Matched" : "Off"}</dd></div>
          <div><dt>Regions</dt><dd>{rankedRegionCount}</dd></div>
          <div><dt>Session Winner</dt><dd>{sessionWinner ? <CandidateName candidate={sessionWinner} /> : "No Full Song winner"}</dd></div>
          <div><dt>Cumulative TOP</dt><dd>{cumulativeTop ? revisionLabel(cumulativeTop.revisionNumber) : "No Full Song evidence"}</dd></div>
        </dl>
        {sessionWinner && <div className="comparison-results-actions">
          <button type="button" className="secondary" onClick={() => onOpenRevision(sessionWinner.revisionNumber)}><ActionIcon name="open" />Open Preferred Revision</button>
          <button type="button" className="secondary" onClick={() => onApproveRevision(sessionWinner.revisionNumber)}><ActionIcon name="check" />Approve Preferred Revision</button>
        </div>}
      </section>

      <section className="panel comparison-results-session-group" aria-labelledby="comparison-session-group-title">
        <header className="comparison-results-group-header">
          <div>
            <h3 id="comparison-session-group-title">Session Results</h3>
            <p>Review one completed comparison session at a time.</p>
          </div>
          <div className="comparison-results-session-controls">
            <label>
              <span>Completed Session</span>
              <select value={activeSession.sessionId} onChange={(event) => setActiveSessionId(event.target.value)}>
                {results.document.completedSessions.map((session) => <option key={session.sessionId} value={session.sessionId}>
                  {formatDate(session.completedAt)} - {session.candidates.length} candidates
                </option>)}
              </select>
            </label>
            <button type="button" className="danger secondary" disabled={busy || !activeSession} onClick={() => setDeleteTarget(activeSession)}><ActionIcon name="delete" />Delete This Session</button>
            <button type="button" className="danger secondary" disabled={busy || results.document.completedSessions.length === 0} onClick={() => setConfirmClear(true)}><ActionIcon name="delete" />Clear Ranking History</button>
          </div>
        </header>

        {deleteTarget && <div className="inline-notice warning comparison-delete-confirmation" role="alertdialog" aria-label="Delete completed comparison session">
          <span>Delete this completed comparison session? Cumulative standings and TOP will be recomputed.</span>
          <span><button type="button" className="secondary" onClick={() => setDeleteTarget(null)}>Keep Session</button><button type="button" className="danger" disabled={busy} onClick={() => { onDeleteSession(deleteTarget.sessionId); setDeleteTarget(null); }}><ActionIcon name="delete" />Delete Session</button></span>
        </div>}
        {confirmClear && <div className="inline-notice warning comparison-clear-confirmation" role="alertdialog" aria-label="Clear ranking history">
          <div>
            <strong>Clear all blind comparison ranking history for this project?</strong>
            <p>This permanently removes all completed comparison sessions, rankings, blind mappings, and comparison notes for this project.</p>
            <p>Cumulative Full Song and regional standings will be cleared, and the TOP indicator will be removed.</p>
            <p>Revision audio, approval/delivery status, and project region definitions will not be changed.</p>
          </div>
          <span><button type="button" className="secondary" onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" className="danger" disabled={busy} onClick={() => { onClearHistory(); setConfirmClear(false); }}><ActionIcon name="delete" />Clear Ranking History</button></span>
        </div>}

        <div className="comparison-results-region-band">
          <section className="comparison-results-regions-panel" aria-labelledby="comparison-region-results-title">
            <h3 id="comparison-region-results-title">By Region Results</h3>
            <div className="comparison-results-region-scroll">
              <table className="comparison-results-region-table">
                <thead><tr><th>Region</th><th>Ranking</th><th>Notes</th></tr></thead>
                <tbody>{activeSession.regions.map((result) => <RegionRankingRow key={result.region.regionId} result={result} candidates={candidates} />)}</tbody>
              </table>
            </div>
          </section>

          <aside className="comparison-results-sidecards" aria-label="Session details">
            <section className="comparison-results-key" aria-labelledby="comparison-revision-key-title">
              <h3 id="comparison-revision-key-title">Revision Key</h3>
              <div className="comparison-revision-key-list" aria-label="Revealed blind mapping">
                {activeSession.candidates.map((candidate) => <div key={candidate.revisionId}>
                  <strong>{candidate.blindId}</strong>
                  <span>=</span>
                  <span>{revisionLabel(candidate.revisionNumber)}</span>
                </div>)}
              </div>
            </section>

            <section className="comparison-loudness-table compact" aria-labelledby="comparison-loudness-title">
              <h3 id="comparison-loudness-title">Loudness Match Details</h3>
              {activeSession.loudnessMatch ? <table><thead><tr><th>Revision</th><th>LUFS</th><th>Gain</th></tr></thead><tbody>
                {activeSession.candidates.map((candidate) => <tr key={candidate.revisionId}>
                  <td><CandidateName candidate={candidate} /></td>
                  <td>{candidate.integratedLufs === null ? "n/a" : candidate.integratedLufs.toFixed(2)}</td>
                  <td>{candidate.appliedGainDb === null ? "n/a" : `${candidate.appliedGainDb.toFixed(2)} dB`}</td>
                </tr>)}
              </tbody></table> : <p className="comparison-placeholder">Loudness Match was off for this session.</p>}
            </section>
          </aside>
        </div>
      </section>

      <section className="panel comparison-results-cumulative-panel" aria-labelledby="comparison-cumulative-title">
        <h3 id="comparison-cumulative-title">Cumulative Results</h3>
        <StandingsTable title="Full Song Standings" standings={results.fullSongStandings} topRevisionId={topRevisionId} />
        {results.regionalStandings.filter((region) => region.region.regionId !== "full-song").map((region) =>
          <StandingsTable key={region.region.regionId} title={`${region.region.name} Standings`} standings={region.standings} />,
        )}
      </section>
    </div> : <section className="empty-state">
      <h3>No completed comparisons</h3>
      <p>Completed blind comparison sessions will appear here after reveal.</p>
    </section>}
  </section>;
}
