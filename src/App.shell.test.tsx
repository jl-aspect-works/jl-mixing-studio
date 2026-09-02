import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockedInvoke, healthyWorkspace, respondWith, resetAppTestState } from "./App.testSupport";
import App from "./App";

afterEach(cleanup);

const waitForDashboardReady = async () => {
  await screen.findByText("JL Mixing Automation 1.3.1 detected");
  await screen.findByRole("button", { name: "New Project" });
};

describe("JL Mixing Studio — shell and routes", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("activates local Studio settings without mutating workspace metadata", async () => {
      const { unmount } = render(<App />);
      await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
      const compact = screen.getByRole("checkbox", { name: /compact layout/i });
      fireEvent.click(compact);
      expect(compact).toBeChecked();
      expect(document.querySelector(".app-shell")).toHaveClass("compact-layout");
      expect(localStorage.getItem("jl-mixing-studio.preferences")).toContain('"compactLayout":true');
      expect(mockedInvoke.mock.calls.some(([command]) => /setting|update|write/.test(String(command)))).toBe(false);
      unmount();
      render(<App />);
      await waitForDashboardReady();
      expect(document.querySelector(".app-shell")).toHaveClass("compact-layout");
    });

  it("shows a healthy workspace without duplicating client and project details", async () => {
      render(<App />);
      await waitForDashboardReady();
      expect(screen.getByLabelText("JL Mixing Studio")).toBeInTheDocument();
      expect(screen.getByText("~/Music/Mixes")).toBeInTheDocument();
      expect(screen.queryByText("Blue Sky")).not.toBeInTheDocument();
      expect(screen.queryByText("Revision 2")).not.toBeInTheDocument();
      expect(screen.queryByText("Revision 1")).not.toBeInTheDocument();
      expect(screen.getByText("JL Mixing Automation 1.3.1 detected")).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("discover_default_workspace");
      expect(mockedInvoke).toHaveBeenCalledWith("get_jl_mixing_version");
    });

  it("renders the persistent shell, locked global navigation, and authoritative summaries", async () => {
      render(<App />);
      await waitForDashboardReady();
      expect(screen.getByLabelText("JL Mixing Studio")).toBeInTheDocument();
      expect(screen.getByText("~/Music/Mixes")).toBeInTheDocument();
      const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
      expect(within(primaryNavigation).getAllByRole("button").map((button) => button.textContent)).toEqual(["Dashboard", "Studio", "Clients", "Projects", "Tasks", "Activities", "Settings"]);
      expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
      expect(screen.queryByLabelText("Global search")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Today’s Work" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Quick Actions" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Workspace Summary" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New Project" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: /validate intake/i })).not.toBeInTheDocument();
      expect(within(primaryNavigation).queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
    });

  it("launches guided project creation from the Dashboard", async () => {
      render(<App />);
      await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "New Project" }));
      expect(screen.getByRole("heading", { name: "New project" })).toBeInTheDocument();
      expect(screen.getByLabelText("Client")).toBeEnabled();
      expect(screen.getByLabelText("Client")).toHaveFocus();
    });

  it("shows derived priorities and persisted activity on Dashboard", async () => {
      const snapshot = healthyWorkspace();
      snapshot.tasks = [{ id: "task", priority: "delivery", title: "Create or update delivery", reason: "Approved differs from delivered.", recommendedAction: "Open Delivery.", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", deadline: null }];
      snapshot.activity = [{ id: "event", eventType: "revisionApproved", timestamp: "2026-07-16T18:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", revision: 1, persistedSource: "revision approval.approved_at" }];
      respondWith(snapshot); render(<App />); await waitForDashboardReady();
      expect(await screen.findByText("Create or update delivery")).toBeInTheDocument();
      expect(await screen.findByText("Mix approved · Rev 01")).toBeInTheDocument();
    });

  it("opens a project-scoped task from the active Tasks route", async () => {
      const snapshot = healthyWorkspace();
      snapshot.tasks = [{ id: "task", priority: "review", title: "Review current revision", reason: "Current differs from approved.", recommendedAction: "Open Revisions.", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", deadline: null }];
      respondWith(snapshot); render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
      expect(screen.getByRole("heading", { name: "1 task" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
    });

  it("activates Activities as an incomplete derived event feed", async () => {
      const snapshot = healthyWorkspace();
      snapshot.activity = [{ id: "event", eventType: "clientCreated", timestamp: "2026-07-15T12:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: null, projectName: null, revision: null, persistedSource: "client metadata.created_at" }];
      respondWith(snapshot); render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Activities" }));
      expect(screen.getByRole("heading", { name: "1 event" })).toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "Client created" })).toBeInTheDocument();
    });

  it("shows honest empty derived-route states", async () => {
      const snapshot = healthyWorkspace();
      snapshot.tasks = [];
      snapshot.activity = [];
      respondWith(snapshot); render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
      expect(screen.getByText("Nothing needs your attention")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Activities" }));
      expect(screen.getByText("No recent activity yet")).toBeInTheDocument();
    });

  it("navigates to the functional project directory with a programmatic active state", async () => {
      render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Blue Sky" })).toBeInTheDocument();
    });

  it("keeps guided client creation available from the Clients directory", async () => {
      render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Clients" }));
      expect(screen.getByRole("button", { name: "Clients" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { name: "Clients", level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New client" })).toBeEnabled();
    });

  it("opens Client Details and the shared Project Overview from Clients", async () => {
      render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Clients" }));
      fireEvent.click(screen.getByRole("button", { name: "Acme Records" }));
      expect(screen.getByRole("heading", { name: "Acme Records", level: 1 })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
      const projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).getByText("Overview").closest('[aria-current="page"]')).toBeInTheDocument();
    });

  it("opens the validated project folder from the Overview without exposing path controls", async () => {
      render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Open Project Folder" }));
      await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith("open_folder", { request: { clientId: "acme", projectId: "blue-sky", location: "project" } }));
      expect(screen.queryByRole("textbox", { name: /project.*path|path.*project/i })).not.toBeInTheDocument();
    });

  it("uses the locked project navigation and dedicated shell views", async () => {
      render(<App />); await waitForDashboardReady();
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("link", { name: "Blue Sky" }));
      let projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).getByText("Overview").closest('[aria-current="page"]')).toBeInTheDocument();
      for (const name of ["Client Files", "Audio Prep", "References", "Revisions", "Delivery", "Files"]) {
        fireEvent.click(within(projectNavigation).getByRole("button", { name }));
        await waitFor(() => {
          projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
          expect(within(projectNavigation).getByText(name).closest('[aria-current="page"]')).toBeInTheDocument();
        });
      }
    });
});