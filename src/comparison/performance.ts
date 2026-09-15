import { invoke } from "@tauri-apps/api/core";

type Phase = "setup" | "waveform" | "loudness" | "candidate_source" | "audio_prepare" | "session_prepare" | "candidate_switch" | "results" | "save_session";
let sequence = 0;

// Only phase/timing/count data crosses this boundary; never log revision identities or errors.
export function startComparisonTiming(phase: Phase, count = 0) {
  const started = performance.now();
  const operationId = `${Date.now()}-${++sequence}`;
  let finished = false;
  const report = (outcome: string) => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void invoke("log_comparison_performance", { phase, outcome, operationId, count,
      elapsedMs: Math.round(performance.now() - started) }).catch(() => {
      // Diagnostics are best-effort and must never interrupt audio or screen loading.
    });
  };
  report("started");
  return (outcome: "success" | "error" | "cancelled" = "success") => {
    if (finished) return;
    finished = true;
    report(outcome);
  };
}

export async function measureComparison<T>(phase: Phase, work: () => Promise<T>, count = 0): Promise<T> {
  const finish = startComparisonTiming(phase, count);
  try {
    const result = await work();
    finish();
    return result;
  } catch (error) {
    finish("error");
    throw error;
  }
}
