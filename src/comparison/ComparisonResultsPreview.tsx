import { ActionIcon } from "../components/ActionIcon";
import type { FrozenComparisonSession } from "./models";

const revisionLabel = (revisionNumber: number) => `Revision ${String(revisionNumber).padStart(2, "0")}`;

export function ComparisonResultsPreview({
  session,
  onBack,
}: {
  session: FrozenComparisonSession;
  onBack: () => void;
}) {
  const ranking = session.candidates.map((candidate) => revisionLabel(candidate.revisionNumber)).join(" > ");

  return <section className="comparison-workspace comparison-results-preview" aria-labelledby="comparison-results-title">
    <header className="comparison-screen-header comparison-workspace-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-results-title">Comparison Results</h2></div>
      <div className="comparison-session-facts"><strong className="comparison-revealed-label">REVEALED PREVIEW</strong><button type="button" className="secondary" onClick={onBack}><ActionIcon name="back" />Back to Comparison</button></div>
    </header>

    <div className="inline-notice comparison-results-preview-notice" role="status">Temporary layout preview only. Rankings, completion data, cumulative standings, and actions are not saved or enabled.</div>

    <section className="panel comparison-results-summary" aria-label="Session summary">
      <span><small>Candidates</small><strong>{session.candidates.length}</strong></span>
      <span><small>Regions</small><strong>{session.regions.length}</strong></span>
      <span><small>Loudness Match</small><strong>{session.loudnessMatch ? "ON" : "OFF"}</strong></span>
      <span><small>Completed</small><strong>Preview only</strong></span>
    </section>

    <div className="comparison-results-tabs" role="tablist" aria-label="Results view">
      <button type="button" role="tab" aria-selected="true">By Region</button>
      <button type="button" role="tab" aria-selected="false" className="secondary">Cumulative Standings</button>
    </div>

    <div className="comparison-results-grid">
      <section className="panel" aria-labelledby="comparison-by-region-title">
        <h3 id="comparison-by-region-title">By Region Results</h3>
        <p className="comparison-placeholder">Preview ordering is shown only to make the approved results layout reviewable.</p>
        <div className="comparison-region-results">
          {session.regions.map((region) => <div key={region.regionId}><strong>{region.name}</strong><span>{ranking}</span></div>)}
        </div>
      </section>

      <aside className="comparison-results-sidebar">
        <section className="panel" aria-labelledby="comparison-revision-key-title">
          <h3 id="comparison-revision-key-title">Revision Key</h3>
          <div className="comparison-revision-key">{session.candidates.map((candidate) => <div key={candidate.blindId}><strong>{candidate.blindId}</strong><span>→</span><span>{revisionLabel(candidate.revisionNumber)}</span></div>)}</div>
        </section>
        {session.loudnessMatch && <section className="panel" aria-labelledby="comparison-loudness-details-title"><h3 id="comparison-loudness-details-title">Loudness Details</h3><p className="comparison-placeholder">LUFS and applied gain values appear here after completion.</p></section>}
      </aside>
    </div>

    <section className="panel comparison-results-notes" aria-labelledby="comparison-results-notes-title">
      <div><h3 id="comparison-results-notes-title">Session Notes</h3><p className="comparison-placeholder">Per-region candidate notes appear with the completed results.</p></div>
      <div className="comparison-workspace-actions"><button type="button" className="danger" disabled><ActionIcon name="delete" />Delete Session</button><button type="button" disabled><ActionIcon name="open" />Open Preferred Revision</button><button type="button" disabled><ActionIcon name="check" />Approve Preferred Revision</button></div>
    </section>

    <section className="panel" aria-labelledby="comparison-cumulative-title">
      <h3 id="comparison-cumulative-title">Cumulative Standings</h3>
      <div className="comparison-cumulative-table" role="table" aria-label="Cumulative standings preview">
        <div role="row"><strong role="columnheader">Revision</strong><strong role="columnheader">Avg placement</strong><strong role="columnheader">Sessions</strong><strong role="columnheader">Evidence</strong></div>
        {session.candidates.map((candidate) => <div role="row" key={candidate.revisionId}><span role="cell">{revisionLabel(candidate.revisionNumber)} ({candidate.blindId})</span><span role="cell">—</span><span role="cell">—</span><span role="cell">Available after completion</span></div>)}
      </div>
    </section>
  </section>;
}
