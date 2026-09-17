import { ActionIcon } from "../components/ActionIcon";
import type { ResourceState } from "../AppShellViews";
import type { ActivityEvent, ClientSummary, DerivedTask, ProjectSummary, VersionCheck, WorkspaceSnapshot } from "../types";
import type { WorkspaceStorageState, WorkspaceStorageSummary } from "../app/useWorkspaceStorageSummary";
import { AudioHeroArtwork } from "./HeroArtwork";
import { DashboardIcon, type DashboardIconName } from "./DashboardIcon";
import { TodayWorkEmptyState } from "./TodayWorkEmptyState";
import { deriveDashboardWorkflowSummary } from "./dashboardWorkflowSummary";
import { loadRecentProject, type RecentProjectReference } from "./recentProject";
import "./DashboardV21.css";

interface DashboardV21Props {
  workspace: ResourceState<WorkspaceSnapshot>;
  storage: WorkspaceStorageState;
  version: ResourceState<VersionCheck>;
  automationReady: boolean;
  loading: boolean;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
  onRefresh: () => void;
  onNewClient: () => void;
  onNewProject: () => void;
  onProjects: () => void;
  onTasks: () => void;
  onActivity: () => void;
  onOpenProject: (clientId: string, projectId: string) => void;
}

interface ResolvedRecentProject {
  client: ClientSummary;
  project: ProjectSummary;
  reference: RecentProjectReference;
}

const taskTone: Record<DerivedTask["priority"], { label: string; tone: string; icon: DashboardIconName }> = {
  recovery: { label: "High", tone: "critical", icon: "alert" },
  overdue: { label: "High", tone: "critical", icon: "up" },
  delivery: { label: "Medium", tone: "attention", icon: "package" },
  upcoming: { label: "Medium", tone: "attention", icon: "clock" },
  review: { label: "Review", tone: "active", icon: "review" },
};

const activityTone: Record<ActivityEvent["eventType"], { tone: string; icon: DashboardIconName }> = {
  clientCreated: { tone: "neutral", icon: "person" },
  projectCreated: { tone: "active", icon: "folder" },
  revisionCreated: { tone: "active", icon: "revision" },
  revisionApproved: { tone: "positive", icon: "check" },
  deliveryCreated: { tone: "violet", icon: "package" },
};

const activityLabel: Record<ActivityEvent["eventType"], string> = {
  clientCreated: "Client added",
  projectCreated: "Project created",
  revisionCreated: "Revision created",
  revisionApproved: "Mix approved",
  deliveryCreated: "Delivery created",
};

export function resolveRecentProject(snapshot: WorkspaceSnapshot, reference: RecentProjectReference | null): ResolvedRecentProject | null {
  if (!reference) return null;
  const client = snapshot.clients.find((item) => item.clientId === reference.clientId);
  const project = client?.projects.find((item) => item.projectId === reference.projectId);
  return client && project ? { client, project, reference } : null;
}

function formatRecentOpenedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  return sameDay ? `Today, ${time}` : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatActivityTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return value;
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday = date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate();
  return wasYesterday ? "Yesterday" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

function storageSummary(summary: WorkspaceStorageSummary | null) {
  if (!summary) return "Unavailable";
  return `${formatBytes(summary.sizeBytes)} · ${summary.fileCount.toLocaleString()} ${summary.fileCount === 1 ? "file" : "files"}`;
}

function projectStatus(project: ProjectSummary) {
  if (project.deliveredRevision !== null && project.deliveredRevision === project.currentRevision) {
    return { label: "Delivered", detail: `Revision ${String(project.currentRevision).padStart(2, "0")} delivered`, tone: "positive" };
  }
  if (project.approvedRevision !== null && project.approvedRevision === project.currentRevision) {
    return { label: "Approved", detail: "Approved revision is ready for delivery", tone: "positive" };
  }
  return { label: "In Progress", detail: "Current revision differs from approved revision", tone: "active" };
}

