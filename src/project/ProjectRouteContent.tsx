import { useEffect, useState, type ReactNode } from "react";
import type { ClientSummary, DerivedTask, ProjectSummary, RevisionSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { IntakeView } from "../intake/IntakeViews";
import { AudioPrepView } from "../audioPrep/AudioPrepView";
import { ReferencesView } from "../references/ReferencesView";
import { RevisionsView } from "../revision/RevisionViews";
import { DeliveryView } from "../delivery/DeliveryView";
import { ProjectFilesShellView } from "./ProjectFilesShellView";
import { ProjectOverviewShell } from "./ProjectOverviewShell";
import type { ProjectShellView } from "./ProjectView";

export interface ProjectRouteContentProps {
  view: ProjectShellView; client: ClientSummary; project: ProjectSummary; workspacePath: string; projectTasks: DerivedTask[]; loading: boolean;
  intakeReport: IntakeReportState; intakeActionError: string | null; intakeValidationAvailable: boolean; intakeValidationHelp: string; intakeLoading: boolean;
  revisionActionError: string | null; revisionCreationAvailable: boolean; revisionCreationHelp: string; revisionApprovalAvailable: boolean; revisionApprovalHelp: string;
  deliveryActionError: string | null; deliveryCreationAvailable: boolean; deliveryCreationHelp: string; deliveryLoading: boolean;
  onProjects: () => void; onRefresh: () => void; onIntakeRefresh: () => void; onStructuredValidationRefresh: () => void; onSelectView: (view: ProjectShellView) => void; onOpenIntake: () => void; onRecheckIntake: () => void; onOpenRevisions: () => void; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onCreateDelivery: () => void;
}

const retainedViews = new Set<ProjectShellView>(["references", "revisions", "delivery"]);

export function ProjectRouteContent(p: ProjectRouteContentProps) {
  const [visitedRetainedViews, setVisitedRetainedViews] = useState<Set<ProjectShellView>>(() =>
    retainedViews.has(p.view) ? new Set([p.view]) : new Set(),
  );

  useEffect(() => {
    if (!retainedViews.has(p.view)) return;
    setVisitedRetainedViews((current) => {
      if (current.has(p.view)) return current;
      const next = new Set(current);
      next.add(p.view);
      return next;
    });
  }, [p.view]);

  const common = { onProjects: p.onProjects, onOverview: () => p.onSelectView("overview"), onSelectView: p.onSelectView };
  const renderRetained = (view: ProjectShellView, content: ReactNode) =>
    visitedRetainedViews.has(view) || p.view === view
      ? <div style={{ display: p.view === view ? "contents" : "none" }} aria-hidden={p.view !== view}>{content}</div>
      : null;

  return <>
    {p.view === "intake" && <IntakeView client={p.client} project={p.project} reportState={p.intakeReport} actionError={p.intakeActionError} validationAvailable={p.intakeValidationAvailable} validationHelp={p.intakeValidationHelp} loading={p.intakeLoading} onRecheck={p.onRecheckIntake} onRefresh={p.onIntakeRefresh} {...common} />}
    {p.view === "audioPrep" && <AudioPrepView client={p.client} project={p.project} reportState={p.intakeReport} onValidationRefresh={p.onStructuredValidationRefresh} {...common} />}
    {renderRetained("references", <ReferencesView client={p.client} project={p.project} {...common} />)}
    {renderRetained("revisions", <RevisionsView client={p.client} project={p.project} loading={p.loading} actionError={p.revisionActionError} creationAvailable={p.revisionCreationAvailable} creationHelp={p.revisionCreationHelp} approvalAvailable={p.revisionApprovalAvailable} approvalHelp={p.revisionApprovalHelp} deliveryAvailable={p.deliveryCreationAvailable} deliveryHelp={p.deliveryCreationHelp} onRefresh={p.onRefresh} onNewRevision={p.onNewRevision} onApprove={p.onApproveRevision} onCreateDelivery={() => { p.onSelectView("delivery"); p.onCreateDelivery(); }} {...common} />)}
    {renderRetained("delivery", <DeliveryView clientId={p.client.clientId} project={p.project} loading={p.deliveryLoading} actionError={p.deliveryActionError} creationAvailable={p.deliveryCreationAvailable} creationHelp={p.deliveryCreationHelp} onCreate={p.onCreateDelivery} onRefresh={p.onRefresh} {...common} />)}
    {p.view === "files" && <ProjectFilesShellView client={p.client} project={p.project} {...common} />}
    {p.view === "overview" && <ProjectOverviewShell client={p.client} project={p.project} projectTasks={p.projectTasks} intakeReport={p.intakeReport} loading={p.loading} revisionCreationAvailable={p.revisionCreationAvailable} revisionApprovalAvailable={p.revisionApprovalAvailable} onProjects={p.onProjects} onRefresh={p.onRefresh} onRevisions={p.onOpenRevisions} onNewRevision={p.onNewRevision} onApproveRevision={p.onApproveRevision} onSelectView={p.onSelectView} />}
  </>;
}
