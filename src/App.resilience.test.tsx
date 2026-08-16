import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { healthyWorkspace, mockedInvoke, resetAppTestState, version } from "./App.testSupport";
import type { WorkspaceSnapshot } from "./types";

const configuredWorkspace = {
  workspacePath: "/Volumes/Shared/Mixes",
  configured: true,
};

const sharedHealthyWorkspace = () => {
  const snapshot = healthyWorkspace();
  snapshot.workspacePath = configuredWorkspace.workspacePath;
  if (snapshot.studio) snapshot.studio.rootPath = configuredWorkspace.workspacePath;
  return snapshot;
};

const unavailableWorkspace = (): WorkspaceSnapshot => ({
  workspacePath: configuredWorkspace.workspacePath,
  status: "unavailable",
  studio: null,
  counts: { clients: 0, projects: 0, issues: 1 },
  clients: [],
  issues: [{
    scope: "workspace",
    code: "notFound",
    displayName: null,
    relativePath: null,
    message: "Workspace unavailable",
    recovery: "Reconnect the mounted workspace.",
  }],
  tasks: [],
  activity: [],
});

afterEach(cleanup);

describe("JL Mixing Studio — shared workspace resilience", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("refreshes authoritative workspace state when entering a project and changing workflow screens", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        const snapshot = sharedHealthyWorkspace();
        if (workspaceCalls >= 3) {
          snapshot.clients[0].projects[0].artist = "Externally Updated Artist";
        }
        return Promise.resolve(snapshot);
      }
      if (command === "get_workspace_configuration") return Promise.resolve(configuredWorkspace);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(await screen.findByRole("button", { name: "Blue Sky" }));

    await waitFor(() => expect(workspaceCalls).toBeGreaterThanOrEqual(2));

    const projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
    fireEvent.click(within(projectNavigation).getByRole("button", { name: "Files" }));

    await waitFor(() => expect(workspaceCalls).toBeGreaterThanOrEqual(3));
    expect(screen.getByText("Externally Updated Artist")).toBeInTheDocument();
  });

  it("preserves the configured workspace and selected project through disconnect and retry", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        if (workspaceCalls === 3) return Promise.resolve(unavailableWorkspace());
        return Promise.resolve(sharedHealthyWorkspace());
      }
      if (command === "get_workspace_configuration") return Promise.resolve(configuredWorkspace);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(await screen.findByRole("button", { name: "Blue Sky" }));
    await waitFor(() => expect(workspaceCalls).toBeGreaterThanOrEqual(2));
    expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();

    fireEvent.focus(window);

    const unavailable = await screen.findByRole("alert");
    expect(unavailable).toHaveTextContent("Workspace unavailable");
    expect(unavailable).toHaveTextContent(configuredWorkspace.workspacePath);
    expect(unavailable).toHaveTextContent(/will not switch to the default workspace/i);

    fireEvent.click(within(unavailable).getByRole("button", { name: "Retry workspace" }));

    await waitFor(() => expect(workspaceCalls).toBeGreaterThanOrEqual(4));
    expect(await screen.findByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/The selected project is no longer available/)).not.toBeInTheDocument();
  });
});