function ContinueWorkingHero({ workspace, onOpenProject, onProjects, onRefresh }: {
  workspace: ResourceState<WorkspaceSnapshot>;
  onOpenProject: (clientId: string, projectId: string) => void;
  onProjects: () => void;
  onRefresh: () => void;
}) {
  const reference = loadRecentProject();
  if (workspace.status === "loading") {
    return <section className="dashboard-v21-hero dashboard-v21-hero-state"><AudioHeroArtwork /><div><p className="dashboard-v21-kicker">Continue working</p><h2>Finding your recent project…</h2><p>Studio is reading the current workspace.</p></div></section>;
  }
  if (workspace.status === "error" || workspace.value.status === "unavailable" || workspace.value.status === "invalid") {
    return <section className="dashboard-v21-hero dashboard-v21-hero-state"><AudioHeroArtwork /><div><p className="dashboard-v21-kicker">Continue working</p><h2>Workspace unavailable</h2><p>Your recent project can’t be resolved until the configured workspace is available again.</p><button type="button" onClick={onRefresh}><ActionIcon name="retry" />Try Again</button></div></section>;
  }
  const recent = resolveRecentProject(workspace.value, reference);
  if (!reference) {
    return <section className="dashboard-v21-hero dashboard-v21-hero-state"><AudioHeroArtwork /><div><p className="dashboard-v21-kicker">Continue working</p><h2>No recent project yet</h2><p>Open a project once and Studio will keep a machine-local shortcut here for your next session.</p><button type="button" onClick={onProjects}><ActionIcon name="folder" />Go to Projects</button></div></section>;
  }
  if (!recent) {
    return <section className="dashboard-v21-hero dashboard-v21-hero-state"><AudioHeroArtwork /><div><p className="dashboard-v21-kicker">Continue working</p><h2>Recent project unavailable</h2><p>The last project opened on this machine is no longer present in the current workspace.</p><div className="dashboard-v21-hero-actions-inline"><button type="button" onClick={onProjects}><ActionIcon name="folder" />Go to Projects</button><button type="button" className="secondary" onClick={onRefresh}><ActionIcon name="refresh" />Refresh Workspace</button></div></div></section>;
  }
  const status = projectStatus(recent.project);
  return (
    <section className="dashboard-v21-hero" aria-labelledby="continue-working-heading">
      <AudioHeroArtwork />
      <div className="dashboard-v21-hero-copy">
        <p className="dashboard-v21-kicker">Continue working</p>
        <div className="dashboard-v21-hero-meta">
          <span><small>Client</small><strong>{recent.client.clientName}</strong></span>
          <span><small>Artist</small><strong>{recent.project.artist || recent.client.defaultArtist || "—"}</strong></span>
          <span><small>Current revision</small><strong>Rev {String(recent.project.currentRevision).padStart(2, "0")}</strong></span>
        </div>
        <h2 id="continue-working-heading">{recent.project.projectName}</h2>
        <div className="dashboard-v21-status-line"><span className={`dashboard-v21-status-pill ${status.tone}`}>{status.label}</span><span>{status.detail}</span></div>
        <p className="dashboard-v21-last-opened"><DashboardIcon name="clock" />Last opened on this machine: {formatRecentOpenedAt(recent.reference.openedAt)}</p>
      </div>
      <div className="dashboard-v21-hero-actions">
        <button type="button" onClick={() => onOpenProject(recent.client.clientId, recent.project.projectId)}><ActionIcon name="folder" />Open Project</button>
        <button type="button" className="secondary" onClick={onProjects}><ActionIcon name="folder" />Go to Projects</button>
      </div>
    </section>
  );
}

function TodayTask({ task, onOpenProject }: { task: DerivedTask; onOpenProject: (clientId: string, projectId: string) => void }) {
  const presentation = taskTone[task.priority];
  return (
    <article className="dashboard-v21-task">
      <div className={`dashboard-v21-task-priority ${presentation.tone}`}><DashboardIcon name={presentation.icon} /><span>{presentation.label}</span></div>
      <div className="dashboard-v21-task-copy"><strong>{task.title}</strong><span>{task.projectName ?? task.clientName ?? "Workspace"}{task.deadline ? ` · Due ${task.deadline}` : ""}</span><small>{task.reason}</small></div>
      {task.clientId && task.projectId ? <button type="button" className="secondary" onClick={() => onOpenProject(task.clientId!, task.projectId!)}><ActionIcon name="folder" />Open Project</button> : null}
    </article>
  );
}

