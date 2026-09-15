import { afterEach, expect, it, vi } from "vitest";
import { measureComparison, startComparisonTiming } from "./performance";

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
afterEach(() => { vi.unstubAllGlobals(); invoke.mockClear(); });

it("logs paired phase timings without exposing failure details", async () => {
  vi.stubGlobal("__TAURI_INTERNALS__", {});
  await expect(measureComparison("waveform", async () => { throw new Error("private/source.wav"); })).rejects.toThrow();
  expect(invoke).toHaveBeenCalledTimes(2);
  const started = invoke.mock.calls[0][1];
  expect(started).toMatchObject({ phase: "waveform", outcome: "started" });
  expect(invoke.mock.calls[1][1]).toMatchObject({ operationId: started.operationId, outcome: "error", elapsedMs: expect.any(Number) });
  expect(JSON.stringify(invoke.mock.calls)).not.toContain("private");
});

it("records cancellation once and tolerates an unavailable logger", async () => {
  vi.stubGlobal("__TAURI_INTERNALS__", {});
  invoke.mockRejectedValue(new Error("logging unavailable"));
  const finish = startComparisonTiming("waveform");
  finish("cancelled");
  finish();
  await Promise.resolve();
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(invoke.mock.calls[1][1]).toMatchObject({ outcome: "cancelled" });
});
