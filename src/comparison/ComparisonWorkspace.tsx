import { useEffect, useMemo, useState } from "react";
import type { FrozenComparisonSession } from "./models";
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
  const [dirty, setDirty] = useState(false);
  const region = session.regions.find((item) => item.regionId === activeRegion) ?? session.regions[0];
  const noteKey = `${activeRegion}:${activeCandidate}`;
  const progress = useMemo(() => session.regions.map((item) => ({ ...item, complete: false })), [session.regions]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const candidate = shortcutCandidate(event, session.candidates);
      if (!candidate) return;
      event.preventDefault();
      setActiveCandidate(candidate);
      setDirty(true);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [session.candidates]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const cancel = () => {
    if (dirty && !window.confirm("Discard this unfinished comparison? No session results will be saved.")) return;
    onCancel();
  };

  const chooseRegion = (regionId: string) => {
    if (regionId === activeRegion) return;
    setActiveRegion(regionId);
    setLoop(true);
    setDirty(true);
  };

  return <section className="comparison-workspace" aria-labelledby="comparison-workspace-title">
    <header className="comparison-screen-header comparison-workspace-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-workspace-title">Comparison Session</h2></div>
      <div className="comparison-session-facts"><span>{session.candidates.length} candidates</span><span>Loudness Match: <strong>{session.loudnessMatch ? "ON" : "OFF"}</strong></span><button type="button" className="secondary" onClick={cancel}>Cancel</button></div>
    </header>

    <nav className="comparison-region-strip" aria-label="Comparison regions">
      {progress.map((item) => <button key={item.regionId} type="button" className={item.regionId === activeRegion ? "active" : "secondary"} aria-current={item.regionId === activeRegion ? "page" : undefined} onClick={() => chooseRegion(item.regionId)}>{item.name} <span aria-label="Not complete">○</span></button>)}
    </nav>

    <section className="panel comparison-listening" aria-labelledby="comparison-listening-title">
      <div className="comparison-active-region"><div><p className="kicker">Active region</p><h3 id="comparison-listening-title">{region.name}</h3></div><span>{formatTimestamp(region.startSeconds)} – {region.endSeconds === null ? "End" : formatTimestamp(region.endSeconds)}</span></div>
      <div className="comparison-seek-shell" aria-label="Playback progress integration point"><span>0:00</span><div /><span>–:––</span></div>
      <div className="comparison-playback-row">
        <div className="comparison-transport" aria-label="Comparison transport"><button type="button" disabled>Previous</button><button type="button" disabled>−5s</button><button type="button" disabled>Play</button><button type="button" disabled>+5s</button><button type="button" disabled>Next</button><button type="button" className={loop ? "" : "secondary"} onClick={() => { setLoop((value) => !value); setDirty(true); }}>Loop: {loop ? "ON" : "OFF"}</button></div>
        <div className="comparison-candidate-switches" aria-label="Blind candidates">
          {session.candidates.map((candidate) => <button key={candidate.blindId} type="button" className={candidate.blindId === activeCandidate ? "active" : "secondary"} aria-pressed={candidate.blindId === activeCandidate} onClick={() => { setActiveCandidate(candidate.blindId); setDirty(true); }}>{candidate.blindId}</button>)}
          <small>A–Z keyboard shortcuts</small>
        </div>
      </div>
      <p className="comparison-playing">Selected: <strong>Candidate {activeCandidate}</strong><span>Playback integration follows in the sequenced playback issue.</span></p>
    </section>

    <div className="comparison-judgment-grid">
      <section className="panel" aria-labelledby="comparison-ranking-title"><h3 id="comparison-ranking-title">Ranking</h3><p className="kicker">Unranked</p><div className="comparison-unranked">{session.candidates.map((candidate) => <span key={candidate.blindId}>{candidate.blindId}</span>)}</div><p className="comparison-placeholder">Rank ordering, ties, and region completion are added by the next sequenced issue.</p><button type="button" disabled>Mark Region Complete</button></section>
      <section className="panel" aria-labelledby="comparison-notes-title"><h3 id="comparison-notes-title">Candidate notes</h3><label>Candidate {activeCandidate}<textarea aria-label={`Notes for Candidate ${activeCandidate}`} value={notes[noteKey] ?? ""} onChange={(event) => { setNotes((current) => ({ ...current, [noteKey]: event.target.value })); setDirty(true); }} placeholder="Listening notes for this candidate and region" /></label><small>Notes remain in memory until the completed-session workflow is available.</small></section>
    </div>
    <footer className="comparison-workspace-footer"><span>{session.regions.length} regions · 0 complete · Loop {loop ? "On" : "Off"}</span><button type="button" disabled>Reveal &amp; Complete Comparison</button></footer>
  </section>;
}
