import { useState } from "react";
import type { ResourceState } from "../AppViews";
import { ActionIcon } from "../components/ActionIcon";
import type { ActivityEvent, ActivityEventType, DerivedTask, TaskPriority, WorkspaceSnapshot } from "../types";
import "./TaskActivityRoutes.css";

const taskPriorityLabel: Record<TaskPriority, string> = {
  recovery: "Recovery",
  overdue: "Overdue",
  delivery: "Delivery",
  upcoming: "Upcoming",
  review: "Review",
};

const activityEventLabel: Record<ActivityEventType, string> = {
  clientCreated: "Client created",
  projectCreated: "Project created",
  revisionCreated: "Revision created",
  revisionApproved: "Revision approved",
  deliveryCreated: "Delivery created",
};

const formatEventTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const normalize = (value: string | null | undefined) => value?.toLocaleLowerCase() ?? "";

export type TaskPriorityFilter = "all" | TaskPriority;
export type ActivityTypeFilter = "all" | ActivityEventType;

export function filterTasks(tasks: DerivedTask[], query = "", priority: TaskPriorityFilter = "all") {
  const needle = normalize(query.trim());
  return tasks.filter((task) => {
    if (priority !== "all" && task.priority !== priority) return false;
    if (!needle) return true;
    return [
      task.title,
      task.reason,
      task.recommendedAction,
      task.clientName,
      task.projectName,
      task.deadline,
      task.priority,
      taskPriorityLabel[task.priority],
    ].some((value) => normalize(value).includes(needle));
  });
}

export function filterActivity(events: ActivityEvent[], query = "", eventType: ActivityTypeFilter = "all") {
  const needle = normalize(query.trim());
  return events.filter((event) => {
    if (eventType !== "all" && event.eventType !== eventType) return false;
    if (!needle) return true;
    return [
      activityEventLabel[event.eventType],
      event.eventType,
      event.clientName,
      event.projectName,
      event.persistedSource,
      event.revision === null ? null : `revision ${event.revision}`,
      formatEventTimestamp(event.timestamp),
    ].some((value) => normalize(value).includes(needle));
  });
}

