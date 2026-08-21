import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { WorkspaceConfiguration } from "../settings/models";
import { useWorkspaceResources } from "./useWorkspaceResources";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockedInvoke = vi.mocked(invoke);

const configuration: WorkspaceConfiguration = {
  workspacePath: "/Volumes/Shared/Mixes",
  configured: true,
};

const version: VersionCheck = {
  available: true,
  supported: true,
  studioCreationSupported: true,
  clientCreationSupported: true,
  projectCreationSupported: true,
  intakeValidationSupported: true,
  revisionCreationSupported: true,
  revisionApprovalSupported: true,
  deliveryCreationSupported: true,
  version: "1.3.1",
  message: "JL Mixing Automation 1.3.1 detected",
};

const snapshot = (studioName: string): WorkspaceSnapshot => ({
  workspacePath: "/Volumes/Shared/Mixes",
  status: "healthy",
  studio: {
    studioId: "shared-studio",
    studioName,
    rootPath: "/Volumes/Shared/Mixes",
    schemaVersion: "1.1.0",
    createdWith: "jl-mixing 1.3.1",
    createdAt: "2026-08-16T12:00:00Z",
    mixEngineer: "Engineer",
    sampleRate: 48000,
    bitDepth: 24,
    fileFormat: "WAV",
    deliveryMethod: "Digital",
    requestedDeliverables: [],
    changeDirectoryAfterCreate: false,
  },
  counts: { clients: 0, projects: 0, issues: 0 },
  clients: [],
  issues: [],
  tasks: [],
  activity: [],
});

function Harness() {
  const resources = useWorkspaceResources();
  const workspaceLabel = resources.workspace.status === "ready"
    ? resources.workspace.value.studio?.studioName ?? resources.workspace.value.workspacePath
    : resources.workspace.status;

  return <>
    <span>{workspaceLabel}</span>
    <span>{resources.loading ? "refreshing" : "idle"}</span>
    {resources.workspaceRefreshError && <span role="alert">{resources.workspaceRefreshError}</span>}
    <button type="button" onClick={() => void resources.refresh()}>Refresh resources</button>
    <button type="button" onClick={() => void resources.refreshWorkspace()}>Refresh workspace</button>
  </>;
}

describe("useWorkspaceResources", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  afterEach(cleanup);

  it("refreshes only the workspace snapshot when the window regains focus", async () => {
    let workspaceCalls = 0;
    let configurationCalls = 0;
    let versionCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        return Promise.resolve(snapshot(workspaceCalls === 1 ? "Initial Studio" : "After Focus"));
      }
      if (command === "get_workspace_configuration") {
        configurationCalls += 1;
        return Promise.resolve(configuration);
      }
      if (command === "get_jl_mixing_version") {
        versionCalls += 1;
        return Promise.resolve(version);
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<Harness />);
    expect(await screen.findByText("Initial Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("idle")).toBeInTheDocument());

    fireEvent.focus(window);

    expect(await screen.findByText("After Focus")).toBeInTheDocument();
    expect(workspaceCalls).toBe(2);
    expect(configurationCalls).toBe(1);
    expect(versionCalls).toBe(1);
  });

  it("coalesces overlapping workspace refresh requests", async () => {
    let workspaceCalls = 0;
    let resolveRefresh: ((value: WorkspaceSnapshot) => void) | null = null;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        if (workspaceCalls === 1) return Promise.resolve(snapshot("Initial Studio"));
        return new Promise<WorkspaceSnapshot>((resolve) => { resolveRefresh = resolve; });
      }
      if (command === "get_workspace_configuration") return Promise.resolve(configuration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<Harness />);
    expect(await screen.findByText("Initial Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("idle")).toBeInTheDocument());

    fireEvent.focus(window);
    fireEvent.focus(window);
    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));

    await waitFor(() => expect(workspaceCalls).toBe(2));
    expect(workspaceCalls).toBe(2);

    await act(async () => {
      resolveRefresh?.(snapshot("Coalesced Studio"));
    });

    expect(await screen.findByText("Coalesced Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("idle")).toBeInTheDocument());
  });

  it("keeps the last workspace visible while a slow refresh is in progress", async () => {
    let workspaceCalls = 0;
    let resolveRefresh: ((value: WorkspaceSnapshot) => void) | null = null;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        if (workspaceCalls === 1) return Promise.resolve(snapshot("Initial Studio"));
        return new Promise<WorkspaceSnapshot>((resolve) => { resolveRefresh = resolve; });
      }
      if (command === "get_workspace_configuration") return Promise.resolve(configuration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<Harness />);
    expect(await screen.findByText("Initial Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("idle")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Refresh resources" }));

    expect(screen.getByText("Initial Studio")).toBeInTheDocument();
    expect(await screen.findByText("refreshing")).toBeInTheDocument();

    await act(async () => {
      resolveRefresh?.(snapshot("Refreshed Studio"));
    });

    expect(await screen.findByText("Refreshed Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("idle")).toBeInTheDocument());
  });

  it("preserves the last workspace after a transient refresh failure and clears the error on retry", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        if (workspaceCalls === 1) return Promise.resolve(snapshot("Initial Studio"));
        if (workspaceCalls === 2) return Promise.reject(new Error("NAS read timed out"));
        return Promise.resolve(snapshot("Recovered Studio"));
      }
      if (command === "get_workspace_configuration") return Promise.resolve(configuration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<Harness />);
    expect(await screen.findByText("Initial Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("idle")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("NAS read timed out");
    expect(screen.getByText("Initial Studio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));

    expect(await screen.findByText("Recovered Studio")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
