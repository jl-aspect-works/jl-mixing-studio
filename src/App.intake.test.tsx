import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultWorkspaceConfiguration,
  healthyWorkspace,
  intakePreview,
  mockedInvoke,
  resetAppTestState,
  version,
} from "./App.testSupport";
import App from "./App";
import type { IntakeOperationResult } from "./types";

const emptyClientFilesListing = {
  relativePath: "01_Client_Files/Original_Delivery",
  area: "clientOriginalDelivery",
  permissions: {
    canOpen: true,
    canReveal: true,
    canRename: false,
    canDelete: false,
    canCopy: false,
  },
  entries: [],
};

const validatedIntakeReport = () => ({ ...intakePreview, code: "validated" } satisfies IntakeOperationResult);

const openClientFiles = async () => {
  await screen.findByText("JL Mixing Automation 1.3.1 detected");
  fireEvent.click(screen.getByRole("button", { name: "Projects" }));
  const projectLink = await screen.findByRole("link", { name: "Blue Sky" });
  fireEvent.click(projectLink);
  const projectNavigation = await screen.findByRole("navigation", { name: "Project navigation" });
  const clientFilesButton = within(projectNavigation).getByRole("button", { name: "Client Files" });
  await waitFor(() => expect(clientFilesButton).toBeEnabled());
  fireEvent.click(clientFilesButton);
  await screen.findByRole("heading", { name: "Original Delivery", level: 2 });
};

afterEach(cleanup);

describe("JL Mixing Studio — Client Files workflow", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("automatically refreshes cached validation when Client Files opens", async () => {
    const refreshed = {
      ...intakePreview,
      code: "validated",
      message: "Intake validation completed and the report was verified.",
    } satisfies IntakeOperationResult;

    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_workspace_configuration") return Promise.resolve(defaultWorkspaceConfiguration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "refresh_client_files_validation") return Promise.resolve(refreshed);
      if (command === "get_intake_report") return Promise.resolve(validatedIntakeReport());
      if (command === "list_project_files") return Promise.resolve(emptyClientFilesListing);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await openClientFiles();

    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith("refresh_client_files_validation", {
      request: { clientId: "acme", projectId: "blue-sky" },
    }));
    const summary = await screen.findByLabelText("Original Delivery file stats");
    expect(within(summary).getByText("Files").previousElementSibling).toHaveTextContent("2");
    expect(within(summary).getByText("Status").previousElementSibling).toHaveTextContent("Needs attention");
    expect(screen.getByRole("button", { name: "Recheck" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Go to Audio Prep" })).toBeEnabled();
  });

  it("falls back to the durable intake report when structured cached validation is unavailable", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_workspace_configuration") return Promise.resolve(defaultWorkspaceConfiguration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "refresh_client_files_validation") {
        return Promise.resolve({
          ok: false,
          code: "rejected",
          message: "Structured cached intake validation is not supported.",
          report: null,
        } satisfies IntakeOperationResult);
      }
      if (command === "get_intake_report") return Promise.resolve(validatedIntakeReport());
      if (command === "list_project_files") return Promise.resolve(emptyClientFilesListing);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await openClientFiles();

    expect(await screen.findByLabelText("Original Delivery file stats")).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("get_intake_report", {
      request: { clientId: "acme", projectId: "blue-sky" },
    });
    expect(screen.getByText(/client’s supplied source material is preserved here unchanged/i)).toBeInTheDocument();
    expect(screen.getByText("View intake report details")).toBeInTheDocument();
  });

  it("rechecks Client Files directly without the legacy preview-confirmation flow", async () => {
    let refreshCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_workspace_configuration") return Promise.resolve(defaultWorkspaceConfiguration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "refresh_client_files_validation") {
        refreshCalls += 1;
        return Promise.resolve(validatedIntakeReport());
      }
      if (command === "get_intake_report") return Promise.resolve(validatedIntakeReport());
      if (command === "list_project_files") return Promise.resolve(emptyClientFilesListing);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await openClientFiles();
    await screen.findByLabelText("Original Delivery file stats");
    await waitFor(() => expect(refreshCalls).toBeGreaterThan(0));
    const callsBeforeRecheck = refreshCalls;

    fireEvent.click(screen.getByRole("button", { name: "Recheck" }));
    await waitFor(() => expect(refreshCalls).toBeGreaterThan(callsBeforeRecheck));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedInvoke).not.toHaveBeenCalledWith("preflight_intake_validation", expect.anything());
  });

  it("keeps the current report readable while partial workspaces disable validation", async () => {
    const partial = healthyWorkspace();
    partial.status = "partial";
    partial.counts.issues = 1;
    partial.issues = [{
      scope: "project",
      code: "invalidJson",
      displayName: "Other Project",
      relativePath: "other.json",
      message: "Invalid JSON",
      recovery: "Repair it.",
    }];

    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(partial);
      if (command === "get_workspace_configuration") return Promise.resolve(defaultWorkspaceConfiguration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "get_intake_report") return Promise.resolve(validatedIntakeReport());
      if (command === "list_project_files") return Promise.resolve(emptyClientFilesListing);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await openClientFiles();

    expect(await screen.findByLabelText("Original Delivery file stats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck" })).toBeDisabled();
    expect(mockedInvoke).not.toHaveBeenCalledWith("refresh_client_files_validation", expect.anything());
  });
});
