import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimAudioPlayback, stopActiveAudioPlayback } from "../project/files/audioPlaybackController";
import { invoke } from "@tauri-apps/api/core";
import {
  ComparisonPlaybackSession,
  WebComparisonAudioProvider,
  type ComparisonAudioProvider,
  type ComparisonPlaybackSnapshot,
  type PreparedCandidate,
} from "./comparisonPlaybackService";
import type { FrozenComparisonCandidate, ProjectRegion } from "./models";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), convertFileSrc: (path: string) => path }));

const candidates = (count: number): FrozenComparisonCandidate[] => Array.from({ length: count }, (_, index) => ({
  revisionId: `revision-${index + 1}`,
  revisionNumber: index + 1,
  blindId: String.fromCharCode(65 + index),
  relativePath: `04_Revisions/Revision_${String(index + 1).padStart(2, "0")}/mix.wav`,
  integratedLufs: null,
  appliedGainDb: null,
}));

const intro: ProjectRegion = { regionId: "intro", name: "Intro", startSeconds: 10, endSeconds: 25, builtIn: false };
const verse: ProjectRegion = { regionId: "verse", name: "Verse", startSeconds: 40, endSeconds: 55, builtIn: false };
const fullSong: ProjectRegion = { regionId: "full-song", name: "Full Song", startSeconds: 0, endSeconds: null, builtIn: true };

const snapshot = (values: Partial<ComparisonPlaybackSnapshot> = {}): ComparisonPlaybackSnapshot => ({
  activeCandidateId: "A",
  playing: false,
  currentSeconds: 10,
  durationSeconds: 120,
  ...values,
});

const fakeProvider = (durations = new Map<string, number>()) => {
  let current = snapshot();
  const durationFor = (candidateId: string) => durations.get(candidateId) ?? 120;
  const provider: ComparisonAudioProvider = {
    prepare: vi.fn(async (values: readonly PreparedCandidate[], start: number) => {
      current = snapshot({ activeCandidateId: values[0].blindId, currentSeconds: start, durationSeconds: durationFor(values[0].blindId) });
      return new Map(values.map((candidate) => [candidate.blindId, durationFor(candidate.blindId)]));
    }),
    play: vi.fn(async () => (current = { ...current, playing: true })),
    pause: vi.fn(async () => (current = { ...current, playing: false })),
    seek: vi.fn(async (seconds: number) => (current = { ...current, currentSeconds: seconds })),
    switchCandidate: vi.fn(async (candidateId: string) => (current = { ...current, activeCandidateId: candidateId, durationSeconds: durationFor(candidateId) })),
    setVolume: vi.fn(async () => current),
    setMatchGains: vi.fn(async () => current),
    status: vi.fn(async () => current),
    dispose: vi.fn(async () => undefined),
  };
  return { provider, setStatus: (next: ComparisonPlaybackSnapshot) => { current = next; } };
};

beforeEach(() => {
  vi.mocked(invoke).mockReset().mockImplementation(async (command, args) => {
    if (command === "log_comparison_playback") return undefined;
    const request = args as { request: { candidates: { relativePath: string }[] } };
    return request.request.candidates.map(({ relativePath }) => ({ supported: false, relativePath, filePath: null }));
  });
});

afterEach(async () => {
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  await stopActiveAudioPlayback();
});

