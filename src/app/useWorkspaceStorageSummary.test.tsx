import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { notifyWorkspaceRefreshed } from "./workspaceRefreshEvents";
import { useWorkspaceStorageSummary } from "./useWorkspaceStorageSummary";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockedInvoke = vi.mocked(invoke);

function Harness() {
  const { state } = useWorkspaceStorageSummary({
    workspacePath: "/Volumes/Shared/Mixes",
    available: true,
  });

  return <span>{state.value ? `${state.value.fileCount}:${state.value.sizeBytes}` : state.status}</span>;
}

describe("useWorkspaceStorageSummary", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  afterEach(cleanup);

  it("uses one workspace scan and refreshes that shared result on workspace invalidation", async () => {
    let calls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command !== "summarize_workspace_storage") {
        return Promise.reject(new Error(`Unexpected command: ${command}`));
      }
      calls += 1;
      return Promise.resolve({
        fileCount: calls,
        sizeBytes: calls * 1024,
        failedPaths: [],
      });
    });

    render(<Harness />);
    expect(await screen.findByText("1:1024")).toBeInTheDocument();
    expect(calls).toBe(1);

    notifyWorkspaceRefreshed();

    expect(await screen.findByText("2:2048")).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it("keeps the last summary visible while a refresh is pending", async () => {
    let resolveRefresh: ((value: { fileCount: number; sizeBytes: number; failedPaths: string[] }) => void) | null = null;
    let calls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command !== "summarize_workspace_storage") {
        return Promise.reject(new Error(`Unexpected command: ${command}`));
      }
      calls += 1;
      if (calls === 1) return Promise.resolve({ fileCount: 4, sizeBytes: 4096, failedPaths: [] });
      return new Promise((resolve) => { resolveRefresh = resolve; });
    });

    render(<Harness />);
    expect(await screen.findByText("4:4096")).toBeInTheDocument();

    notifyWorkspaceRefreshed();
    await waitFor(() => expect(calls).toBe(2));
    expect(screen.getByText("4:4096")).toBeInTheDocument();

    resolveRefresh?.({ fileCount: 5, sizeBytes: 5120, failedPaths: [] });
    expect(await screen.findByText("5:5120")).toBeInTheDocument();
  });
});
