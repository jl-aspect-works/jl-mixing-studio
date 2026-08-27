import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientSummary, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import type { IntakeValidationProgress } from "./models";
import { IntakeView } from "./IntakeViews";

vi.mock("../project/ProjectNavigationBar", () => ({
  ProjectNavigationBar: () => null,
}));

vi.mock("./ClientFilesBrowser", () => ({
  ClientFilesBrowser: () => <div data-testid="client-files-browser" />,
}));

vi.mock("./ValidationProgress", () => ({
  ValidationProgress: () => null,
}));

vi.mock("./ManagedFileOperationDialog", () => ({
  ManagedFileOperationDialog: ({
    followupRunning,
    followupProgress,
    onCompleted,
  }: {
    followupRunning?: boolean;
    followupProgress?: unknown;
    onCompleted: () => void;
  }) => <div data-testid="managed-import-dialog" data-followup-running={String(Boolean(followupRunning))} data-has-progress={String(Boolean(followupProgress))}>
    <button type="button" onClick={onCompleted}>Complete import</button>
  </div>,
}));

const client = { clientId: "acme" } as ClientSummary;
const project = { projectId: "blue-sky" } as ProjectSummary;
const reportState = { status: "loading" } as IntakeReportState;
const progress: IntakeValidationProgress = {
  clientId: "acme",
  projectId: "blue-sky",
  phase: "validating",
  completed: 3,
  total: 5,
  active: ["Kick.wav"],
};

describe("existing-project Client Files import lifecycle", () => {
  it("keeps the import dialog open and routes follow-up validation through it", () => {
    const onRecheck = vi.fn();
    const onRefresh = vi.fn();
    const props = {
      client,
      project,
      reportState,
      actionError: null,
      validationAvailable: true,
      validationHelp: "",
      loading: false,
      progress: null,
      onProjects: vi.fn(),
      onOverview: vi.fn(),
      onRecheck,
      onRefresh,
      onSelectView: vi.fn(),
    };

    const view = render(<IntakeView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Import Client Files…" }));

    const dialog = screen.getByTestId("managed-import-dialog");
    expect(dialog).toHaveAttribute("data-followup-running", "false");
    expect(dialog).toHaveAttribute("data-has-progress", "false");

    fireEvent.click(screen.getByRole("button", { name: "Complete import" }));
    expect(onRecheck).toHaveBeenCalledOnce();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("managed-import-dialog")).toBeInTheDocument();

    view.rerender(<IntakeView {...props} loading progress={progress} />);
    expect(screen.getByTestId("managed-import-dialog")).toHaveAttribute("data-followup-running", "true");
    expect(screen.getByTestId("managed-import-dialog")).toHaveAttribute("data-has-progress", "true");
  });
});
