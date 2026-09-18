import { useEffect, useId, useRef, useState } from "react";
import { ActionIcon } from "../../components/ActionIcon";
import { claimAudioPlayback, releaseAudioPlayback, stopAudioPlayback } from "./audioPlaybackController";
import {
  getNativeProjectAudioPreviewStatus,
  loadNativeProjectAudioPreview,
  pauseNativeProjectAudioPreview,
  playNativeProjectAudioPreview,
  prepareProjectAudioPreview,
  resolveCompactAudioSource,
  stopNativeProjectAudioPreview,
  type CompactAudioSourceResult,
  type PreparedAudioPreview,
} from "./audioPreviewService";
import "./CompactAudioPreview.css";

let compactPreviewSequence = 0;

type SourceState =
  | { status: "idle" }
  | { status: "ready"; source: CompactAudioSourceResult & { relativePath: string; displayName: string } }
  | { status: "unavailable"; reason: string };

const previewError = (error: unknown) => error instanceof Error && error.message
  ? error.message
  : typeof error === "string" && error
    ? error
    : "This audio preview could not be played.";

export function CompactAudioPreview({
  clientId,
  projectId,
  revision = null,
  delivery = false,
  label,
}: {
  clientId: string;
  projectId: string;
  revision?: number | null;
  delivery?: boolean;
  label: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preparedRef = useRef<PreparedAudioPreview | null>(null);
  const nativeLoadedRef = useRef(false);
  const sessionIdRef = useRef(`compact-audio-preview-${compactPreviewSequence += 1}`);
  const statusId = useId();
  const [sourceState, setSourceState] = useState<SourceState>(() => !delivery && revision === null
    ? { status: "unavailable", reason: "No current revision is available." }
    : { status: "idle" });
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const sessionId = sessionIdRef.current;

  useEffect(() => {
    preparedRef.current = null;
    nativeLoadedRef.current = false;
    setPlaying(false);
    setFailure(null);
    if (!delivery && revision === null) {
      setSourceState({ status: "unavailable", reason: "No current revision is available." });
    } else {
      setSourceState({ status: "idle" });
    }
    return () => {
      void stopAudioPlayback(sessionId);
    };
  }, [clientId, projectId, revision, delivery, sessionId]);

  useEffect(() => {
    if (!playing || preparedRef.current?.provider !== "native") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await getNativeProjectAudioPreviewStatus();
        if (cancelled || sourceState.status !== "ready" || status.relativePath !== sourceState.source.relativePath) return;
        setPlaying(status.playing);
        if (!status.playing) {
          nativeLoadedRef.current = false;
          releaseAudioPlayback(sessionId);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setPlaying(false);
          setFailure(previewError(error));
          releaseAudioPlayback(sessionId);
        }
      }
    };
    const interval = window.setInterval(() => void refresh(), 250);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [playing, sessionId, sourceState]);

  const stopOwnPlayback = async () => {
    if (preparedRef.current?.provider === "native" || nativeLoadedRef.current) {
      await stopNativeProjectAudioPreview();
      nativeLoadedRef.current = false;
    } else {
      audioRef.current?.pause();
    }
    setPlaying(false);
  };

  const togglePlayback = async () => {
    if (sourceState.status === "unavailable" || loading) return;
    setFailure(null);
    setLoading(true);
    try {
      let source = sourceState.status === "ready" ? sourceState.source : null;
      if (!source) {
        const resolved = await resolveCompactAudioSource({ clientId, projectId, revision, delivery });
        if (!resolved.available || !resolved.relativePath || !resolved.displayName) {
          setSourceState({ status: "unavailable", reason: resolved.reason || "Audio preview is unavailable." });
          return;
        }
        source = { ...resolved, relativePath: resolved.relativePath, displayName: resolved.displayName };
        setSourceState({ status: "ready", source });
      }
      const request = { clientId, projectId, relativePath: source.relativePath };
      if (!preparedRef.current) preparedRef.current = await prepareProjectAudioPreview(request);
      const prepared = preparedRef.current;
      if (!prepared) {
        setFailure("Audio preview is not available on this platform.");
        return;
      }
      if (prepared.provider === "native") {
        if (playing) {
          const status = await pauseNativeProjectAudioPreview();
          setPlaying(status.playing);
          return;
        }
        if (!await claimAudioPlayback(sessionId, stopOwnPlayback)) {
          setFailure("Audio preview is unavailable while a comparison session is active.");
          return;
        }
        if (!nativeLoadedRef.current) {
          await loadNativeProjectAudioPreview(request);
          nativeLoadedRef.current = true;
        }
        const status = await playNativeProjectAudioPreview();
        setPlaying(status.playing);
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) {
        audio.pause();
        return;
      }
      if (audio.src !== prepared.sourceUrl) {
        audio.src = prepared.sourceUrl;
        audio.load();
      }
      if (!await claimAudioPlayback(sessionId, () => {
        audio.pause();
        setPlaying(false);
      })) {
        setFailure("Audio preview is unavailable while a comparison session is active.");
        return;
      }
      await audio.play();
    } catch (error: unknown) {
      releaseAudioPlayback(sessionId);
      setPlaying(false);
      setFailure(previewError(error));
    } finally {
      setLoading(false);
    }
  };

  const unavailable = sourceState.status === "unavailable";
  const status = failure
    ?? (loading ? "Preparing audio preview…" : unavailable ? sourceState.reason : null);
  const accessibleLabel = playing ? `Pause ${label}` : `Play ${label}`;

  return <span
    className={`compact-audio-preview${unavailable || failure ? " unavailable" : ""}`}
    title={status ?? (playing ? `Pause ${label}` : `Play ${label}`)}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    <audio
      ref={audioRef}
      preload="none"
      onPlay={() => { setPlaying(true); setFailure(null); }}
      onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); releaseAudioPlayback(sessionId); }}
      onError={() => {
        if (preparedRef.current?.provider !== "web") return;
        setPlaying(false);
        releaseAudioPlayback(sessionId);
        setFailure("This audio file could not be played by the macOS WebView.");
      }}
    />
    <button
      type="button"
      className="compact-audio-preview-button"
      aria-label={accessibleLabel}
      aria-describedby={status ? statusId : undefined}
      aria-busy={loading}
      disabled={loading || unavailable}
      onClick={() => void togglePlayback()}
    >
      <ActionIcon name={playing ? "pause" : "play"} />
    </button>
    {status && <span id={statusId} className="compact-audio-preview-status">{status}</span>}
    {failure && <span className="compact-audio-preview-alert" role="status" aria-label={failure}>!</span>}
  </span>;
}
