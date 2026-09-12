import { invoke } from "@tauri-apps/api/core";
import { claimExclusiveAudioPlayback, releaseAudioPlayback } from "../project/files/audioPlaybackController";
import { prepareProjectAudioPreview } from "../project/files/audioPreviewService";
import type { FrozenComparisonCandidate, ProjectRegion } from "./models";

export type ComparisonPlaybackSnapshot = {
  activeCandidateId: string;
  playing: boolean;
  currentSeconds: number;
  durationSeconds: number;
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

export class WebComparisonAudioProvider implements ComparisonAudioProvider {
  private readonly channels = new Map<string, HTMLAudioElement>();
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
      audio.volume = this.volume;
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
    this.channels.forEach((channel) => { channel.volume = this.volume; });
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

  async prepare() {
    if (this.disposed) throw new Error("Comparison playback session is closed.");
    await claimExclusiveAudioPlayback(this.ownershipId, () => this.stopProvider());
    try {
      const prepared = await Promise.all(this.candidates.map(async (candidate) => {
        const audio = await prepareProjectAudioPreview({
          clientId: this.clientId,
          projectId: this.projectId,
          relativePath: candidate.relativePath,
        });
        if (!audio) throw playbackError(candidate.blindId, "prepared");
        return { ...candidate, sourceUrl: audio.sourceUrl, provider: audio.provider };
      }));
      if (this.disposed) throw new Error("Comparison playback session is closed.");
      const providerKind = prepared[0]?.provider;
      if (!providerKind || prepared.some((candidate) => candidate.provider !== providerKind)) {
        throw new Error("Comparison candidates could not use one audio provider.");
      }
      this.provider = this.providerFactory?.(providerKind)
        ?? (providerKind === "web" ? new WebComparisonAudioProvider() : new NativeComparisonAudioProvider(this.clientId, this.projectId));
      const durations = await this.provider.prepare(prepared, this.activeRegion.startSeconds);
      this.regions.forEach((region) => validateRegionDurations(this.candidates, region, durations));
      return this.provider.status();
    } catch (error) {
      await this.stopProvider();
      releaseAudioPlayback(this.ownershipId);
      throw error;
    }
  }

  async toggle() {
    const provider = this.requireProvider();
    const status = await provider.status();
    this.playRequested = !status.playing;
    const next = status.playing ? await provider.pause() : await provider.play();
    return this.normalizePlaybackState(next);
  }

  pause() {
    this.playRequested = false;
    return this.requireProvider().pause();
  }

  async switchCandidate(candidateId: string) {
    return this.normalizePlaybackState(await this.requireProvider().switchCandidate(candidateId));
  }

  async seek(seconds: number) {
    return this.requireProvider().seek(this.boundPosition(seconds));
  }

  async setRegion(region: ProjectRegion) {
    this.activeRegion = region;
    this.loop = true;
    const provider = this.requireProvider();
    const next = await provider.seek(region.startSeconds);
    if (this.playRequested) return this.normalizePlaybackState(await provider.play());
    return this.normalizePlaybackState(next);
  }

  setLoop(loop: boolean) { this.loop = loop; }

  setVolume(volume: number) { return this.requireProvider().setVolume(volume); }

  async refresh() {
    const provider = this.requireProvider();
    const status = await provider.status();
    const end = this.activeRegion.endSeconds ?? status.durationSeconds;
    if (this.playRequested && this.loop && end > this.activeRegion.startSeconds && status.currentSeconds >= end - 0.04) {
      await provider.seek(this.activeRegion.startSeconds);
      return this.normalizePlaybackState(await provider.play());
    }
    if (!status.playing && status.currentSeconds >= end - 0.04) this.playRequested = false;
    return this.normalizePlaybackState(status);
  }

  async retry() {
    const provider = this.requireProvider();
    await provider.seek(this.boundPosition((await provider.status()).currentSeconds));
    this.playRequested = true;
    return this.normalizePlaybackState(await provider.play());
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
    const end = this.activeRegion.endSeconds;
    return Math.max(this.activeRegion.startSeconds, end === null ? seconds : Math.min(seconds, end));
  }

  private async stopProvider() {
    const provider = this.provider;
    this.provider = null;
    if (provider) await provider.dispose();
  }

  private normalizePlaybackState(status: ComparisonPlaybackSnapshot): ComparisonPlaybackSnapshot {
    if (!this.playRequested || status.playing) return status;
    const end = this.activeRegion.endSeconds ?? status.durationSeconds;
    if (end > this.activeRegion.startSeconds && status.currentSeconds >= end - 0.04) {
      this.playRequested = false;
      return status;
    }
    return { ...status, playing: true };
  }
}

const clampPosition = (seconds: number, duration: number) =>
  Math.max(0, Math.min(seconds, Number.isFinite(duration) ? duration : seconds));

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
  if (region.endSeconds === null) return;
  const tooShort = candidates.find((candidate) => (durations.get(candidate.blindId) ?? 0) + 0.01 < region.endSeconds!);
  if (tooShort) throw playbackError(tooShort.blindId, "prepared for the selected region");
};