function ActivityItem({ event, onOpenProject }: { event: ActivityEvent; onOpenProject: (clientId: string, projectId: string) => void }) {
  const presentation = activityTone[event.eventType];
  return (
    <article className="dashboard-v21-activity-item">
      <span className={`dashboard-v21-activity-icon ${presentation.tone}`}><DashboardIcon name={presentation.icon} /></span>
      <time dateTime={event.timestamp}>{formatActivityTimestamp(event.timestamp)}</time>
      <div><strong>{activityLabel[event.eventType]}{event.revision !== null ? ` · Rev ${String(event.revision).padStart(2, "0")}` : ""}</strong><small>{event.projectName ?? event.clientName}</small></div>
      {event.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(event.clientId, event.projectId!)}>Open Project</button> : null}
    </article>
  );
}

export function DashboardV21(props: DashboardV21Props) {
  const snapshot = props.workspace.status === "ready" ? props.workspace.value : null;
  const workspaceHealthy = snapshot?.status === "healthy" || snapshot?.status === "empty";
  const storagePartial = (props.storage.value?.failedPaths.length ?? 0) > 0;
  const storageHealthy = props.storage.value !== null && props.storage.status !== "error" && !storagePartial;
  const issueCount = snapshot?.issues.length ?? 0;
  const workflowSummary = snapshot ? deriveDashboardWorkflowSummary(snapshot) : null;

  return (
    <div className="dashboard-v21">
      <ContinueWorkingHero workspace={props.workspace} onOpenProject={props.onOpenProject} onProjects={props.onProjects} onRefresh={props.onRefresh} />

      {snapshot && issueCount > 0 && (
        <section className="dashboard-v21-attention" role="status">
          <span className="dashboard-v21-attention-icon"><DashboardIcon name="alert" /></span>
          <div><strong>Workspace needs attention — {issueCount} workspace {issueCount === 1 ? "issue was" : "issues were"} detected.</strong><span>Readable clients and projects remain available.</span></div>
          <a href="#workspace-issues">Review issues</a>
        </section>
      )}

      <div className="dashboard-v21-grid">
        <div className="dashboard-v21-primary-column">
          <section className="dashboard-v21-card dashboard-v21-work" aria-labelledby="dashboard-work-heading">
            <div className="dashboard-v21-card-heading"><div><h2 id="dashboard-work-heading">Today’s Work</h2><p>What needs your attention</p></div><button type="button" className="table-link" onClick={props.onTasks}>View all</button></div>
            {snapshot && snapshot.tasks.length > 0 ? <div className="dashboard-v21-task-list">{snapshot.tasks.slice(0, 4).map((task) => <TodayTask key={task.id} task={task} onOpenProject={props.onOpenProject} />)}</div> : <TodayWorkEmptyState />}
          </section>

          <section className="dashboard-v21-card dashboard-v21-activity" aria-labelledby="dashboard-activity-heading">
            <div className="dashboard-v21-card-heading"><div><h2 id="dashboard-activity-heading">Recent Activity</h2><p>What’s been happening</p></div><button type="button" className="table-link" onClick={props.onActivity}>View all</button></div>
            {snapshot && snapshot.activity.length > 0 ? <div className="dashboard-v21-activity-list">{snapshot.activity.slice(0, 5).map((event) => <ActivityItem key={event.id} event={event} onOpenProject={props.onOpenProject} />)}</div> : <div className="dashboard-v21-empty"><span className="dashboard-v21-empty-icon active"><DashboardIcon name="wave" /></span><div><strong>No recent activity yet.</strong><p>Project milestones will appear here as your work moves forward.</p></div></div>}
          </section>
        </div>

        <aside className="dashboard-v21-secondary-column">
          <section className="dashboard-v21-card dashboard-v21-quick-actions" aria-labelledby="dashboard-actions-heading">
            <div className="dashboard-v21-card-heading"><div><h2 id="dashboard-actions-heading">Quick Actions</h2><p>Common studio actions</p></div></div>
            <div className="dashboard-v21-actions">
              <button type="button" onClick={props.onNewProject} disabled={!props.projectCreationAvailable} title={props.projectCreationHelp}><ActionIcon name="add" />New Project</button>
              <button type="button" className="secondary" onClick={props.onNewClient} disabled={!props.clientCreationAvailable} title={props.clientCreationHelp}><ActionIcon name="add" />New Client</button>
              <button type="button" className="secondary" onClick={props.onRefresh} disabled={props.loading}><ActionIcon name="refresh" />{props.loading ? "Refreshing…" : "Refresh Workspace"}</button>
            </div>
            <small>Start something new or keep your workspace up to date.</small>
          </section>

          <section className="dashboard-v21-card dashboard-v21-health" aria-labelledby="dashboard-health-heading">
            <div className="dashboard-v21-card-heading"><div><h2 id="dashboard-health-heading">Studio Health</h2><p>Current checks</p></div></div>
            <dl>
              <div><dt><DashboardIcon name="folder" />Workspace</dt><dd><span className={`dashboard-v21-health-status ${workspaceHealthy ? "positive" : "attention"}`}><DashboardIcon name={workspaceHealthy ? "check" : "alert"} /></span>{snapshot ? (workspaceHealthy ? "Healthy" : "Needs attention") : "Checking"}</dd></div>
              <div><dt><DashboardIcon name="storage" />Storage</dt><dd><span className={`dashboard-v21-health-status ${storageHealthy ? "positive" : "attention"}`}><DashboardIcon name={storageHealthy ? "check" : "alert"} /></span>{props.storage.status === "loading" ? "Calculating" : storageHealthy ? "Healthy" : "Needs attention"}</dd></div>
              <div><dt><DashboardIcon name="wave" />JL Mixing Automation</dt><dd><span className={`dashboard-v21-health-status ${props.automationReady ? "positive" : "attention"}`}><DashboardIcon name={props.automationReady ? "check" : "alert"} /></span>{props.version.status === "loading" ? "Checking" : props.automationReady ? "Detected" : "Needs attention"}</dd></div>
            </dl>
            <p className="dashboard-v21-card-detail">{props.version.status === "ready" ? props.version.value.message : props.version.status === "error" ? props.version.message : "Checking the installed release."}</p>
          </section>

          <section className="dashboard-v21-card dashboard-v21-workspace" aria-labelledby="dashboard-workspace-heading">
            <div className="dashboard-v21-card-heading"><div><h2 id="dashboard-workspace-heading">Workspace Summary</h2><p>Workflow, storage and scope</p></div></div>
            <div className="dashboard-v21-workspace-stats">
              <span><DashboardIcon name="wave" /><small>Studio</small><strong>{snapshot?.studio?.studioName ?? "—"}</strong></span>
              <span><DashboardIcon name="person" /><small>Clients</small><strong>{snapshot?.counts.clients ?? "—"}</strong></span>
              <span><DashboardIcon name="folder" /><small>Files</small><strong>{props.storage.value?.fileCount.toLocaleString() ?? "—"}</strong></span>
              <span><DashboardIcon name="folder" /><small>Projects</small><strong>{snapshot?.counts.projects ?? "—"}</strong></span>
              <span><DashboardIcon name="review" /><small>Awaiting Review</small><strong>{workflowSummary?.awaitingReview ?? "—"}</strong></span>
              <span><DashboardIcon name="package" /><small>Ready to Deliver</small><strong>{workflowSummary?.readyToDeliver ?? "—"}</strong></span>
              <span><DashboardIcon name="check" /><small>Completed</small><strong>{workflowSummary?.completed ?? "—"}</strong></span>
              <span className="workspace-wide"><DashboardIcon name="storage" /><small>Storage</small><strong>{storageSummary(props.storage.value)}</strong></span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