describe("comparison playback session", () => {
  it("prepares five candidates, claims exclusive playback, and releases it on dispose", async () => {
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", candidates(5), [intro], intro, () => fake.provider);
    await session.prepare();

    expect(fake.provider.prepare).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ blindId: "A" }),
      expect.objectContaining({ blindId: "E" }),
    ]), 10);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("prepare_comparison_sources", expect.objectContaining({ request: expect.objectContaining({ candidates: expect.arrayContaining([expect.objectContaining({ blindId: "E" })]) }) }));
    expect(await claimAudioPlayback("ordinary-preview", vi.fn())).toBe(false);

    await session.dispose();
    expect(await claimAudioPlayback("ordinary-preview", vi.fn())).toBe(true);
  });

  it("joins overlapping preparation requests and skips I/O when disposed during ownership acquisition", async () => {
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", candidates(4), [intro], intro, () => fake.provider);
    await Promise.all([session.prepare(), session.prepare()]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(fake.provider.prepare).toHaveBeenCalledTimes(1);
    await session.dispose();
    vi.mocked(invoke).mockClear();
    const abandoned = new ComparisonPlaybackSession("client", "project", candidates(4), [intro], intro, () => fake.provider);
    const pending = abandoned.prepare();
    await abandoned.dispose();
    await expect(pending).rejects.toThrow("closed");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("runs a custom-region-only session and resets Loop On when regions change", async () => {
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", candidates(3), [intro, verse], intro, () => fake.provider);
    await session.prepare();
    session.setLoop(false);

    await session.setRegion(verse);
    expect(fake.provider.seek).toHaveBeenLastCalledWith(40);

    fake.setStatus(snapshot({ playing: false, currentSeconds: 55 }));
    await session.retry();
    fake.setStatus(snapshot({ playing: false, currentSeconds: 55 }));
    await session.refresh();
    expect(fake.provider.seek).toHaveBeenLastCalledWith(40);
    expect(fake.provider.play).toHaveBeenCalled();
  });

  it("keeps region gain fixed through seek and candidate changes, updating it only at the next region", async () => {
    const matched = candidates(2).map((candidate, index) => ({ ...candidate, regionLoudness: {
      intro: { integratedLufs: -16 + index, appliedGainDb: index ? -1 : 0 },
      verse: { integratedLufs: -12 + index, appliedGainDb: index ? 0 : -1 },
    } }));
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", matched, [intro, verse], intro, () => fake.provider);
    await session.prepare();
    expect(fake.provider.prepare).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ blindId: "A", appliedGainDb: 0 }),
      expect.objectContaining({ blindId: "B", appliedGainDb: -1 }),
    ]), 10);
    await session.seek(14);
    await session.switchCandidate("B");
    expect(fake.provider.setMatchGains).not.toHaveBeenCalled();
    await session.setRegion(verse);
    expect(fake.provider.setMatchGains).toHaveBeenCalledExactlyOnceWith({ A: -1, B: 0 });
    await session.seek(43);
    expect(fake.provider.setMatchGains).toHaveBeenCalledTimes(1);
  });

  it("loops from the active region end even when the provider reports its channel ended", async () => {
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [intro], intro, () => fake.provider);
    await session.prepare();
    await session.toggle();
    fake.setStatus(snapshot({ playing: false, currentSeconds: 25 }));

    const result = await session.refresh();
    expect(fake.provider.seek).toHaveBeenLastCalledWith(10);
    expect(result.playing).toBe(true);
  });

  it("logs revision-aware switch and loop-boundary diagnostics without polling events", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [fullSong], fullSong, () => fake.provider);
    await session.prepare();
    await session.toggle();
    fake.setStatus(snapshot({ playing: false, currentSeconds: 120, providerPaused: true, providerEnded: true, readyState: 4, networkState: 1 }));
    await session.refresh();
    await session.switchCandidate("B");

    const events = vi.mocked(invoke).mock.calls
      .filter(([command]) => command === "log_comparison_playback")
      .map(([, args]) => (args as { request: Record<string, unknown> }).request);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "loop_restart", outcome: "started", revisionId: "revision-1", revisionNumber: 1, blindId: "A", fullSong: true, atRegionEnd: true, providerEnded: true }),
      expect.objectContaining({ action: "loop_restart", outcome: "success", revisionId: "revision-1", revisionNumber: 1, blindId: "A" }),
      expect.objectContaining({ action: "candidate_switch", outcome: "started", targetRevisionId: "revision-2", targetRevisionNumber: 2, targetBlindId: "B" }),
      expect.objectContaining({ action: "candidate_switch", outcome: "success", revisionId: "revision-2", revisionNumber: 2, blindId: "B" }),
    ]));
    expect(events.filter((event) => event.action === "status")).toHaveLength(0);
  });

  it("keeps refresh polling active after playback is requested while provider position advances", async () => {
    const fake = fakeProvider();
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [intro], intro, () => fake.provider);
    await session.prepare();
    await session.toggle();

    fake.setStatus(snapshot({ playing: false, currentSeconds: 14.2 }));
    const result = await session.refresh();

    expect(result.currentSeconds).toBe(14.2);
    expect(result.playing).toBe(true);
  });

  it("prepares a shorter candidate for a selected final region and loops at its own end", async () => {
    const fake = fakeProvider(new Map([["B", 50]]));
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [fullSong, verse], fullSong, () => fake.provider);
    await session.prepare();
    await session.setRegion(verse);
    await session.switchCandidate("B");
    await session.toggle();
    fake.setStatus(snapshot({ activeCandidateId: "B", durationSeconds: 50, currentSeconds: 50, playing: false }));

    const next = await session.refresh();
    expect(fake.provider.seek).toHaveBeenLastCalledWith(40);
    expect(next.playing).toBe(true);
    expect(next.currentSeconds).toBe(40);
  });

  it("restarts a shorter candidate at the region start when switching beyond its end", async () => {
    const fake = fakeProvider(new Map([["B", 50]]));
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [verse], verse, () => fake.provider);
    await session.prepare();
    await session.toggle();
    fake.setStatus(snapshot({ activeCandidateId: "A", currentSeconds: 54, playing: true }));

    const next = await session.switchCandidate("B");
    expect(fake.provider.pause).toHaveBeenCalled();
    expect(fake.provider.seek).toHaveBeenLastCalledWith(40);
    expect(next).toMatchObject({ activeCandidateId: "B", currentSeconds: 40, durationSeconds: 50, playing: true });
  });

  it("stops at the shorter end with Loop Off and restarts on Play", async () => {
    const fake = fakeProvider(new Map([["B", 50]]));
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [verse], verse, () => fake.provider);
    await session.prepare();
    await session.switchCandidate("B");
    session.setLoop(false);
    await session.toggle();
    fake.setStatus(snapshot({ activeCandidateId: "B", durationSeconds: 50, currentSeconds: 50, playing: false }));
    expect((await session.refresh()).playing).toBe(false);
    expect(fake.provider.seek).not.toHaveBeenCalled();

    const restarted = await session.toggle();
    expect(fake.provider.seek).toHaveBeenLastCalledWith(40);
    expect(restarted.currentSeconds).toBe(40);
    expect(restarted.playing).toBe(true);
  });

  it("rejects a candidate whose audio does not extend past any selected region start", async () => {
    const fake = fakeProvider(new Map([["B", 40]]));
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [intro, verse], intro, () => fake.provider);

    await expect(session.prepare()).rejects.toThrow('Candidate B ends at or before the start of region "Verse".');
    expect(fake.provider.dispose).toHaveBeenCalled();
  });

  it("does not immediately loop a valid very short tail region", async () => {
    const fake = fakeProvider(new Map([["B", 40.02]]));
    const session = new ComparisonPlaybackSession("client", "project", candidates(2), [verse], verse, () => fake.provider);
    await session.prepare();
    await session.switchCandidate("B");
    await session.toggle();
    fake.setStatus(snapshot({ activeCandidateId: "B", durationSeconds: 40.02, currentSeconds: 40, playing: false }));

    expect(await session.refresh()).toMatchObject({ currentSeconds: 40, playing: true });
    expect(fake.provider.seek).not.toHaveBeenCalled();
  });

  it("passes fixed loudness gains to providers independently of user volume", async () => {
    const fake = fakeProvider();
    const matched = candidates(2).map((candidate, index) => ({
      ...candidate,
      integratedLufs: index === 0 ? -18 : -15,
      appliedGainDb: index === 0 ? 0 : -3,
    }));
    const session = new ComparisonPlaybackSession("client", "project", matched, [intro], intro, () => fake.provider);
    await session.prepare();

    expect(fake.provider.prepare).toHaveBeenCalledWith([
      expect.objectContaining({ blindId: "A", appliedGainDb: 0 }),
      expect.objectContaining({ blindId: "B", appliedGainDb: -3 }),
    ], 10);
  });
});

