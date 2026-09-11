import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import { ComparisonRanking } from "./ComparisonRanking";
import type { FrozenComparisonSession } from "./models";
import { initialRanking, moveCandidate, rankingDestinationForSlot, rankingIsComplete, shortcutRank, type CandidateRanking } from "./ranking";
import { formatTimestamp, shortcutCandidate } from "./session";

export function ComparisonWorkspace({
  session,
  onCancel,
}: {
  session: FrozenComparisonSession;
  onCancel: () => void;
}) {
  const [activeCandidate, setActiveCandidate] = useState(session.candidates[0].blindId);
  const [activeRegion, setActiveRegion] = useState(session.regions[0].regionId);
  const [loop, setLoop] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rankings, setRankings] = useState<Record<string, CandidateRanking>>(() => Object.fromEntries(session.regions.map((item) => [item.regionId, initialRanking(session.candidates.map((candidate) => candidate.blindId))])));
  const [completedRegions, setCompletedRegions] = useState<ReadonlySet<string>>(() => new Set());
  const [dirty, setDirty] = useState(false);
  const [cancelConfirmation, setCancelConfirmation] = useState(false);
  const [completionNotice, setCompletionNotice] = useState(false);
  const region = session.regions.find((item) => item.regionId === activeRegion) ?? session.regions[0];
  const noteKey = `${activeRegion}:${activeCandidate}`;
  const ranking = rankings[activeRegion];
  const progress = useMemo(() => session.regions.map((item) => ({ ...item, complete: completedRegions.has(item.regionId) })), [completedRegions, session.regions]);
  const completedCount = progress.filter((item) => item.complete).length;
  const allRegionsComplete = completedCount === session.regions.length;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const cancel = () => {
    if (dirty) setCancelConfirmation(true); else onCancel();
  };

  const chooseRegion = (regionId: string) => {
    if (regionId === activeRegion) return;
    setActiveRegion(regionId);
    setLoop(true);
    setDirty(true);
  };

  const updateRanking = useCallback((next: CandidateRanking) => {
    setRankings((current) => ({ ...current, [activeRegion]: next }));
    if (!rankingIsComplete(next)) setCompletedRegions((current) => {
      const updated = new Set(current);
      updated.delete(activeRegion);
      return updated;
    });
    setCompletionNotice(false);
    setDirty(true);
  }, [activeRegion]);

  const markRegionComplete = () => {
    if (!rankingIsComplete(ranking)) return;
    setCompletedRegions((current) => new Set(current).add(activeRegion));
    setDirty(true);
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const rank = shortcutRank(event, session.candidates.length);
      if (rank !== null) {
        event.preventDefault();
        updateRanking(moveCandidate(ranking, activeCandidate, rankingDestinationForSlot(ranking, rank)));
        return;
      }
      const candidate = shortcutCandidate(event, session.candidates);
      if (!candidate) return;
      event.preventDefault();
      setActiveCandidate(candidate);
      setDirty(true);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [activeCandidate, ranking, session.candidates, updateRanking]);

  return <section className="comparison-workspace" aria-labelledby="comparison-workspace-title">
    <header className="comparison-screen-header comparison-workspace-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-workspace-title">Comparison Session</h2></div>
      <div className="comparison-session-facts"><span>{session.candidates.length} candidates</span><span>Loudness Match: <strong>{session.loudnessMatch ? "ON" : "OFF"}</strong></span><button type="button" className="secondary" onClick={cancel}><ActionIcon name="close" />Cancel</button></div>
    </header>
    {cancelConfirmation && <div className="inline-notice warning comparison-cancel-confirmation" role="alertdialog" aria-label="Discard unfinished comparison">
      <span>Discard this unfinished comparison? No session results will be saved.</span>
      <span><button type="button" className="danger" onClick={onCancel}><ActionIcon name="delete" />Discard Comparison</button><button type="button" className="secondary" onClick={() => setCancelConfirmation(false)}><ActionIcon name="back" />Keep Comparing</button></span>
    </div>}

    <nav className="comparison-region-strip" aria-label="Comparison regions">
      {progress.map((item) => <button key={item.regionId} type="button" className={item.regionId === activeRegion ? "active" : "secondary"} aria-current={item.regionId === activeRegion ? "page" : undefined} onClick={() => chooseRegion(item.regionId)}>{item.name} <span aria-label={item.complete ? "Complete" : "Not complete"}>{item.complete ? "✓" : "○"}</span></button>)}
    </nav>

    <section className="panel comparison-listening" aria-labelledby="comparison-listening-title">
      <div className="comparison-active-region"><div><p className="kicker">Active region</p><h3 id="comparison-listening-title">{region.name}: Candidate {activeCandidate}</h3></div><span>{formatTimestamp(region.startSeconds)} – {region.endSeconds === null ? "End" : formatTimestamp(region.endSeconds)}</span></div>
      <div className="comparison-seek-shell" aria-label="Playback progress integration point"><span>0:00</span><div /><span>–:––</span></div>
      <div className="comparison-playback-row">
        <div className="comparison-transport" aria-label="Comparison transport"><button type="button" disabled><ActionIcon name="previous" />Previous</button><button type="button" disabled><ActionIcon name="skipBack" />5s</button><button type="button" disabled><ActionIcon name="play" />Play</button><button type="button" disabled><ActionIcon name="skipForward" />5s</button><button type="button" disabled><ActionIcon name="next" />Next</button><button type="button" className={loop ? "" : "secondary"} onClick={() => { setLoop((value) => !value); setDirty(true); }}><ActionIcon name="loop" />Loop: {loop ? "ON" : "OFF"}</button></div>
      </div>
      <div className="comparison-session-control-grid">
        <section className="comparison-session-subpanel" aria-labelledby="comparison-candidate-switch-title"><h3 id="comparison-candidate-switch-title">Candidate Switch</h3><div className="comparison-candidate-switches" aria-label="Blind candidates">{session.candidates.map((candidate) => <button key={candidate.blindId} type="button" className={candidate.blindId === activeCandidate ? "active" : "secondary"} aria-pressed={candidate.blindId === activeCandidate} onClick={() => { setActiveCandidate(candidate.blindId); setDirty(true); }}>{candidate.blindId}</button>)}<small>A–Z keyboard shortcuts</small></div></section>
        <section className="comparison-session-subpanel" aria-labelledby="comparison-session-progress-title"><h3 id="comparison-session-progress-title">Session Progress</h3><div className="comparison-session-progress" aria-label="Region completion progress">{progress.map((item) => <div key={item.regionId} className={item.regionId === activeRegion ? "active" : ""}><strong>{item.name}</strong><small>{item.complete ? "Complete" : item.regionId === activeRegion ? "Active" : "Not complete"}</small></div>)}</div></section>
      </div>
    </section>

    <div className="comparison-judgment-grid">
      <ComparisonRanking candidateIds={session.candidates.map((candidate) => candidate.blindId)} ranking={ranking} activeCandidate={activeCandidate} onSelectCandidate={(candidateId) => { setActiveCandidate(candidateId); setDirty(true); }} onChange={updateRanking} />
      <section className="panel" aria-labelledby="comparison-notes-title"><h3 id="comparison-notes-title">Candidate notes</h3><label>Candidate {activeCandidate}<textarea aria-label={`Notes for Candidate ${activeCandidate}`} value={notes[noteKey] ?? ""} onChange={(event) => { setNotes((current) => ({ ...current, [noteKey]: event.target.value })); setDirty(true); }} placeholder="Listening notes for this candidate and region" /></label><small>Notes stay attached to this candidate and region when rankings move.</small></section>
    </div>
    {completionNotice && <div className="inline-notice" role="status">All regions are complete. Reveal and persistence are provided by the later results workflow.</div>}
    <footer className="comparison-workspace-footer"><span>{session.regions.length} regions · {completedCount} complete · {ranking.unranked.length} unranked · Loop {loop ? "On" : "Off"}</span><span className="comparison-workspace-actions"><button type="button" disabled={!rankingIsComplete(ranking) || completedRegions.has(activeRegion)} onClick={markRegionComplete}><ActionIcon name="check" />{completedRegions.has(activeRegion) ? "Region Complete" : "Mark Region Complete"}</button><button type="button" disabled={!allRegionsComplete} onClick={() => setCompletionNotice(true)}><ActionIcon name="check" />Reveal &amp; Complete Comparison</button></span></footer>
  </section>;
}
