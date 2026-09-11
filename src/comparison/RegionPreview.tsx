import { useEffect, useState } from "react";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import { getProjectAudioWaveform, type ProjectAudioWaveform } from "../project/files/audioPreviewService";
import type { ComparisonCandidateAvailability } from "./models";

export function RegionPreview({
  clientId,
  projectId,
  candidate,
}: {
  clientId: string;
  projectId: string;
  candidate: ComparisonCandidateAvailability | null;
}) {
  const [waveform, setWaveform] = useState<ProjectAudioWaveform | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWaveform(null);
    setError(null);
    if (!candidate?.relativePath) return () => { cancelled = true; };
    getProjectAudioWaveform({ clientId, projectId, relativePath: candidate.relativePath })
      .then((value) => { if (!cancelled) setWaveform(value); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { cancelled = true; };
  }, [candidate?.relativePath, clientId, projectId]);

  if (!candidate?.relativePath) {
    return <div className="comparison-region-preview disabled" aria-disabled="true"><strong>Region preview</strong><p>Select at least one revision to enable preview.</p></div>;
  }

  const label = `Revision ${String(candidate.revisionNumber).padStart(2, "0")}`;
  return <div className="comparison-region-preview">
    <div className="comparison-region-preview-heading"><strong>Region preview</strong><span>Using highest selected: {label}</span></div>
    <div className="comparison-waveform" aria-label={`Waveform for ${label}`}>
      {waveform ? <svg viewBox={`0 0 ${waveform.peaks.length || 1} 100`} preserveAspectRatio="none" role="img">
        {waveform.peaks.map((peak, index) => <line key={index} x1={index + .5} x2={index + .5} y1={50 - peak * 48} y2={50 + peak * 48} />)}
      </svg> : <span>{error ? "Waveform unavailable" : "Loading waveform…"}</span>}
    </div>
    <AudioPreviewPlayer
      clientId={clientId}
      projectId={projectId}
      entry={{ relativePath: candidate.relativePath, displayName: label }}
      durationSeconds={waveform?.durationSeconds}
      standardTransport
    />
    {error && <small className="comparison-preview-error">{error}</small>}
  </div>;
}
