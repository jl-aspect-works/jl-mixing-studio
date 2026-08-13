import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockedInvoke, mockedWriteText, version, healthyWorkspace, respondWith, resetAppTestState } from "./App.testSupport";
import App from "./App";

afterEach(cleanup);

describe("JL Mixing Studio — shell and routes", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("activates local Studio settings without mutating workspace metadata", async () => {
      const { unmount } = render(<App />);
      await screen.findByText("JL Mix Studio");
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
      await screen.findByText("JL Mix Studio");
      expect(document.querySelector(".app-shell")).toHaveClass("compact-layout");
    });

  it("shows a healthy workspace without duplicating client and project details", async () => {
      render(<App />);
      expect(screen.getByText(/reading the default workspace/i)).toBeInTheDocument();
      expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();
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

      await screen.findByText("JL Mix Studio");
      expect(screen.getByLabelText("JL Mixing Studio")).toBeInTheDocument();
      expect(screen.getByText("JL Mix Studio")).toBeInTheDocument();
      expect(screen.getByText("~/Music/Mixes")).toBeInTheDocument();
      const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
      expect(within(primaryNavigation).getAllByRole("button").map((button) => button.textContent)).toEqual([
        "Dashboard",
        "Studio",
        "Clients",
        "Projects",
        "Tasks",
        "Activities",
        "Settings",
      ]);
      expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByLabelText("Global search")).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("Awaiting review").nextElementSibling).toHaveTextContent("1");
      expect(screen.getByText("Ready to deliver").nextElementSibling).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: "New project" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: /validate intake/i })).not.toBeInTheDocument();
      expect(within(primaryNavigation).queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
    });

  it("launches guided project creation from the Dashboard", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");

      fireEvent.click(screen.getByRole("button", { name: "New project" }));

      expect(screen.getByRole("heading", { name: "New project" })).toBeInTheDocument();
      expect(screen.getByLabelText("Client")).toBeEnabled();
      expect(screen.getByLabelText("Client")).toHaveFocus();
    });

  it("shows derived priorities and persisted activity on Dashboard", async () => {
      const snapshot = healthyWorkspace();
      snapshot.tasks = [{ id: "task", priority: "delivery", title: "Create or update delivery", reason: "Approved differs from delivered.", recommendedAction: "Open Delivery.", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", deadline: null }];
      snapshot.activity = [{ id: "event", eventType: "revisionApproved", timestamp: "2026-07-16T18:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", revision: 1, persistedSource: "revision approval.approved_at" }];
      respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
      expect(screen.getByText("Create or update delivery")).toBeInTheDocument();
      expect(screen.getByText("Revision approved · Revision 1")).toBeInTheDocument();
    });

  it("opens a project-scoped task from the active Tasks route", async () => {
      const snapshot = healthyWorkspace();
      snapshot.tasks = [{ id: "task", priority: "review", title: "Review current revision", reason: "Current differs from approved.", recommendedAction: "Open Revisions.", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", deadline: null }];
      respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
      expect(screen.getByRole("heading", { name: "1 task" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
    });

  it("activates Activities as an incomplete derived event feed", async () => {
      const snapshot = healthyWorkspace();
      snapshot.activity = [{ id: "event", eventType: "clientCreated", timestamp: "2026-07-15T12:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: null, projectName: null, revision: null, persistedSource: "client metadata.created_at" }];
      respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Activities" }));
      expect(screen.getByRole("heading", { name: "1 event" })).toBeInTheDocument();
      expect(screen.getByText(/supported project milestones/i)).toBeInTheDocument();
    });

  it("shows honest empty derived-route states", async () => {
      render(<App />); await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
      expect(screen.getByRole("heading", { name: "Nothing needs your attention" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Activities" }));
      expect(screen.getByRole("heading", { name: "No recent activity yet" })).toBeInTheDocument();
    });

  it("navigates to the functional project directory with a programmatic active state", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");

      fireEvent.click(screen.getByRole("button", { name: "Projects" }));

      expect(screen.getByRole("button", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
      expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Projects" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Blue Sky" })).toBeInTheDocument();
      expect(screen.getByLabelText("Projects search")).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByLabelText("Global search")).toHaveAttribute("aria-disabled", "true");
    });

  it("keeps guided client creation available from the Clients directory", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");

      fireEvent.click(screen.getByRole("button", { name: "Clients" }));
      expect(screen.getByRole("button", { name: "Clients" })).toHaveAttribute("aria-current", "page");
      fireEvent.click(screen.getByRole("button", { name: "New client" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "New client" })).toBeInTheDocument();
    });

  it("opens Client Details and the shared Project Overview from Clients", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");

      fireEvent.click(screen.getByRole("button", { name: "Clients" }));
      expect(screen.getByRole("button", { name: "Acme Records" })).toBeInTheDocument();
      expect(screen.getByText("acme")).toBeInTheDocument();
      expect(screen.getByText("The Artist")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Acme Records" }));
      expect(screen.getByRole("heading", { name: "Acme Records", level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/client editing.*available yet/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Blue Sky" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      expect(
        within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", {
          name: "Projects",
        }),
      ).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
      expect(screen.getByText("48 kHz / 24-bit / WAV")).toBeInTheDocument();
      const projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).getAllByRole(/button|generic/).filter((element) => element.matches("button, span")).map((element) => element.textContent)).toEqual([
        "Overview",
        "Client Files",
        "Audio Prep",
        "References",
        "Revisions",
        "Delivery",
        "Files",
      ]);
      expect(screen.getByRole("button", { name: "Intake" })).toBeEnabled();
      expect(within(projectNavigation).getByRole("button", { name: "Revisions" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Open folder" })).toBeEnabled();
    });

  it("resolves and opens only the validated project folder", async () => {
      const path = "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky";
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "resolve_folder" || command === "open_folder") return Promise.resolve({ path });
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      expect(await screen.findByText(path)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith("open_folder", { request: { location: "project", clientId: "acme", projectId: "blue-sky" } }));
      expect(await screen.findByText("Folder opened.")).toBeInTheDocument();
    });

  it("copies only the freshly resolved validated project folder", async () => {
      const path = "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky";
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "resolve_folder") return Promise.resolve({ path });
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(await screen.findByRole("button", { name: "Copy path" }));

      await waitFor(() => expect(mockedWriteText).toHaveBeenCalledWith(path));
      expect(await screen.findByText("Path copied.")).toBeInTheDocument();
    });

  it("keeps long validated paths in a separate row above folder actions", async () => {
      const path = `/Users/engineer/Music/Mixes/Clients/${"very-long-client-name-".repeat(6)}/Projects/blue-sky`;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "resolve_folder") return Promise.resolve({ path });
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));

      const pathText = await screen.findByText(path);
      const folderControl = pathText.closest(".folder-control");
      const actions = folderControl?.querySelector(".directory-actions");

      expect(folderControl).not.toBeNull();
      expect(pathText.nextElementSibling).toBe(actions);
      expect(actions).toContainElement(screen.getByRole("button", { name: "Copy path" }));
      expect(actions).toContainElement(screen.getByRole("button", { name: "Open folder" }));
    });

  it("uses the locked project navigation and dedicated shell views", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));

      const projectNavigation = screen.getByRole("navigation", { name: "Project navigation" });
      expect(within(projectNavigation).queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
      expect(within(projectNavigation).queryByRole("button", { name: "Metadata" })).not.toBeInTheDocument();

      fireEvent.click(within(projectNavigation).getByRole("button", { name: "Audio Prep" }));
      expect(screen.getByRole("heading", { name: "Audio Prep" })).toBeInTheDocument();
      expect(within(screen.getByRole("navigation", { name: "Project navigation" })).getByText("Audio Prep")).toHaveAttribute("aria-current", "page");

      fireEvent.click(within(screen.getByRole("navigation", { name: "Project navigation" })).getByRole("button", { name: "References" }));
      expect(screen.getByRole("heading", { name: "References" })).toBeInTheDocument();
      expect(within(screen.getByRole("navigation", { name: "Project navigation" })).getByText("References")).toHaveAttribute("aria-current", "page");

      fireEvent.click(within(screen.getByRole("navigation", { name: "Project navigation" })).getByRole("button", { name: "Files" }));
      expect(screen.getByRole("heading", { name: "Files" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Project file workspace" })).toBeInTheDocument();
      expect(within(screen.getByRole("navigation", { name: "Project navigation" })).getByText("Files")).toHaveAttribute("aria-current", "page");
      expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    });
});