function FilterControls({
  label,
  query,
  onQueryChange,
  filterLabel,
  filterValue,
  onFilterChange,
  options,
  onClear,
  active,
}: {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  filterLabel: string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  onClear: () => void;
  active: boolean;
}) {
  return (
    <section className="task-activity-controls" aria-label={`${label} search and filters`}>
      <label className="task-activity-search">
        <span className="visually-hidden">Search {label.toLowerCase()}</span>
        <ActionIcon name="search" />
        <input
          type="search"
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={`Search ${label.toLowerCase()}`}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <label className="task-activity-filter">
        <span>{filterLabel}</span>
        <select aria-label={filterLabel} value={filterValue} onChange={(event) => onFilterChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" className="secondary" onClick={onClear} disabled={!active}>Clear</button>
    </section>
  );
}

function ResultCount({ visible, total, noun }: { visible: number; total: number; noun: string }) {
  if (visible === total) return <h2>{total} {total === 1 ? noun : `${noun}s`}</h2>;
  return <h2>{visible} of {total} {total === 1 ? noun : `${noun}s`}</h2>;
}

export function TasksRoute({
  workspace,
  loading,
  onRefresh,
  onOpenProject,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  loading: boolean;
  onRefresh: () => void;
  onOpenProject: (clientId: string, projectId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<TaskPriorityFilter>("all");

  if (workspace.status === "loading") return <section className="notice">Checking what needs attention…</section>;
  if (workspace.status === "error") return <section className="notice error"><strong>We couldn’t load your tasks</strong><span>{workspace.message}</span></section>;

  const snapshot = workspace.value;
  const filtered = filterTasks(snapshot.tasks, query, priority);
  const filtersActive = query.trim() !== "" || priority !== "all";
  const clear = () => { setQuery(""); setPriority("all"); };

  return <>
    <section className="directory-toolbar">
      <div><p className="kicker">Studio work</p><ResultCount visible={filtered.length} total={snapshot.tasks.length} noun="task" /></div>
      <button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</button>
    </section>
    <FilterControls
      label="Tasks"
      query={query}
      onQueryChange={setQuery}
      filterLabel="Priority"
      filterValue={priority}
      onFilterChange={(value) => setPriority(value as TaskPriorityFilter)}
      options={[
        { value: "all", label: "All priorities" },
        ...Object.entries(taskPriorityLabel).map(([value, label]) => ({ value, label })),
      ]}
      onClear={clear}
      active={filtersActive}
    />
    {snapshot.tasks.length === 0 ? (
      <section className="empty-state"><h2>Nothing needs your attention</h2><p>You’re all caught up for now.</p></section>
    ) : filtered.length === 0 ? (
      <section className="empty-state"><h2>No tasks match your search</h2><p>Try another search or clear the current filters.</p><button type="button" className="secondary" onClick={clear}>Clear filters</button></section>
    ) : (
      <section className="panel"><div className="table-scroll"><table><thead><tr><th>Priority</th><th>Task</th><th>Project</th><th>Reason</th><th>Recommended action</th></tr></thead><tbody>{filtered.map((task) => <tr key={task.id}><td><span className={`priority-pill ${task.priority}`}>{taskPriorityLabel[task.priority]}</span></td><td><strong>{task.title}</strong>{task.deadline && <small className="table-detail">Deadline {task.deadline}</small>}</td><td>{task.clientId && task.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(task.clientId!, task.projectId!)}>{task.projectName}</button> : task.projectName ?? "Workspace"}</td><td>{task.reason}</td><td>{task.recommendedAction}</td></tr>)}</tbody></table></div></section>
    )}
    <aside className="route-note"><strong>Updated when you refresh</strong><span>Tasks are based on the current state of your studio and projects.</span></aside>
  </>;
}

export function ActivityRoute({
  workspace,
  loading,
  onRefresh,
  onOpenProject,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  loading: boolean;
  onRefresh: () => void;
  onOpenProject: (clientId: string, projectId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState<ActivityTypeFilter>("all");

  if (workspace.status === "loading") return <section className="notice">Loading recent activity…</section>;
  if (workspace.status === "error") return <section className="notice error"><strong>We couldn’t load recent activity</strong><span>{workspace.message}</span></section>;

  const snapshot = workspace.value;
  const filtered = filterActivity(snapshot.activity, query, eventType);
  const filtersActive = query.trim() !== "" || eventType !== "all";
  const clear = () => { setQuery(""); setEventType("all"); };

  return <>
    <section className="directory-toolbar">
      <div><p className="kicker">Recent studio activity</p><ResultCount visible={filtered.length} total={snapshot.activity.length} noun="event" /></div>
      <button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</button>
    </section>
    <FilterControls
      label="Activity"
      query={query}
      onQueryChange={setQuery}
      filterLabel="Event type"
      filterValue={eventType}
      onFilterChange={(value) => setEventType(value as ActivityTypeFilter)}
      options={[
        { value: "all", label: "All event types" },
        ...Object.entries(activityEventLabel).map(([value, label]) => ({ value, label })),
      ]}
      onClear={clear}
      active={filtersActive}
    />
    {snapshot.activity.length === 0 ? (
      <section className="empty-state"><h2>No recent activity yet</h2><p>Project activity will appear here as work moves forward.</p></section>
    ) : filtered.length === 0 ? (
      <section className="empty-state"><h2>No activity matches your search</h2><p>Try another search or clear the current filters.</p><button type="button" className="secondary" onClick={clear}>Clear filters</button></section>
    ) : (
      <section className="panel"><div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Event</th><th>Project or client</th><th>Source</th></tr></thead><tbody>{filtered.map((event) => <tr key={event.id}><td><time dateTime={event.timestamp}>{formatEventTimestamp(event.timestamp)}</time></td><td>{activityEventLabel[event.eventType]}{event.revision !== null && <small className="table-detail">Revision {event.revision}</small>}</td><td>{event.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(event.clientId, event.projectId!)}>{event.projectName}</button> : event.clientName}</td><td><code>{event.persistedSource}</code></td></tr>)}</tbody></table></div></section>
    )}
    <aside className="route-note"><strong>Activity history</strong><span>This view shows supported project milestones recorded by JL Mixing Automation.</span></aside>
  </>;
}
