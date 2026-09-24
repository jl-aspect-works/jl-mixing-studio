import { measureComparison } from "./performance";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { claimExclusiveAudioPlayback, releaseAudioPlayback } from "../project/files/audioPlaybackController";
import type { ProjectAudioPreviewResult } from "../project/files/audioPreviewService";
import type { FrozenComparisonCandidate, ProjectRegion } from "./models";

export type ComparisonPlaybackSnapshot = {
  activeCandidateId: string;
  playing: boolean;
  currentSeconds: number;
  durationSeconds: number;
  providerPaused?: boolean;
  providerEnded?: boolean;
  readyState?: number;
  networkState?: number;
};

export type PreparedCandidate = FrozenComparisonCandidate & { sourceUrl: string | null };

export interface ComparisonAudioProvider {
  prepare(candidates: readonly PreparedCandidate[], startSeconds: number): Promise<Map<string, number>>;
  play(): Promise<ComparisonPlaybackSnapshot>;
  pause(): Promise<ComparisonPlaybackSnapshot>;
  seek(seconds: number): Promise<ComparisonPlaybackSnapshot>;
  switchCandidate(candidateId: string): Promise<ComparisonPlaybackSnapshot>;
  setVolume(volume: number): Promise<ComparisonPlaybackSnapshot>;
  status(): Promise<ComparisonPlaybackSnapshot>;
  dispose(): Promise<void>;
}

const playbackError = (candidateId: string, action: string) =>
  new Error(`Candidate ${candidateId} could not be ${action}.`);

type PlaybackDiagnosticAction = "session_ready" | "toggle" | "candidate_switch" | "loop_restart" | "playback_end" | "retry" | "status";
type PlaybackDiagnosticOutcome = "started" | "success" | "error";
type PlaybackProviderKind = "web" | "native" | "unknown";
type PlaybackDiagnosticFields = {
  provider: PlaybackProviderKind;
  revisionId?: string;
  revisionNumber?: number;
  blindId?: string;
  targetRevisionId?: string;
  targetRevisionNumber?: number;
  targetBlindId?: string;
  candidateCount: number;
  loopEnabled: boolean;
  playRequested: boolean;
  providerPlaying: boolean;
  fullSong: boolean;
  atRegionEnd: boolean;
  positionMs: number;
  regionEndMs: number;
  providerPaused?: boolean;
  providerEnded?: boolean;
  readyState?: number;
  networkState?: number;
};
let playbackDiagnosticSequence = 0;

const writePlaybackDiagnostic = (
  action: PlaybackDiagnosticAction,
  outcome: PlaybackDiagnosticOutcome,
  operationId: string,
  fields: PlaybackDiagnosticFields,
) => {
  if (!("__TAURI_INTERNALS__" in window)) return;
  void invoke("log_comparison_playback", { request: { action, outcome, operationId, ...fields } }).catch(() => {
    // Diagnostics are best-effort and must never interrupt playback.
  });
};

const startPlaybackDiagnostic = (action: PlaybackDiagnosticAction, fields: PlaybackDiagnosticFields) => {
  const operationId = `${Date.now()}-${++playbackDiagnosticSequence}`;
  writePlaybackDiagnostic(action, "started", operationId, fields);
  return (outcome: Exclude<PlaybackDiagnosticOutcome, "started">, finalFields: PlaybackDiagnosticFields) =>
    writePlaybackDiagnostic(action, outcome, operationId, finalFields);
};

export class WebComparisonAudioProvider implements ComparisonAudioProvider {
  private readonly channels = new Map<string, HTMLAudioElement>();
  private readonly matchGains = new Map<string, number>();
  private readonly failures = new Set<string>();
  private activeCandidateId = "";
  private volume = 1;

  constructor(private readonly createAudio = () => document.createElement("audio")) {}

  async prepare(candidates: readonly PreparedCandidate[], startSeconds: number) {
    await this.dispose();
    const durations = new Map<string, number>();
    for (const candidate of candidates) {
      if (!candidate.sourceUrl) throw playbackError(candidate.blindId, "prepared");
      const audio = this.createAudio();
      audio.preload = "metadata";
      audio.src = candidate.sourceUrl;
      this.matchGains.set(candidate.blindId, gainScalar(candidate.appliedGainDb));
      audio.volume = this.effectiveVolume(candidate.blindId);
      const duration = await waitForMetadata(audio).catch(() => {
        throw playbackError(candidate.blindId, "prepared");
      });
      audio.addEventListener("error", () => this.failures.add(candidate.blindId));
      audio.currentTime = Math.min(startSeconds, duration);
      this.channels.set(candidate.blindId, audio);
      durations.set(candidate.blindId, duration);
    }
    this.activeCandidateId = candidates[0]?.blindId ?? "";
    return durations;
  }

