import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import { ComparisonPlaybackSession, type ComparisonPlaybackSnapshot } from "./comparisonPlaybackService";
import { ComparisonRanking } from "./ComparisonRanking";
import type { CompletedComparisonSession, FrozenComparisonSession } from "./models";
import { initialRanking, moveCandidate, rankingDestinationForSlot, rankingIsComplete, shortcutRank, type CandidateRanking } from "./ranking";
import { completedCandidatesFromSession, completedRegionResultsFromRankings } from "./results";
import { formatTimestamp, shortcutCandidate, shortcutTransport } from "./session";

export function ComparisonWorkspace({
  clientId,
  projectId,
  session,
  onCancel,
  onComplete,
}: {
  clientId: string;
  projectId: string;
  session: FrozenComparisonSession;
  onCancel: () => void;
  onComplete: (session: CompletedComparisonSession) => Promise<void>;
}) {
  const [activeCandidate, setActiveCandidate] = useState(session.candidates[0].blindId);
  const [activeRegion, setActiveRegion] = useState(session.regions[0].regionId);
  const [loop, setLoop] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rankings, setRankings] = useState<Record<string, CandidateRanking>>(() => Object.fromEntries(session.regions.map((item) => [item.regionId, initialRanking(session.candidates.map((candidate) => candidate.blindId))])));
  const [completedRegions, setCompletedRegions] = useState<ReadonlySet<string>>(() => new Set());
  const [dirty, setDirty] = useState(false);
  const [cancelConfirmation, setCancelConfirmation] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [playback, setPlayback] = useState<ComparisonPlaybackSnapshot | null>(null);
  const [playbackBusy, setPlaybackBusy] = useState(true);
  const [playbackError, setPlaybackError] = useState<{ candidateId: string; message: string } | null>(null);
  const [volume, setVolume] = useState(1);
  const playbackSessionRef = useRef<ComparisonPlaybackSession | null>(null);
  const region = session.regions.find((item) => item.regionId === activeRegion) ?? session.regions[0];
  const noteKey = `${activeRegion}:${activeCandidate}`;
  const ranking = rankings[activeRegion];
  const progress = useMemo(() => session.regions.map((item) => ({ ...item, complete: completedRegions.has(item.regionId) })), [completedRegions, session.regions]);
  const completedCount = progress.filter((item) => item.complete).length;
  const allRegionsComplete = completedCount === session.regions.length;

  const preparePlayback = useCallback(async (
    playbackSession: ComparisonPlaybackSession,
    shouldApply = () => playbackSessionRef.current === playbackSession,
  ) => {
    if (shouldApply()) {
      setPlaybackBusy(true);
      setPlaybackError(null);
    }
    try {
      const next = await playbackSession.prepare();
      if (shouldApply()) setPlayback(next);
    } catch (error) {
      if (shouldApply()) {
        setPlayback(null);
        setPlaybackError({
          candidateId: candidateFromPlaybackError(error) ?? session.candidates[0].blindId,
          message: error instanceof Error ? error.message : "Comparison audio could not be prepared.",
        });
      }
    } finally {
      if (shouldApply()) setPlaybackBusy(false);
    }
  }, [session.candidates]);

  useEffect(() => {
    const playbackSession = new ComparisonPlaybackSession(clientId, projectId, session.candidates, session.regions, session.regions[0]);
    let cancelled = false;
    const shouldApply = () => !cancelled && playbackSessionRef.current === playbackSession;
    playbackSessionRef.current = playbackSession;
    void preparePlayback(playbackSession, shouldApply);
    return () => {
      cancelled = true;
      if (playbackSessionRef.current === playbackSession) playbackSessionRef.current = null;
      void playbackSession.dispose();
    };
  }, [clientId, preparePlayback, projectId, session.candidates, session.regions]);

  const playbackFailure = useCallback(async (candidateId: string, error: unknown) => {
    try { await playbackSessionRef.current?.pause(); } catch { /* Playback is already failed. */ }
    setPlayback((current) => current ? { ...current, playing: false } : current);
    setPlaybackError({
      candidateId: candidateFromPlaybackError(error) ?? candidateId,
      message: error instanceof Error ? error.message : `Candidate ${candidateId} could not be played.`,
    });
  }, []);

  useEffect(() => {
    if (!playback?.playing || playbackError) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await playbackSessionRef.current?.refresh();
        if (!cancelled && next) setPlayback(next);
      } catch (error) {
        if (!cancelled) await playbackFailure(activeCandidate, error);
      }
    };
    const interval = window.setInterval(() => void refresh(), 100);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeCandidate, playback?.playing, playbackError, playbackFailure]);

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

  const chooseRegion = async (regionId: string) => {
    if (regionId === activeRegion) return;
    const nextRegion = session.regions.find((item) => item.regionId === regionId);
    if (!nextRegion) return;
    try {
      const next = await playbackSessionRef.current?.setRegion(nextRegion);
      if (next) setPlayback(next);
    } catch (error) {
      await playbackFailure(activeCandidate, error);
      return;
    }
    setActiveRegion(regionId);
    setLoop(true);
    setDirty(true);
  };

  const chooseCandidate = useCallback(async (candidateId: string) => {
    if (candidateId === activeCandidate || playbackBusy || playbackError) return;
    try {
      const next = await playbackSessionRef.current?.switchCandidate(candidateId);
      if (next) setPlayback(next);
      setActiveCandidate(candidateId);
      setDirty(true);
    } catch (error) {
      setActiveCandidate(candidateId);
      await playbackFailure(candidateId, error);
    }
  }, [activeCandidate, playbackBusy, playbackError, playbackFailure]);

  const togglePlayback = useCallback(async () => {
    if (playbackBusy || playbackError) return;
    try {
      const next = await playbackSessionRef.current?.toggle();
      if (next) setPlayback(next);
      setDirty(true);
    } catch (error) {
      await playbackFailure(activeCandidate, error);
    }
  }, [activeCandidate, playbackBusy, playbackError, playbackFailure]);

  const seekPlayback = useCallback(async (seconds: number) => {
    if (playbackBusy || playbackError) return;
    try {
      const next = await playbackSessionRef.current?.seek(seconds);
      if (next) setPlayback(next);
      setDirty(true);
    } catch (error) {
      await playbackFailure(activeCandidate, error);
    }
  }, [activeCandidate, playbackBusy, playbackError, playbackFailure]);

  const stepCandidate = useCallback((offset: number) => {
    const index = session.candidates.findIndex((candidate) => candidate.blindId === activeCandidate);
    const next = session.candidates[(index + offset + session.candidates.length) % session.candidates.length];
    if (next) void chooseCandidate(next.blindId);
  }, [activeCandidate, chooseCandidate, session.candidates]);

  const changeLoop = () => {
    const next = !loop;
    playbackSessionRef.current?.setLoop(next);
    setLoop(next);
    setDirty(true);
  };

  const changeVolume = async (nextVolume: number) => {
    setVolume(nextVolume);
    setDirty(true);
    try {
      const next = await playbackSessionRef.current?.setVolume(nextVolume);
      if (next) setPlayback(next);
    } catch (error) {
      await playbackFailure(activeCandidate, error);
    }
  };

  const retryPlayback = async () => {
    const playbackSession = playbackSessionRef.current;
    if (!playbackSession) return;
    setPlaybackBusy(true);
    setPlaybackError(null);
    try {
      const next = playback ? await playbackSession.retry() : await playbackSession.prepare();
      setPlayback(next);
    } catch (error) {
      await playbackFailure(activeCandidate, error);
    } finally {
      setPlaybackBusy(false);
    }
  };

  const updateRanking = useCallback((next: CandidateRanking) => {
    setRankings((current) => ({ ...current, [activeRegion]: next }));
    if (!rankingIsComplete(next)) setCompletedRegions((current) => {
      const updated = new Set(current);
      updated.delete(activeRegion);
      return updated;
    });
    setCompletionError(null);
    setDirty(true);
  }, [activeRegion]);

  const markRegionComplete = () => {
    if (!rankingIsComplete(ranking)) return;
    setCompletedRegions((current) => new Set(current).add(activeRegion));
    setDirty(true);
  };

  const complete = async () => {
    if (!allRegionsComplete || completionBusy) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      await playbackSessionRef.current?.pause();
      const completed = await onComplete({
        sessionId: "",
        completedAt: "",
        candidates: completedCandidatesFromSession(session),
        regions: completedRegionResultsFromRankings(session, rankings, notes),
        loudnessMatch: session.loudnessMatch,
      });
      setDirty(false);
      await playbackSessionRef.current?.dispose();
      playbackSessionRef.current = null;
      return completed;
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : "Comparison results could not be saved.");
    } finally {
      setCompletionBusy(false);
    }
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const transport = shortcutTransport(event);
      if (transport !== null) {
        event.preventDefault();
        if (!playback || playbackBusy || playbackError) return;
        if (transport === "toggle") {
          void togglePlayback();
          return;
        }
        if (transport === "previousCandidate" || transport === "nextCandidate") {
          stepCandidate(transport === "previousCandidate" ? -1 : 1);
          return;
        }
        void seekPlayback(playback.currentSeconds + (transport === "back" ? -5 : 5));
        return;
      }
      const rank = shortcutRank(event, session.candidates.length);
      if (rank !== null) {
        event.preventDefault();
        updateRanking(moveCandidate(ranking, activeCandidate, rankingDestinationForSlot(ranking, rank)));
        return;
      }
      const candidate = shortcutCandidate(event, session.candidates);
      if (!candidate) return;
      event.preventDefault();
      void chooseCandidate(candidate);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [activeCandidate, chooseCandidate, playback, playbackBusy, playbackError, ranking, seekPlayback, session.candidates, stepCandidate, togglePlayback, updateRanking]);

  return <section className="comparison-workspace" aria-labelledby="comparison-workspace-title">
    <header className="comparison-screen-header comparison-workspace-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-workspace-title">Comparison Session</h2></div>
      <div className="comparison-session-facts"><span>{session.candidates.length} candidates</span><span>Loudness Match: <strong>{session.loudnessMatch ? "ON" : "OFF"}</strong></span><button type="button" className="secondary" onClick={cancel}><ActionIcon name="close" />Cancel</button></div>
    </header>
    {cancelConfirmation && <div className="inline-notice warning comparison-cancel-confirmation" role="alertdialog" aria-label="Discard unfinished comparison">
      <span>Discard this unfinished comparison? No session results will be saved.</span>
      <span><button type="button" className="danger" onClick={onCancel}><ActionIcon name="delete" />Discard Comparison</button><button type="button" className="secondary" onClick={() => setCancelConfirmation(false)}><ActionIcon name="back" />Keep Comparing</button></span>
    </div>}
    {playbackError && <div className="inline-notice error comparison-playback-error" role="alert">
      <span><strong>Candidate {playbackError.candidateId} playback stopped.</strong> {playbackError.message}</span>
      <span><button type="button" disabled={playbackBusy} onClick={() => void retryPlayback()}><ActionIcon name="refresh" />Retry</button><button type="button" className="secondary" onClick={cancel}><ActionIcon name="close" />Cancel</button></span>
    </div>}

    <section className="panel comparison-listening" aria-labelledby="comparison-listening-title">
      <div className="comparison-active-region"><div><p className="kicker">Active region</p><h3 id="comparison-listening-title">{region.name}: Candidate {activeCandidate}</h3></div><span>{formatTimestamp(region.startSeconds)} – {region.endSeconds === null ? "End" : formatTimestamp(region.endSeconds)}</span></div>
      <div className="comparison-seek-shell"><span>{formatTimestamp(playback?.currentSeconds ?? region.startSeconds)}</span><input type="range" min={region.startSeconds} max={region.endSeconds ?? playback?.durationSeconds ?? region.startSeconds} step="0.05" value={playback?.currentSeconds ?? region.startSeconds} aria-label="Comparison playback position" disabled={!playback || playbackBusy || !!playbackError} onChange={(event) => void seekPlayback(Number(event.target.value))} /><span>{formatTimestamp(region.endSeconds ?? playback?.durationSeconds ?? 0)}</span></div>
      <div className="comparison-playback-row">
        <div className="comparison-transport" aria-label="Comparison transport"><button type="button" className="icon-only" aria-label="Previous candidate" title="Previous candidate (Left Arrow)" disabled={!playback || playbackBusy || !!playbackError} onClick={() => stepCandidate(-1)}><ActionIcon name="previous" /></button><button type="button" className="icon-only" aria-label="Back 5 seconds" title="Back 5 seconds (,)" disabled={!playback || playbackBusy || !!playbackError} onClick={() => void seekPlayback((playback?.currentSeconds ?? region.startSeconds) - 5)}><ActionIcon name="skipBack" /></button><button type="button" className="icon-only" aria-label={playback?.playing ? "Pause" : "Play"} title={playback?.playing ? "Pause (Space)" : "Play (Space)"} disabled={!playback || playbackBusy || !!playbackError} onClick={() => void togglePlayback()}><ActionIcon name={playback?.playing ? "pause" : "play"} /></button><button type="button" className="icon-only" aria-label="Forward 5 seconds" title="Forward 5 seconds (.)" disabled={!playback || playbackBusy || !!playbackError} onClick={() => void seekPlayback((playback?.currentSeconds ?? region.startSeconds) + 5)}><ActionIcon name="skipForward" /></button><button type="button" className="icon-only" aria-label="Next candidate" title="Next candidate (Right Arrow)" disabled={!playback || playbackBusy || !!playbackError} onClick={() => stepCandidate(1)}><ActionIcon name="next" /></button><button type="button" className={`${loop ? "" : "secondary"} icon-only`} aria-label={`Loop ${loop ? "on" : "off"}`} title={`Loop ${loop ? "on" : "off"}`} disabled={!playback || playbackBusy || !!playbackError} onClick={changeLoop}><ActionIcon name="loop" /></button><label className="comparison-volume">Volume<input type="range" min="0" max="1" step="0.05" value={volume} aria-label="Comparison volume" disabled={!playback || playbackBusy || !!playbackError} onChange={(event) => void changeVolume(Number(event.target.value))} /></label></div>
      </div>
      {playbackBusy && <p className="comparison-playback-status" role="status">Preparing {session.candidates.length} candidates…</p>}
      <div className={`comparison-session-control-grid ${session.regions.length <= 5 ? "side-by-side" : "stacked"}`}>
        <section className="comparison-session-subpanel" aria-labelledby="comparison-candidate-switch-title"><h3 id="comparison-candidate-switch-title">Candidate Switch</h3><div className="comparison-candidate-switches" aria-label="Blind candidates">{session.candidates.map((candidate) => <button key={candidate.blindId} type="button" className={candidate.blindId === activeCandidate ? "active" : "secondary"} aria-pressed={candidate.blindId === activeCandidate} disabled={!playback || playbackBusy || !!playbackError} onClick={() => void chooseCandidate(candidate.blindId)}>{candidate.blindId}</button>)}<small>A–Z keyboard shortcuts</small></div></section>
        <section className="comparison-session-subpanel" aria-labelledby="comparison-session-progress-title"><h3 id="comparison-session-progress-title">Session Progress</h3><div className="comparison-session-progress" aria-label="Region completion progress">{progress.map((item) => <button key={item.regionId} type="button" className={item.regionId === activeRegion ? "active" : "secondary"} aria-current={item.regionId === activeRegion ? "page" : undefined} disabled={!playback || playbackBusy || !!playbackError} onClick={() => void chooseRegion(item.regionId)}><strong>{item.name}</strong><small>{item.complete ? "Complete" : item.regionId === activeRegion ? "Active" : "Not complete"}</small></button>)}</div></section>
      </div>
    </section>

    <div className="comparison-judgment-grid">
      <ComparisonRanking candidateIds={session.candidates.map((candidate) => candidate.blindId)} ranking={ranking} activeCandidate={activeCandidate} onSelectCandidate={(candidateId) => void chooseCandidate(candidateId)} onChange={updateRanking} />
      <section className="panel" aria-labelledby="comparison-notes-title"><h3 id="comparison-notes-title">Candidate notes</h3><label>Candidate {activeCandidate}<textarea aria-label={`Notes for Candidate ${activeCandidate}`} value={notes[noteKey] ?? ""} onChange={(event) => { setNotes((current) => ({ ...current, [noteKey]: event.target.value })); setDirty(true); }} placeholder="Listening notes for this candidate and region" /></label><small>Notes stay attached to this candidate and region when rankings move.</small></section>
    </div>
    {completionError && <div className="inline-notice error" role="alert">{completionError}</div>}
    <footer className="comparison-workspace-footer"><span>{session.regions.length} regions - {completedCount} complete - {ranking.unranked.length} unranked - Loop {loop ? "On" : "Off"}</span><span className="comparison-workspace-actions"><button type="button" disabled={!rankingIsComplete(ranking) || completedRegions.has(activeRegion) || completionBusy} onClick={markRegionComplete}><ActionIcon name="check" />{completedRegions.has(activeRegion) ? "Region Complete" : "Mark Region Complete"}</button><button type="button" disabled={!allRegionsComplete || completionBusy} onClick={() => void complete()}><ActionIcon name="check" />{completionBusy ? "Saving Results..." : "Reveal & Complete Comparison"}</button></span></footer>
  </section>;
}

const candidateFromPlaybackError = (error: unknown) =>
  error instanceof Error ? error.message.match(/Candidate ([A-Z])\b/)?.[1] ?? null : null;
