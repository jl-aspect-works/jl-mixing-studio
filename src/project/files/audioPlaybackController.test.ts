import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimAudioPlayback,
  claimExclusiveAudioPlayback,
  releaseAudioPlayback,
  stopActiveAudioPlayback,
  stopAudioPlayback,
} from "./audioPlaybackController";

beforeEach(async () => {
  await stopActiveAudioPlayback();
});

describe("audioPlaybackController", () => {
  it("stops the previous owner before granting playback to another preview", async () => {
    const stopFirst = vi.fn();
    const stopSecond = vi.fn();

    await claimAudioPlayback("first", stopFirst);
    await claimAudioPlayback("second", stopSecond);

    expect(stopFirst).toHaveBeenCalledTimes(1);
    expect(stopSecond).not.toHaveBeenCalled();

    await stopActiveAudioPlayback();
    expect(stopSecond).toHaveBeenCalledTimes(1);
  });

  it("releases ownership without stopping when playback has already ended", async () => {
    const stop = vi.fn();
    await claimAudioPlayback("preview", stop);
    releaseAudioPlayback("preview");

    await stopActiveAudioPlayback();
    expect(stop).not.toHaveBeenCalled();
  });

  it("stops only the matching playback owner", async () => {
    const stop = vi.fn();
    await claimAudioPlayback("preview", stop);

    await stopAudioPlayback("other");
    expect(stop).not.toHaveBeenCalled();

    await stopAudioPlayback("preview");
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("keeps an exclusive comparison owner until it releases playback", async () => {
    const stopComparison = vi.fn();
    const stopPreview = vi.fn();
    expect(await claimExclusiveAudioPlayback("comparison", stopComparison)).toBe(true);

    expect(await claimAudioPlayback("preview", stopPreview)).toBe(false);
    expect(stopComparison).not.toHaveBeenCalled();

    releaseAudioPlayback("comparison");
    expect(await claimAudioPlayback("preview", stopPreview)).toBe(true);
  });
});
