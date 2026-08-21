import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { healthyWorkspace } from "../App.testSupport";
import type { ActivityEvent, DerivedTask } from "../types";
import { ActivityRoute, TasksRoute, filterActivity, filterTasks } from "./TaskActivityRoutes";

const tasks: DerivedTask[] = [
  {
    id: "overdue-mix",
    priority: "overdue",
    title: "Finish Blue Sky mix",
    reason: "Deadline has passed",
    recommendedAction: "Open the project and finish the revision",
    clientId: "acme",
    clientName: "Acme Records",
    projectId: "blue-sky",
    projectName: "Blue Sky",
    deadline: "2026-08-20",
  },
  {
    id: "review-red",
    priority: "review",
    title: "Review Red Room revision",
    reason: "A revision is awaiting approval",
    recommendedAction: "Review the current revision",
    clientId: "north",
    clientName: "North Records",
    projectId: "red-room",
    projectName: "Red Room",
    deadline: null,
  },
];

const activity: ActivityEvent[] = [
  {
    id: "revision-approved",
    eventType: "revisionApproved",
    timestamp: "2026-08-21T14:00:00Z",
    clientId: "acme",
    clientName: "Acme Records",
    projectId: "blue-sky",
    projectName: "Blue Sky",
    revision: 2,
    persistedSource: "04_Revisions/Revision_02/revision.json",
  },
  {
    id: "client-created",
    eventType: "clientCreated",
    timestamp: "2026-08-20T14:00:00Z",
    clientId: "north",
    clientName: "North Records",
    projectId: null,
    projectName: null,
    revision: null,
    persistedSource: "clients/north/client.json",
  },
];

const workspace = (taskItems = tasks, activityItems = activity) => ({
  status: "ready" as const,
  value: { ...healthyWorkspace(), tasks: taskItems, activity: activityItems },
});

describe("task/activity presentation", () => {
  it("searches task text case-insensitively and filters by priority", () => {
    expect(filterTasks(tasks, "BLUE SKY").map((task) => task.id)).toEqual(["overdue-mix"]);
    expect(filterTasks(tasks, "", "review").map((task) => task.id)).toEqual(["review-red"]);
  });

  it("searches activity context and filters by authoritative event type", () => {
    expect(filterActivity(activity, "revision 2").map((event) => event.id)).toEqual(["revision-approved"]);
    expect(filterActivity(activity, "", "clientCreated").map((event) => event.id)).toEqual(["client-created"]);
  });

  it("returns the complete current dataset when search and filters are cleared", () => {
    expect(filterTasks(tasks, "", "all")).toEqual(tasks);
    expect(filterActivity(activity, "", "all")).toEqual(activity);
  });

  it("reconciles an active search against refreshed authoritative data", () => {
    const refreshed = [...tasks, { ...tasks[0], id: "new-blue", title: "Blue Sky delivery", priority: "delivery" as const }];
    expect(filterTasks(refreshed, "blue sky").map((task) => task.id)).toEqual(["overdue-mix", "new-blue"]);
  });
});

describe("TasksRoute", () => {
  it("updates results as the user types, shows no-results, and clears filters", () => {
    render(<TasksRoute workspace={workspace()} loading={false} onRefresh={vi.fn()} onOpenProject={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), { target: { value: "red room" } });
    expect(screen.getByRole("heading", { name: "1 of 2 tasks" })).toBeInTheDocument();
    expect(screen.getByText("Review Red Room revision")).toBeInTheDocument();
    expect(screen.queryByText("Finish Blue Sky mix")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), { target: { value: "does not exist" } });
    expect(screen.getByRole("heading", { name: "No tasks match your search" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("heading", { name: "2 tasks" })).toBeInTheDocument();
    expect(screen.getByText("Finish Blue Sky mix")).toBeInTheDocument();
  });

  it("keeps the active filter when authoritative workspace data refreshes", () => {
    const props = { workspace: workspace(), loading: false, onRefresh: vi.fn(), onOpenProject: vi.fn() };
    const { rerender } = render(<TasksRoute {...props} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), { target: { value: "blue sky" } });

    const refreshed = [...tasks, { ...tasks[0], id: "new-blue", title: "Blue Sky delivery", priority: "delivery" as const }];
    rerender(<TasksRoute {...props} workspace={workspace(refreshed)} />);
    expect(screen.getByRole("heading", { name: "2 of 3 tasks" })).toBeInTheDocument();
    expect(screen.getByText("Blue Sky delivery")).toBeInTheDocument();
  });
});

describe("ActivityRoute", () => {
  it("combines search and event-type filtering and can clear both", () => {
    render(<ActivityRoute workspace={workspace()} loading={false} onRefresh={vi.fn()} onOpenProject={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Event type" }), { target: { value: "revisionApproved" } });
    expect(screen.getByRole("heading", { name: "1 of 2 events" })).toBeInTheDocument();
    expect(screen.getByText("Revision approved")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search activity" }), { target: { value: "north" } });
    expect(screen.getByRole("heading", { name: "No activity matches your search" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("heading", { name: "2 events" })).toBeInTheDocument();
    expect(screen.getByText("North Records")).toBeInTheDocument();
  });
});
