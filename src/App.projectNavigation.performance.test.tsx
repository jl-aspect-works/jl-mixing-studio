import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { healthyWorkspace, mockedInvoke, resetAppTestState, version } from "./App.testSupport";
import App from "./App";

const intakeResult = {
  ok: true,
  code: "validated",
  message: "Validation is up to date.",
  report: {
    clientId: "acme",
    projectId: "blue-sky",
    source: "/workspace/Clients/acme/Projects/blue-sky/01_Client_Files/Original_Delivery",
    filesDiscovered: 0,
    expectedSampleRate: 48000,
    expectedBitDepth: 24,
    blockingErrors: 0,
    warnings: 0,
    enhancedInspectionAvailable: true,
    criticalErrors: [],
    duplicateFilenames: [],
    formatMismatches: [],
    unsupportedFiles: [],
    unavailableChecks: [],
    inventory: [],
    recommendations: [],
  },
  files: [],
  audioPrepAvailable: true,
  audioPrepFiles: [],
};

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
      if (command === "get_intake_report" || command === "refresh_client_files_validation") {
        return Promise.resolve(intakeResult);
      }
      if (command === "list_project_files") {
        return Promise.resolve({
          clientId: "acme",
          projectId: "blue-sky",
          relativePath: "01_Client_Files/References",
          entries: [],
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    const projectLink = await screen.findByRole("link", { name: "Blue Sky" });
    fireEvent.click(projectLink);

    await waitFor(() => expect(workspaceCalls).toBeGreaterThanOrEqual(2));
    const callsAfterOpen = workspaceCalls;

    let projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
    fireEvent.click(within(projectNavigation).getByRole("button", { name: "References" }));
    await waitFor(() => {
      projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).getByText("References")).toHaveAttribute("aria-current", "page");
    });
    await Promise.resolve();

    expect(workspaceCalls).toBe(callsAfterOpen);
  });

  it("does not restart project validation merely because Client Files or Audio Prep is selected", async () => {
    let validationCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "get_workspace_configuration") {
        return Promise.resolve({ configured: false, workspacePath: "/tmp/Mixes" });
      }
      if (command === "summarize_workspace_storage") {
        return Promise.resolve({ fileCount: 0, sizeBytes: 0, failedPaths: [] });
      }
      if (command === "get_intake_report") return Promise.resolve(intakeResult);
      if (command === "refresh_client_files_validation") {
        validationCalls += 1;
        return Promise.resolve(intakeResult);
      }
      if (command === "list_project_files") {
        return Promise.resolve({
          clientId: "acme",
          projectId: "blue-sky",
          relativePath: "02_Audio_Preparation/Working_Audio",
          entries: [],
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    const projectLink = await screen.findByRole("link", { name: "Blue Sky" });
    fireEvent.click(projectLink);

    await waitFor(() => expect(validationCalls).toBe(1));
    const callsAfterProjectOpen = validationCalls;

    let projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
    fireEvent.click(within(projectNavigation).getByRole("button", { name: "Client Files" }));
    await waitFor(() => {
      projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).getByText("Client Files")).toHaveAttribute("aria-current", "page");
    });

    projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
    fireEvent.click(within(projectNavigation).getByRole("button", { name: "Audio Prep" }));
    await waitFor(() => {
      projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).getByText("Audio Prep")).toHaveAttribute("aria-current", "page");
    });
    await Promise.resolve();

    expect(validationCalls).toBe(callsAfterProjectOpen);
  });
});