  async play() {
    const active = this.active();
    this.failures.delete(this.activeCandidateId);
    try {
      await active.play();
    } catch {
      throw playbackError(this.activeCandidateId, "played");
    }
    return this.snapshot(active);
  }

  async pause() {
    const active = this.active();
    active.pause();
    return this.snapshot(active);
  }

  async seek(seconds: number) {
    const active = this.active();
    active.currentTime = clampPosition(seconds, active.duration);
    this.synchronizeInactive(active.currentTime);
    return this.snapshot(active);
  }

  async switchCandidate(candidateId: string) {
    this.throwRuntimeFailure();
    const current = this.active();
    const authoritativePosition = current.currentTime;
    const wasPlaying = !current.paused && !current.ended;
    current.pause();
    const target = this.channels.get(candidateId);
    if (!target) throw playbackError(candidateId, "selected");
    target.currentTime = clampPosition(authoritativePosition, target.duration);
    this.activeCandidateId = candidateId;
    if (wasPlaying) {
      try {
        await target.play();
      } catch {
        throw playbackError(candidateId, "played");
      }
    }
    this.synchronizeInactive(target.currentTime);
    return this.snapshot(target);
  }

  async setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.channels.forEach((channel, candidateId) => { channel.volume = this.effectiveVolume(candidateId); });
    return this.snapshot(this.active());
  }

  async status() {
    this.throwRuntimeFailure();
    return this.snapshot(this.active());
  }

  async dispose() {
    this.channels.forEach((channel) => {
      channel.pause();
      channel.removeAttribute("src");
      channel.load();
    });
    this.channels.clear();
    this.matchGains.clear();
    this.failures.clear();
    this.activeCandidateId = "";
  }

  private active() {
    const active = this.channels.get(this.activeCandidateId);
    if (!active) throw new Error("Comparison audio is not prepared.");
    return active;
  }

  private snapshot(active: HTMLAudioElement): ComparisonPlaybackSnapshot {
    return {
      activeCandidateId: this.activeCandidateId,
      playing: !active.paused && !active.ended,
      currentSeconds: active.currentTime,
      durationSeconds: Number.isFinite(active.duration) ? active.duration : 0,
      providerPaused: active.paused,
      providerEnded: active.ended,
      readyState: active.readyState,
      networkState: active.networkState,
    };
  }

  private synchronizeInactive(position: number) {
    this.channels.forEach((channel, candidateId) => {
      if (candidateId !== this.activeCandidateId && Math.abs(channel.currentTime - position) >= 0.35) {
        channel.currentTime = clampPosition(position, channel.duration);
      }
    });
  }

  private throwRuntimeFailure() {
    const candidateId = this.failures.values().next().value;
    if (candidateId) throw playbackError(candidateId, "played");
  }

  private effectiveVolume(candidateId: string) {
    return this.volume * (this.matchGains.get(candidateId) ?? 1);
  }
}

type NativeCandidateStatus = { blindId: string; durationSeconds: number };
type NativeComparisonStatus = ComparisonPlaybackSnapshot & { candidates?: NativeCandidateStatus[] };

export class NativeComparisonAudioProvider implements ComparisonAudioProvider {
  async prepare(candidates: readonly PreparedCandidate[], startSeconds: number) {
    const status = await invoke<NativeComparisonStatus>("prepare_native_comparison_audio", {
      request: {
        candidates: candidates.map((candidate) => ({
          blindId: candidate.blindId,
          clientId: this.clientId,
          projectId: this.projectId,
          relativePath: candidate.relativePath,
          appliedGainDb: candidate.appliedGainDb,
        })),
        startSeconds,
      },
    });
    return new Map((status.candidates ?? []).map((candidate) => [candidate.blindId, candidate.durationSeconds]));
  }

  constructor(private readonly clientId: string, private readonly projectId: string) {}

