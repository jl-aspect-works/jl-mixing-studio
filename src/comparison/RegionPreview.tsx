import { useEffect, useMemo, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import { getProjectAudioWaveform, type ProjectAudioWaveform } from "../project/files/audioPreviewService";
import type { ComparisonCandidateAvailability } from "./models";
import { parseTimestamp } from "./session";

const locatorTimestamp = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  const display = Number.isInteger(remainder) ? String(remainder) : remainder.toFixed(1);
  return `${minutes}:${display.padStart(2, "0")}`;
};

export function RegionPreview({
  clientId, projectId, candidates, start, end, editRequest, onBoundsChange,
}: {
  clientId: string;
  projectId: string;
  candidates: readonly ComparisonCandidateAvailability[];
  start: string;
  end: string;
  editRequest: number;
  onBoundsChange: (start: string, end: string) => void;
}) {
  const available = useMemo(
    () => candidates.filter((candidate) => candidate.eligible && candidate.relativePath)
      .sort((left, right) => right.revisionNumber - left.revisionNumber),
    [candidates],
  );
  const [revisionId, setRevisionId] = useState(() => available[0]?.revisionId ?? "");
  const [waveform, setWaveform] = useState<ProjectAudioWaveform | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ id: number; seconds: number } | null>(null);
  const [seekToRegionStart, setSeekToRegionStart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidate = available.find((item) => item.revisionId === revisionId) ?? available[0] ?? null;

  useEffect(() => {
    if (!available.some((item) => item.revisionId === revisionId)) setRevisionId(available[0]?.revisionId ?? "");
  }, [available, revisionId]);

  useEffect(() => {
    let cancelled = false;
    setWaveform(null);
    setPlayhead(0);
    setError(null);
    if (!candidate?.relativePath) return () => { cancelled = true; };
    getProjectAudioWaveform({ clientId, projectId, relativePath: candidate.relativePath })
      .then((value) => { if (!cancelled) setWaveform(value); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { cancelled = true; };
  }, [candidate?.relativePath, clientId, projectId]);

  const duration = waveform?.durationSeconds ?? 0;
  const parsedStart = Math.min(parseTimestamp(start) ?? 0, duration || Number.MAX_SAFE_INTEGER);
  const parsedEnd = Math.min(parseTimestamp(end) ?? Math.min(30, duration), duration || Number.MAX_SAFE_INTEGER);
  const startPercent = duration ? parsedStart / duration * 100 : 0;
  const endPercent = duration ? parsedEnd / duration * 100 : 0;
  const setStart = (seconds: number) => {
    const next = Math.min(duration, Math.max(0, seconds));
    if (next >= parsedEnd) {
      const timestamp = locatorTimestamp(next);
      onBoundsChange(timestamp, timestamp);
      return;
    }
    onBoundsChange(locatorTimestamp(next), end);
  };
  const setEnd = (seconds: number) => onBoundsChange(start, locatorTimestamp(Math.max(seconds, parsedStart + .1)));
  const seekPreview = (seconds: number) => {
    const next = Math.min(duration, Math.max(0, seconds));
    setPlayhead(next);
    setSeekRequest((current) => ({ id: (current?.id ?? 0) + 1, seconds: next }));
  };
  useEffect(() => {
    if (editRequest > 0 && seekToRegionStart && duration > 0) seekPreview(parsedStart);
  // The edit request is the user action that triggers this optional seek.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest, duration]);

  if (!candidate?.relativePath) {
    return <div className="comparison-region-preview disabled" aria-disabled="true"><strong>Region preview</strong><p>No playable normal revision is available.</p></div>;
  }
  const label = `Revision ${String(candidate.revisionNumber).padStart(2, "0")}`;

  return <div className="comparison-region-preview">
    <div className="comparison-region-preview-heading"><strong>Region preview</strong><div className="comparison-locator-actions"><button type="button" className="secondary" disabled={!duration} onClick={() => setStart(playhead)}><ActionIcon name="previous" />Set start to playhead</button><button type="button" className="secondary" disabled={!duration} onClick={() => setEnd(playhead)}><ActionIcon name="next" />Set end to playhead</button><label><input type="checkbox" checked={seekToRegionStart} onChange={(event) => setSeekToRegionStart(event.target.checked)} />Set playhead to region start</label></div><label>Preview revision<select aria-label="Preview revision" value={candidate.revisionId} onChange={(event) => setRevisionId(event.target.value)}>{available.map((item) => <option key={item.revisionId} value={item.revisionId}>Revision {String(item.revisionNumber).padStart(2, "0")}</option>)}</select></label></div>
    <div className="comparison-waveform" aria-label={`Waveform for ${label}`}>
      {waveform ? <><svg viewBox={`0 0 ${waveform.peaks.length || 1} 100`} preserveAspectRatio="none" role="img">{waveform.peaks.map((peak, index) => <line key={index} x1={index + .5} x2={index + .5} y1={50 - peak * 48} y2={50 + peak * 48} />)}</svg>
        <span className="comparison-region-selection" style={{ left: `${startPercent}%`, width: `${Math.max(0, endPercent - startPercent)}%` }} />
        <input className="comparison-region-locator start" type="range" aria-label="Region start locator" min="0" max={duration} step="0.1" value={parsedStart} onChange={(event) => setStart(Number(event.target.value))} />
        <input className="comparison-region-locator end" type="range" aria-label="Region end locator" min="0" max={duration} step="0.1" value={parsedEnd} onChange={(event) => setEnd(Number(event.target.value))} /></> : <span>{error ? "Waveform unavailable" : "Loading waveform…"}</span>}
        <input className="comparison-playhead-locator" type="range" aria-label="Preview playhead" min="0" max={duration} step="0.1" value={Math.min(playhead, duration)} onChange={(event) => seekPreview(Number(event.target.value))} />
    </div>
    <AudioPreviewPlayer clientId={clientId} projectId={projectId} entry={{ relativePath: candidate.relativePath, displayName: label }} durationSeconds={duration} standardTransport onPositionChange={setPlayhead} seekRequest={seekRequest} />
    {error && <small className="comparison-preview-error">{error}</small>}
  </div>;
}
