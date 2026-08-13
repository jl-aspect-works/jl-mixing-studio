import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultWorkspaceConfiguration,
  healthyWorkspace,
  mockedInvoke,
  resetAppTestState,
  version,
} from "./App.testSupport";
import App from "./App";

afterEach(cleanup);

describe("JL Mixing Studio — workspace sidebar", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("opens the validated workspace from the persistent sidebar", async () => {
    const workspace = healthyWorkspace();
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(workspace);
      if (command === "get_workspace_configuration") return Promise.resolve(defaultWorkspaceConfiguration);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "open_folder") return Promise.resolve({ path: workspace.workspacePath });
      return Promise.reject(new Error("Unexpected command"));
    });

    render(<App />);
    await screen.findByText("JL Mix Studio");

    const openWorkspace = screen.getByRole("button", { name: "Open workspace folder" });
    expect(openWorkspace).toBeEnabled();
    fireEvent.click(openWorkspace);

    await waitFor(() =>
      expect(mockedInvoke).toHaveBeenCalledWith("open_folder", {
        request: { location: "workspace", clientId: null, projectId: null },
      }),
    );
    expect(await screen.findByText("Folder opened.")).toBeInTheDocument();
  });
});
