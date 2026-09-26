import { afterEach, expect, it, vi } from "vitest";
import { completeComparisonSession } from "./comparisonService";

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue({
  session_id: "session-1",
  completed_at: "2026-09-26T00:00:00Z",
  candidates: [],
  regions: [],
  loudness_match: true,
  region_loudness_match: true,
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
afterEach(() => invoke.mockClear());

it("sends region loudness measurements using the Rust completion request wire format", async () => {
  await completeComparisonSession({
    clientId: "client", projectId: "project", loudnessMatch: true, regionLoudnessMatch: true,
    candidates: [{ revisionId: "revision-1", revisionNumber: 1, blindId: "A",
      integratedLufs: null, appliedGainDb: null,
      regionLoudness: { intro: { integratedLufs: -18, appliedGainDb: -3 } },
    }],
    regions: [{ region: { regionId: "intro", name: "Intro", startSeconds: 1, endSeconds: 10 },
      rankRows: [["revision-1"]], notes: {},
    }],
  });

  expect(invoke).toHaveBeenCalledWith("complete_comparison_session", { request: expect.objectContaining({
    regionLoudnessMatch: true,
    candidates: [expect.objectContaining({
      regionLoudness: { intro: { integrated_lufs: -18, applied_gain_db: -3 } },
    })],
  }) });
});
