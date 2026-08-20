import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { healthyWorkspace, version } from "../App.testSupport";
import type { WorkspaceStorageState } from "../app/useWorkspaceStorageSummary";
import { DashboardV21, resolveRecentProject } from "./DashboardV21";
import { loadRecentProject, rememberRecentProject } from "./recentProject";

const storage: WorkspaceStorageState = {
  status: "ready",
  value: { fileCount: 642, sizeBytes: 18_400_000_000, failedPaths: [] },
  message: null,
};

const baseProps = () => ({
  workspace: { status: "ready" as const, value: healthyWorkspace() },
  storage,
  version: { status: "ready" as const, value: version },
  automationReady: true,
  loading: false,
  clientCreationAvailable: true,
  clientCreationHelp: "Ready",
  projectCreationAvailable: true,
  projectCreationHelp: "Ready",
  onRefresh: vi.fn(),
  onNewClient: vi.fn(),
  onNewProject: vi.fn(),
  onProjects: vi.fn(),
  onTasks: vi.fn(),
  onActivity: vi.fn(),
  onOpenProject: vi.fn(),
});

describe("DashboardV21", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows a deliberate first-launch state when no recent project exists", () => {
    const props = baseProps();
    render(<DashboardV21 {...props} />);
    expect(screen.getByRole("heading", { name: "No recent project yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to Projects" }));
    expect(props.onProjects).toHaveBeenCalledOnce();
  });

  it("resolves and opens the machine-local recent project", () => {
    rememberRecentProject("acme", "blue-sky", new Date("2026-08-19T13:42:00Z"));
    const props = baseProps();
    render(<DashboardV21 {...props} />);
    expect(screen.getByRole("heading", { name: "Blue Sky" })).toBeInTheDocument();
    expect(screen.getByText("Acme Records")).toBeInTheDocument();
    expect(screen.getByText("The Artist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Project" }));
    expect(props.onOpenProject).toHaveBeenCalledWith("acme", "blue-sky");
  });

  it("does not silently substitute another project for a stale recent reference", () => {
    rememberRecentProject("acme", "missing-project", new Date("2026-08-19T13:42:00Z"));
    const props = baseProps();
    render(<DashboardV21 {...props} />);
    const heading = screen.getByRole("heading", { name: "Recent project unavailable" });
    expect(heading).toBeInTheDocument();
    const hero = heading.closest("section");
    expect(hero).not.toBeNull();
    expect(within(hero!).queryByRole("button", { name: "Open Project" })).not.toBeInTheDocument();
  });

  it("shows the workspace-unavailable recent-project state safely", () => {
    rememberRecentProject("acme", "blue-sky", new Date("2026-08-19T13:42:00Z"));
    const props = baseProps();
    props.workspace.value = { ...props.workspace.value, status: "unavailable", clients: [] };
    render(<DashboardV21 {...props} />);
    expect(screen.getByRole("heading", { name: "Workspace unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(props.onRefresh).toHaveBeenCalledOnce();
  });
});

describe("recent project state", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists only stable project identity and an opened timestamp", () => {
    const openedAt = new Date("2026-08-19T13:42:00Z");
    rememberRecentProject("acme", "blue-sky", openedAt);
    expect(loadRecentProject()).toEqual({
      clientId: "acme",
      projectId: "blue-sky",
      openedAt: openedAt.toISOString(),
    });
  });

  it("resolves a recent reference against authoritative workspace data", () => {
    const snapshot = healthyWorkspace("Current Name");
    const recent = resolveRecentProject(snapshot, {
      clientId: "acme",
      projectId: "blue-sky",
      openedAt: "2026-08-19T13:42:00Z",
    });
    expect(recent?.project.projectName).toBe("Current Name");
  });
});