  play = () => invoke<NativeComparisonStatus>("play_native_comparison_audio");
  pause = () => invoke<NativeComparisonStatus>("pause_native_comparison_audio");
  seek = (seconds: number) => invoke<NativeComparisonStatus>("seek_native_comparison_audio", { seconds });
  switchCandidate = (candidateId: string) => invoke<NativeComparisonStatus>("switch_native_comparison_candidate", { candidateId });
  setVolume = (volume: number) => invoke<NativeComparisonStatus>("set_native_comparison_audio_volume", { volume });
  status = () => invoke<NativeComparisonStatus>("get_native_comparison_audio_status");
  async dispose() { await invoke("stop_native_comparison_audio"); }
}

let comparisonSequence = 0;

export class ComparisonPlaybackSession {
  private readonly ownershipId = `comparison-playback-${comparisonSequence += 1}`;
  private provider: ComparisonAudioProvider | null = null;
  private activeRegion: ProjectRegion;
  private loop = true;
  private playRequested = false;
  private disposed = false;
  private providerKind: PlaybackProviderKind = "unknown";
  private lastStatus: ComparisonPlaybackSnapshot | null = null;
  private candidateDurations = new Map<string, number>();

  constructor(
    private readonly clientId: string,
    private readonly projectId: string,
    private readonly candidates: readonly FrozenComparisonCandidate[],
    private readonly regions: readonly ProjectRegion[],
    initialRegion: ProjectRegion,
    private readonly providerFactory?: (kind: "web" | "native") => ComparisonAudioProvider,
  ) {
    this.activeRegion = initialRegion;
  }

  private preparation: Promise<ComparisonPlaybackSnapshot> | null = null;

  prepare(onProgress?: (text: string) => void): Promise<ComparisonPlaybackSnapshot> {
    if (this.preparation) return this.preparation;
    this.preparation = this.prepareOnce(onProgress).finally(() => { this.preparation = null; });
    return this.preparation;
  }

  private async prepareOnce(onProgress?: (text: string) => void) {
    onProgress?.(`Resolving audio sources: 0 of ${this.candidates.length}…`);
    if (this.disposed) throw new Error("Comparison playback session is closed.");
    await claimExclusiveAudioPlayback(this.ownershipId, () => this.stopProvider());
    try {
      if (this.disposed) throw new Error("Comparison playback session is closed.");
      const sources = await measureComparison("candidate_source", () => invoke<ProjectAudioPreviewResult[]>("prepare_comparison_sources", {
        request: { clientId: this.clientId, projectId: this.projectId,
          candidates: this.candidates.map(({ blindId, relativePath }) => ({ blindId, relativePath })) },
      }), this.candidates.length);
      const prepared = this.candidates.map((candidate, index) => {
        const source = sources[index];
        if (!source || source.relativePath !== candidate.relativePath) throw playbackError(candidate.blindId, "prepared");
        return { ...candidate, sourceUrl: source.supported && source.filePath ? convertFileSrc(source.filePath) : null,
          provider: source.supported ? "web" as const : "native" as const };
      });
      onProgress?.(`Resolved all ${prepared.length} audio sources…`);
      if (this.disposed) throw new Error("Comparison playback session is closed.");
      const providerKind = prepared[0]?.provider;
      if (!providerKind || prepared.some((candidate) => candidate.provider !== providerKind)) {
        throw new Error("Comparison candidates could not use one audio provider.");
      }
      this.provider = this.providerFactory?.(providerKind)
        ?? (providerKind === "web" ? new WebComparisonAudioProvider() : new NativeComparisonAudioProvider(this.clientId, this.projectId));
      this.providerKind = providerKind;
      onProgress?.(`Loading audio and checking durations for all ${prepared.length} candidates…`);
      const durations = await measureComparison("audio_prepare", () => this.provider!.prepare(prepared, this.activeRegion.startSeconds), prepared.length);
      this.regions.forEach((region) => validateRegionDurations(this.candidates, region, durations));
      this.candidateDurations = durations;
      const status = this.remember(await this.provider.status());
      this.logDiagnostic("session_ready", "success", status);
      return status;
    } catch (error) {
      await this.stopProvider();
      releaseAudioPlayback(this.ownershipId);
      throw error;
    }
  }

