import { describe, expect, it } from "vitest";
import { healthyWorkspace } from "../App.testSupport";
import type { DerivedTask } from "../types";
import { deriveDashboardWorkflowSummary } from "./dashboardWorkflowSummary";

const task = (priority: DerivedTask["priority"], projectId: string): DerivedTask => ({
  id: `${priority}:${projectId}`,
  priority,
  title: "Task",
  reason: "Reason",
  recommendedAction: "Action",
  clientId: "acme",
  clientName: "Acme Records",
  projectId,
  projectName: projectId,
  deadline: null,
});

describe("deriveDashboardWorkflowSummary", () => {
  it("uses authoritative review and delivery tasks and counts aligned delivered projects as completed", () => {
    const snapshot = healthyWorkspace();
    const base = snapshot.clients[0].projects[0];
    snapshot.clients[0].projects = [
      { ...base, projectId: "review", currentRevision: 2, approvedRevision: 1, deliveredRevision: null },
      { ...base, projectId: "delivery", currentRevision: 2, approvedRevision: 2, deliveredRevision: 1 },
      { ...base, projectId: "completed", currentRevision: 2, approvedRevision: 2, deliveredRevision: 2 },
    ];
    snapshot.tasks = [task("review", "review"), task("delivery", "delivery")];

    expect(deriveDashboardWorkflowSummary(snapshot)).toEqual({
      awaitingReview: 1,
      readyToDeliver: 1,
      completed: 1,
    });
  });

  it("counts projects once even when duplicate workflow tasks are present", () => {
    const snapshot = healthyWorkspace();
    snapshot.tasks = [task("review", "blue-sky"), { ...task("review", "blue-sky"), id: "review:duplicate" }];

    expect(deriveDashboardWorkflowSummary(snapshot).awaitingReview).toBe(1);
  });

  it("returns zero workflow counts for a workspace with no matching project state", () => {
    const snapshot = healthyWorkspace();
    snapshot.tasks = [];
    snapshot.clients[0].projects[0] = {
      ...snapshot.clients[0].projects[0],
      currentRevision: 2,
      approvedRevision: 1,
      deliveredRevision: null,
    };

    expect(deriveDashboardWorkflowSummary(snapshot)).toEqual({
      awaitingReview: 0,
      readyToDeliver: 0,
      completed: 0,
    });
  });
});