type FakeAudio = HTMLAudioElement & { paused: boolean; ended: boolean; duration: number };

const fakeAudio = (): FakeAudio => {
  const audio = document.createElement("audio") as FakeAudio;
  Object.defineProperties(audio, {
    duration: { value: 180, configurable: true },
    paused: { value: true, writable: true, configurable: true },
    ended: { value: false, writable: true, configurable: true },
  });
  audio.load = vi.fn();
  audio.pause = vi.fn(() => { audio.paused = true; });
  audio.play = vi.fn(async () => { audio.paused = false; });
  return audio;
};

describe("web comparison audio provider", () => {
  it("uses a fresh active position, final-seeks the target, and corrects only material inactive drift", async () => {
    const channels = [fakeAudio(), fakeAudio(), fakeAudio()];
    const provider = new WebComparisonAudioProvider(() => channels.shift()!);
    const prepared = candidates(3).map((candidate) => ({ ...candidate, sourceUrl: `asset://${candidate.blindId}` }));
    await provider.prepare(prepared, 0);
    const [active, near, far] = [
      (provider as unknown as { channels: Map<string, FakeAudio> }).channels.get("A")!,
      (provider as unknown as { channels: Map<string, FakeAudio> }).channels.get("B")!,
      (provider as unknown as { channels: Map<string, FakeAudio> }).channels.get("C")!,
    ];
    active.currentTime = 30.1;
    near.currentTime = 30;
    far.currentTime = 2;
    await provider.play();

    await provider.switchCandidate("B");

    expect(active.pause).toHaveBeenCalled();
    expect(near.currentTime).toBe(30.1);
    expect(near.play).toHaveBeenCalled();
    expect(far.currentTime).toBe(30.1);
  });

  it("layers user volume over per-candidate loudness match gain", async () => {
    const channels = [fakeAudio(), fakeAudio()];
    const provider = new WebComparisonAudioProvider(() => channels.shift()!);
    await provider.prepare([
      { ...candidates(1)[0], sourceUrl: "asset://A", appliedGainDb: 0 },
      { ...candidates(2)[1], sourceUrl: "asset://B", appliedGainDb: -6 },
    ], 0);
    const [a, b] = [
      (provider as unknown as { channels: Map<string, FakeAudio> }).channels.get("A")!,
      (provider as unknown as { channels: Map<string, FakeAudio> }).channels.get("B")!,
    ];

    await provider.setVolume(0.5);

    expect(a.volume).toBeCloseTo(0.5);
    expect(b.volume).toBeCloseTo(0.2506, 3);
  });
});
