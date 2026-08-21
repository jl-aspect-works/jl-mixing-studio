import { useEffect, useRef, useState } from "react";
import { ActionIcon } from "../../components/ActionIcon";
import { claimAudioPlayback, releaseAudioPlayback, stopAudioPlayback } from "./audioPlaybackController";
import {
  getNativeProjectAudioPreviewStatus,
  loadNativeProjectAudioPreview,
  pauseNativeProjectAudioPreview,
  playNativeProjectAudioPreview,
  prepareProjectAudioPreview,
  seekNativeProjectAudioPreview,
  setNativeProjectAudioPreviewVolume,
  stopNativeProjectAudioPreview,
  type PreparedAudioPreview,
} from "./audioPreviewService";
import type { ProjectFileEntry } from "./projectFileService";
import "./AudioPreviewPlayer.css";

let previewSequence = 0;

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

const VolumeIcon = ({ muted }: { muted: boolean }) => <svg className="shared-audio-preview-volume-icon" viewBox="0 0 24 24" aria-hidden="true">
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
  const preparePromiseRef = useRef<Promise<PreparedAudioPreview | null> | null>(null);
  const nativeLoadedRef = useRef(false);
  const sessionIdRef = useRef(`audio-preview-${previewSequence += 1}`);
  const [prepared, setPrepared] = useState<PreparedAudioPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const request = { clientId, projectId, relativePath: entry.relativePath };
  const sessionId = sessionIdRef.current;

  useEffect(() => {
    preparePromiseRef.current = null;
    nativeLoadedRef.current = false;
    setPrepared(null);
    setLoading(false);
    setError(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(durationSeconds ?? 0);
    setVolume(1);
    setMuted(false);

    const audio = audioRef.current;
    return () => {
      audio?.pause();
      void stopAudioPlayback(sessionId);
    };
  }, [clientId, projectId, entry.relativePath, durationSeconds, sessionId]);

  useEffect(() => {
    if (prepared?.provider !== "native" || !playing) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await getNativeProjectAudioPreviewStatus();
        if (cancelled || status.relativePath !== entry.relativePath) return;
        setCurrentTime(status.currentSeconds);
        setDuration(status.durationSeconds || durationSeconds || 0);
        setPlaying(status.playing);
        if (!status.playing && status.durationSeconds > 0 && status.currentSeconds >= status.durationSeconds - 0.2) {
          await stopNativeProjectAudioPreview();
          nativeLoadedRef.current = false;
          releaseAudioPlayback(sessionId);
        }
      } catch (reason) {
        if (!cancelled) {
          setPlaying(false);
          setError(previewErrorMessage(reason));
        }
      }
    };
    const interval = window.setInterval(() => void refresh(), 200);
    void refresh();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [prepared, playing, entry.relativePath, durationSeconds, sessionId]);

  const ensurePrepared = async () => {
    if (prepared) return prepared;
    if (!preparePromiseRef.current) {
      setLoading(true);
      setError(null);
      preparePromiseRef.current = prepareProjectAudioPreview(request)
        .then((nextPrepared) => {
          if (!nextPrepared) setError("Audio preview is not available on this platform.");
          setPrepared(nextPrepared);
          return nextPrepared;
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

  const stopOwnPlayback = async () => {
    if (prepared?.provider === "native" || nativeLoadedRef.current) {
      await stopNativeProjectAudioPreview();
      nativeLoadedRef.current = false;
    } else {
      audioRef.current?.pause();
    }
    setPlaying(false);
  };

  const togglePlayback = async () => {
    if (loading) return;
    const nextPrepared = await ensurePrepared();
    if (!nextPrepared) return;

    try {
      if (nextPrepared.provider === "native") {
        if (playing) {
          const status = await pauseNativeProjectAudioPreview();
          setPlaying(status.playing);
          setCurrentTime(status.currentSeconds);
          return;
        }
        await claimAudioPlayback(sessionId, stopOwnPlayback);
        if (!nativeLoadedRef.current) {
          const loaded = await loadNativeProjectAudioPreview(request);
          nativeLoadedRef.current = true;
          setCurrentTime(loaded.currentSeconds);
          setDuration(loaded.durationSeconds || durationSeconds || 0);
        }
        await setNativeProjectAudioPreviewVolume(muted ? 0 : volume);
        const status = await playNativeProjectAudioPreview();
        setPlaying(status.playing);
        setError(null);
        return;
      }

      const current = audioRef.current;
      if (!current) return;
      if (!current.paused) {
        current.pause();
        return;
      }
      if (current.src !== nextPrepared.sourceUrl) {
        current.src = nextPrepared.sourceUrl;
        current.load();
      }
      await claimAudioPlayback(sessionId, () => {
        current.pause();
        setPlaying(false);
      });
      await current.play();
    } catch (reason) {
      releaseAudioPlayback(sessionId);
      setPlaying(false);
      setError(previewErrorMessage(reason));
    }
  };

  const seek = (value: number) => {
    if (!Number.isFinite(value)) return;
    setCurrentTime(value);
    if (prepared?.provider === "native" && nativeLoadedRef.current) {
      void seekNativeProjectAudioPreview(value)
        .then((status) => setCurrentTime(status.currentSeconds))
        .catch((reason) => setError(previewErrorMessage(reason)));
      return;
    }
    const current = audioRef.current;
    if (current && prepared?.provider === "web") current.currentTime = value;
  };

  const changeVolume = (value: number) => {
    const nextVolume = Math.min(1, Math.max(0, value));
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
    if (prepared?.provider === "native" && nativeLoadedRef.current) {
      void setNativeProjectAudioPreviewVolume(nextVolume)
        .catch((reason) => setError(previewErrorMessage(reason)));
    }
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
      audioRef.current.muted = nextVolume === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (prepared?.provider === "native" && nativeLoadedRef.current) {
      void setNativeProjectAudioPreviewVolume(nextMuted ? 0 : volume)
        .catch((reason) => setError(previewErrorMessage(reason)));
    }
    if (audioRef.current) audioRef.current.muted = nextMuted;
  };

  return <div className="shared-audio-preview-inline" aria-label={`Preview ${entry.displayName}`} aria-busy={loading}>
    <audio
      ref={audioRef}
      preload="none"
      onPlay={() => { setPlaying(true); setError(null); }}
      onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); releaseAudioPlayback(sessionId); }}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || durationSeconds || 0)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onError={() => prepared?.provider === "web" && setError("This audio file could not be played by the macOS WebView.")}
    />
    <button type="button" className="shared-audio-preview-play icon-only" aria-label={playing ? `Pause ${entry.displayName}` : `Play ${entry.displayName}`} title={playing ? "Pause" : "Play"} disabled={loading} onClick={() => void togglePlayback()}>{loading ? "…" : <ActionIcon name={playing ? "pause" : "play"} />}</button>
    <span className="shared-audio-preview-time">{formatPreviewTime(currentTime)}</span>
    <input className="shared-audio-preview-seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label={`Seek ${entry.displayName}`} disabled={!duration} onChange={(event) => seek(Number(event.target.value))} />
    <span className="shared-audio-preview-time">{formatPreviewTime(duration)}</span>
    <button type="button" className="shared-audio-preview-mute" aria-label={muted ? `Unmute ${entry.displayName}` : `Mute ${entry.displayName}`} title={muted ? "Unmute" : "Mute"} onClick={toggleMute}><VolumeIcon muted={muted || volume === 0} /></button>
    <input className="shared-audio-preview-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label={`Volume ${entry.displayName}`} onChange={(event) => changeVolume(Number(event.target.value))} />
    {error && <span className="shared-audio-preview-error" title={error}>!</span>}
  </div>;
}