  async toggle() {
    const provider = this.requireProvider();
    const finish = this.startDiagnostic("toggle");
    try {
      const status = this.remember(await provider.status());
      this.playRequested = !status.playing;
      if (!status.playing && status.currentSeconds >= this.effectiveEnd(status)) {
        await provider.seek(this.activeRegion.startSeconds);
      }
      const next = this.remember(this.normalizePlaybackState(status.playing ? await provider.pause() : await provider.play()));
      finish("success", this.diagnosticFields(next));
      return next;
    } catch (error) {
      finish("error", this.diagnosticFields());
      throw error;
    }
  }

  async pause() {
    this.playRequested = false;
    return this.remember(await this.requireProvider().pause());
  }

  async switchCandidate(candidateId: string) {
    const finish = this.startDiagnostic("candidate_switch", candidateId);
    try {
      const provider = this.requireProvider();
      const current = await provider.status();
      const duration = this.candidateDurations.get(candidateId);
      if (duration === undefined) throw playbackError(candidateId, "selected");
      const targetEnd = Math.min(this.activeRegion.endSeconds ?? duration, duration);
      if (current.currentSeconds >= targetEnd) {
        // Never ask a provider to seek/play a shorter candidate at EOF.
        await provider.pause();
        await provider.seek(this.activeRegion.startSeconds);
      }
      const switched = await measureComparison("candidate_switch", () => provider.switchCandidate(candidateId));
      const next = this.remember(this.normalizePlaybackState(current.currentSeconds >= targetEnd && this.playRequested
        ? await provider.play() : switched));
      finish("success", this.diagnosticFields(next, candidateId));
      return next;
    } catch (error) {
      finish("error", this.diagnosticFields(undefined, candidateId));
      throw error;
    }
  }

  async seek(seconds: number) {
    return this.remember(await this.requireProvider().seek(this.boundPosition(seconds)));
  }

  async setRegion(region: ProjectRegion) {
    this.activeRegion = region;
    this.loop = true;
    const provider = this.requireProvider();
    const next = await provider.seek(region.startSeconds);
    if (this.playRequested) return this.remember(this.normalizePlaybackState(await provider.play()));
    return this.remember(this.normalizePlaybackState(next));
  }

  setLoop(loop: boolean) { this.loop = loop; }

  async setVolume(volume: number) { return this.remember(await this.requireProvider().setVolume(volume)); }

  async refresh() {
    const provider = this.requireProvider();
    let status: ComparisonPlaybackSnapshot;
    try {
      status = this.remember(await provider.status());
    } catch (error) {
      this.logDiagnostic("status", "error");
      throw error;
    }
    const end = this.effectiveEnd(status);
    const endTolerance = Math.min(0.04, (end - this.activeRegion.startSeconds) / 4);
    if (this.playRequested && this.loop && status.currentSeconds >= end - endTolerance) {
      const finish = this.startDiagnostic("loop_restart");
      try {
        await provider.seek(this.activeRegion.startSeconds);
        const next = this.remember(this.normalizePlaybackState(await provider.play()));
        finish("success", this.diagnosticFields(next));
        return next;
      } catch (error) {
        finish("error", this.diagnosticFields());
        throw error;
      }
    }
    if (!status.playing && status.currentSeconds >= end - endTolerance) {
      this.playRequested = false;
      this.logDiagnostic("playback_end", "success", status);
    }
    return this.remember(this.normalizePlaybackState(status));
  }

  async retry() {
    const provider = this.requireProvider();
    const finish = this.startDiagnostic("retry");
    try {
      const status = await provider.status();
      await provider.seek(status.currentSeconds >= this.effectiveEnd(status)
        ? this.activeRegion.startSeconds : this.boundPosition(status.currentSeconds));
      this.playRequested = true;
      const next = this.remember(this.normalizePlaybackState(await provider.play()));
      finish("success", this.diagnosticFields(next));
      return next;
    } catch (error) {
      finish("error", this.diagnosticFields());
      throw error;
    }
  }

  async dispose() {
    this.disposed = true;
    this.playRequested = false;
    await this.stopProvider();
    releaseAudioPlayback(this.ownershipId);
  }

  private requireProvider() {
    if (!this.provider) throw new Error("Comparison audio is not prepared.");
    return this.provider;
  }

  private boundPosition(seconds: number) {
    const end = this.lastStatus ? this.effectiveEnd(this.lastStatus) : this.activeRegion.endSeconds;
    return Math.max(this.activeRegion.startSeconds, end === null ? seconds : Math.min(seconds, end));
  }

