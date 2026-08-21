import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { healthyWorkspace, mockedInvoke, resetAppTestState, version } from "./App.testSupport";

afterEach(cleanup);

describe("project navigation performance", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("does not rediscover the whole workspace when switching project tabs", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        return Promise.resolve(healthyWorkspace());
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "get_workspace_configuration") {
        return Promise.resolve({ configured: false, workspacePath: "/tmp/Mixes" });
      }
      if (command === "summarize_workspace_storage") {
        return Promise.resolve({ fileCount: 0, sizeBytes: 0, failedPaths: [] });
      }
      if (command === "list_project_references") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    await screen.findByRole("link", { name: "Blue Sky" });
    fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));

    await waitFor(() => expect(workspaceCalls).toBeGreaterThanOrEqual(2));
    const callsAfterOpen = workspaceCalls;

    fireEvent.click(screen.getByRole("button", { name: "References" }));
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Project navigation" })).toHaveTextContent("References"));
    await Promise.resolve();

    expect(workspaceCalls).toBe(callsAfterOpen);
  });
});
