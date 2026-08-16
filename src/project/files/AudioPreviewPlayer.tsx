import { useEffect, useRef, useState } from "react";
import type { ProjectFileEntry } from "./projectFileService";
import { prepareProjectAudioPreview } from "./audioPreviewService";
import "./AudioPreviewPlayer.css";

let activeAudioElement: HTMLAudioElement | null = null;

const previewErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "This audio file could not be prepared for preview.";

const formatPreviewTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const VolumeIcon = ({ muted }: { muted: boolean }) => <svg className="audio-preview-volume-icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4.5 9.5H8l4-3.5v12l-4-3.5H4.5z" />
  {!muted && <>
    <path d="M15.2 9.1c1.1 1.1 1.1 4.7 0 5.8" />
    <path d="M17.7 6.8c2.5 2.5 2.5 7.9 0 10.4" />
  </>}
  {muted && <path d="M15.5 9.5l4 5m0-5l-4 5" />}
</svg>;

export function AudioPreviewPlayer({
  clientId,
  projectId,
  entry,
  durationSeconds = 0,
}: {
  clientId: string;
  projectId: string;
  entry: ProjectFileEntry;
  durationSeconds?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preparePromiseRef = useRef<Promise<string | null> | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    preparePromiseRef.current = null;
    setSourceUrl(null);
    setLoading(false);
    setError(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(durationSeconds ?? 0);
    setVolume(1);
    setMuted(false);

    const audio = audioRef.current;
    return () => {
      if (audio && activeAudioElement === audio) activeAudioElement = null;
      audio?.pause();
    };
  }, [clientId, projectId, entry.relativePath, durationSeconds]);

  const ensureSource = async () => {
    if (sourceUrl) return sourceUrl;
    if (!preparePromiseRef.current) {
      setLoading(true);
      setError(null);
      preparePromiseRef.current = prepareProjectAudioPreview({ clientId, projectId, relativePath: entry.relativePath })
        .then((prepared) => {
          const nextSource = prepared?.sourceUrl ?? null;
          if (!nextSource) setError("Audio preview is not available on this platform.");
          setSourceUrl(nextSource);
          return nextSource;
        })
        .catch((reason) => {
          setError(previewErrorMessage(reason));
          return null;
        })
        .finally(() => {
          setLoading(false);
          preparePromiseRef.current = null;
        });
    }
    return preparePromiseRef.current;
  };

  const togglePlayback = async () => {
    const current = audioRef.current;
    if (!current || loading) return;
    if (!current.paused) {
      current.pause();
      return;
    }

    const preparedSource = await ensureSource();
    if (!preparedSource) return;
    if (current.src !== preparedSource) {
      current.src = preparedSource;
      current.load();
    }
    if (activeAudioElement && activeAudioElement !== current) activeAudioElement.pause();
    activeAudioElement = current;
    try {
      await current.play();
    } catch {
      setError("This audio file could not be played by the macOS WebView.");
    }
  };

  const seek = (value: number) => {
    if (!Number.isFinite(value)) return;
    const current = audioRef.current;
    if (current && sourceUrl) current.currentTime = value;
    setCurrentTime(value);
  };

  const changeVolume = (value: number) => {
    const nextVolume = Math.min(1, Math.max(0, value));
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
      audioRef.current.muted = nextVolume === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (audioRef.current) audioRef.current.muted = nextMuted;
  };

  return <div className="audio-preview-inline" aria-label={`Preview ${entry.displayName}`} aria-busy={loading}>
    <audio
      ref={audioRef}
      preload="none"
      onPlay={() => { setPlaying(true); setError(null); }}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || durationSeconds || 0)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onError={() => sourceUrl && setError("This audio file could not be played by the macOS WebView.")}
    />
    <button type="button" className="audio-preview-play" aria-label={playing ? `Pause ${entry.displayName}` : `Play ${entry.displayName}`} title={playing ? "Pause" : "Play"} disabled={loading} onClick={() => void togglePlayback()}>{loading ? "…" : playing ? "❚❚" : "▶"}</button>
    <span className="audio-preview-time">{formatPreviewTime(currentTime)}</span>
    <input className="audio-preview-seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label={`Seek ${entry.displayName}`} disabled={!duration} onChange={(event) => seek(Number(event.target.value))} />
    <span className="audio-preview-time">{formatPreviewTime(duration)}</span>
    <button type="button" className="audio-preview-mute" aria-label={muted ? `Unmute ${entry.displayName}` : `Mute ${entry.displayName}`} title={muted ? "Unmute" : "Mute"} onClick={toggleMute}><VolumeIcon muted={muted || volume === 0} /></button>
    <input className="audio-preview-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label={`Volume ${entry.displayName}`} onChange={(event) => changeVolume(Number(event.target.value))} />
    {error && <span className="audio-preview-error" title={error}>!</span>}
  </div>;
}