  private effectiveEnd(status: ComparisonPlaybackSnapshot) {
    return Math.min(this.activeRegion.endSeconds ?? status.durationSeconds, status.durationSeconds);
  }

  private async stopProvider() {
    const provider = this.provider;
    this.provider = null;
    if (provider) await provider.dispose();
    this.providerKind = "unknown";
    this.lastStatus = null;
    this.candidateDurations.clear();
  }

  private remember(status: ComparisonPlaybackSnapshot) {
    this.lastStatus = status;
    return status;
  }

  private diagnosticFields(status = this.lastStatus ?? undefined, targetCandidateId?: string): PlaybackDiagnosticFields {
    const activeCandidate = this.candidates.find((candidate) => candidate.blindId === status?.activeCandidateId);
    const targetCandidate = this.candidates.find((candidate) => candidate.blindId === targetCandidateId);
    const end = status ? this.effectiveEnd(status) : this.activeRegion.endSeconds ?? 0;
    const position = status?.currentSeconds ?? 0;
    return {
      provider: this.providerKind,
      revisionId: activeCandidate?.revisionId,
      revisionNumber: activeCandidate?.revisionNumber,
      blindId: activeCandidate?.blindId,
      targetRevisionId: targetCandidate?.revisionId,
      targetRevisionNumber: targetCandidate?.revisionNumber,
      targetBlindId: targetCandidate?.blindId,
      candidateCount: this.candidates.length,
      loopEnabled: this.loop,
      playRequested: this.playRequested,
      providerPlaying: status?.playing ?? false,
      fullSong: this.activeRegion.builtIn,
      atRegionEnd: end > this.activeRegion.startSeconds && position >= end - 0.04,
      positionMs: milliseconds(position),
      regionEndMs: milliseconds(end),
      providerPaused: status?.providerPaused,
      providerEnded: status?.providerEnded,
      readyState: status?.readyState,
      networkState: status?.networkState,
    };
  }

  private startDiagnostic(action: PlaybackDiagnosticAction, targetCandidateId?: string) {
    return startPlaybackDiagnostic(action, this.diagnosticFields(undefined, targetCandidateId));
  }

  private logDiagnostic(action: PlaybackDiagnosticAction, outcome: Exclude<PlaybackDiagnosticOutcome, "started">, status?: ComparisonPlaybackSnapshot) {
    const operationId = `${Date.now()}-${++playbackDiagnosticSequence}`;
    writePlaybackDiagnostic(action, outcome, operationId, this.diagnosticFields(status));
  }

  private normalizePlaybackState(status: ComparisonPlaybackSnapshot): ComparisonPlaybackSnapshot {
    if (!this.playRequested || status.playing) return status;
    const end = this.effectiveEnd(status);
    const endTolerance = Math.min(0.04, (end - this.activeRegion.startSeconds) / 4);
    if (status.currentSeconds >= end - endTolerance) {
      this.playRequested = false;
      return status;
    }
    return { ...status, playing: true };
  }
}

const clampPosition = (seconds: number, duration: number) =>
  Math.max(0, Math.min(seconds, Number.isFinite(duration) ? duration : seconds));

const milliseconds = (seconds: number) =>
  Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000));

const gainScalar = (gainDb: number | null) =>
  gainDb === null || !Number.isFinite(gainDb) ? 1 : 10 ** (Math.min(0, gainDb) / 20);

const waitForMetadata = (audio: HTMLAudioElement) => new Promise<number>((resolve, reject) => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    resolve(audio.duration);
    return;
  }
  const complete = () => {
    cleanup();
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      resolve(audio.duration);
    } else {
      reject();
    }
  };
  const fail = () => { cleanup(); reject(); };
  const cleanup = () => {
    audio.removeEventListener("loadedmetadata", complete);
    audio.removeEventListener("error", fail);
  };
  audio.addEventListener("loadedmetadata", complete);
  audio.addEventListener("error", fail);
  audio.load();
});

const validateRegionDurations = (
  candidates: readonly FrozenComparisonCandidate[],
  region: ProjectRegion,
  durations: ReadonlyMap<string, number>,
) => {
  const tooShort = candidates.find((candidate) => {
    const duration = durations.get(candidate.blindId);
    return duration === undefined || !Number.isFinite(duration) || duration <= region.startSeconds;
  });
  if (tooShort) throw new Error(`Candidate ${tooShort.blindId} ends at or before the start of region "${region.name}".`);
};
