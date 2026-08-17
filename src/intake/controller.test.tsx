import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { notifyWorkspaceRefreshed } from "../app/workspaceRefreshEvents";
import type { IntakeOperationResult, IntakeReport } from "../types";
import { useIntakeWorkflow } from "./controller";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

const report: IntakeReport = {
  clientId: "acme",
  projectId: "blue-sky",
  source: "/workspace/Clients/acme/Projects/blue-sky/01_Client_Files/Original_Delivery",
  filesDiscovered: 1,
  blockingErrors: 0,
  warnings: 0,
  expectedSampleRate: 48000,
  expectedBitDepth: 24,
  enhancedInspectionAvailable: true,
  criticalErrors: [],
  duplicateFilenames: [],
  formatMismatches: [],
  unsupportedFiles: [],
  unavailableChecks: [],
  inventory: [{ file: "mix.wav", sizeBytes: 1200, technicalDetails: "48000 Hz, 24-bit, 2 ch" }],
  recommendations: [],
};

const legacyResult: IntakeOperationResult = {
  ok: true,
  code: "validated",
  message: "Legacy intake report loaded.",
  report,
};

const structuredResult = {
  ok: true,
  code: "validated",
  message: "Client Files validation is current.",
  report,
  files: [{ relativePath: "mix.wav", isAudio: true, status: "valid" }],
} as IntakeOperationResult & { files: Array<{ relativePath: string; isAudio: boolean; status: string }> };

describe("useIntakeWorkflow background refresh", () => {
  beforeEach(() => mockedInvoke.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("loads structured validation automatically and keeps it visible during background refresh", async () => {
    let refreshCalls = 0;
    let resolveBackground: ((value: IntakeOperationResult) => void) | null = null;

    mockedInvoke.mockImplementation((command) => {
      if (command === "get_intake_report") return Promise.resolve(legacyResult);
      if (command === "refresh_client_files_validation") {
        refreshCalls += 1;
        if (refreshCalls === 1) return Promise.resolve(structuredResult);
        return new Promise<IntakeOperationResult>((resolve) => { resolveBackground = resolve; });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    const { result } = renderHook(() => useIntakeWorkflow({
      validationAvailable: true,
      clientId: "acme",
      projectId: "blue-sky",
    }));

    await waitFor(() => {
      expect(refreshCalls).toBe(1);
      expect(result.current.reportState.status).toBe("ready");
      if (result.current.reportState.status === "ready") {
        expect(result.current.reportState.value).toBe(structuredResult);
      }
    });
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "get_intake_report")).toHaveLength(0);

    act(() => notifyWorkspaceRefreshed());

    await waitFor(() => expect(refreshCalls).toBe(2));
    expect(result.current.reportState.status).toBe("ready");
    if (result.current.reportState.status === "ready") {
      expect(result.current.reportState.value).toBe(structuredResult);
      expect("files" in result.current.reportState.value).toBe(true);
    }
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "get_intake_report")).toHaveLength(0);

    act(() => resolveBackground?.(structuredResult));
    await waitFor(() => expect(result.current.state.status).toBe("closed"));
  });
});
