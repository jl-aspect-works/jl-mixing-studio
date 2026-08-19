import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClientSummary, ProjectSummary, WorkspaceSnapshot } from "../types";
import { ActionIcon } from "../components/ActionIcon";
import { RouteIssues, WorkspaceContent, type ResourceState } from "../AppShellViews";
import { copy as productCopy } from "../resources/copy";
import "./ProjectsRouteV21.css";

interface ProjectEditInfo {
  updateSupported: boolean;
  clientId: string;
  projectId: string;
  projectPath: string;
  documentId: string;
  schemaVersion: string;
  createdWith: string;
  createdAt: string;
  lastModifiedAt: string;
  projectName: string;
  artist: string;
  album: string;
  producer: string;
  mixEngineer: string;
  bpm: number | null;
  musicalKey: string;
  timeSignature: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  deliveryMethod: string;
  requestedDeliverables: string[];
  deadline: string | null;
  creativeDirection: string;
  message: string;
}

interface ProjectUpdateResult {
  ok: boolean;
  code: "updated" | "conflict" | "invalidInput" | "projectUnavailable" | "automationUnavailable" | "unsupportedCapability" | "rejected" | "uncertain" | "failed";
  message: string;
}

interface ProjectEditForm {
  projectName: string;
  artist: string;
  album: string;
  producer: string;
  mixEngineer: string;
  bpm: string;
  musicalKey: string;
  timeSignature: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  deliveryMethod: string;
  requestedDeliverables: string[];
  deadline: string;
  creativeDirection: string;
}

interface ProjectEntry {
  client: ClientSummary;
  project: ProjectSummary;
}

type ProjectFilter = "all" | "attention" | "inProgress" | "approved" | "delivered";

const DELIVERABLES = [
  ["main_mix", "Main Mix"],
  ["instrumental", "Instrumental"],
  ["acapella", "Acapella"],
  ["tv_mix", "TV Mix"],
  ["performance_mix", "Performance Mix"],
  ["stems", "Stems"],
  ["master", "Master"],
] as const;

const compactRevision = (revision: number | null) => revision === null ? "—" : String(revision);

const projectStatus = (project: ProjectSummary, hasAttention: boolean) => {
  if (hasAttention) return "Needs Attention";
  if (project.deliveredRevision !== null) return "Delivered";
  if (project.approvedRevision !== null && project.currentRevision === project.approvedRevision) return "Approved";
  return "In Progress";
};

const friendlyDeliverable = (value: string) =>
  DELIVERABLES.find(([key]) => key === value)?.[1] ?? value.replace(/_/g, " ");

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formFromInfo = (info: ProjectEditInfo): ProjectEditForm => ({
  projectName: info.projectName,
  artist: info.artist,
  album: info.album,
  producer: info.producer,
  mixEngineer: info.mixEngineer,
  bpm: info.bpm === null ? "" : String(info.bpm),
  musicalKey: info.musicalKey,
  timeSignature: info.timeSignature,
  sampleRate: info.sampleRate,
  bitDepth: info.bitDepth,
  fileFormat: info.fileFormat,
  deliveryMethod: info.deliveryMethod,
  requestedDeliverables: [...info.requestedDeliverables],
  deadline: info.deadline ?? "",
  creativeDirection: info.creativeDirection,
});

const formsEqual = (left: ProjectEditForm, right: ProjectEditForm) =>
  left.projectName === right.projectName
  && left.artist === right.artist
  && left.album === right.album
  && left.producer === right.producer
  && left.mixEngineer === right.mixEngineer
  && left.bpm === right.bpm
  && left.musicalKey === right.musicalKey
  && left.timeSignature === right.timeSignature
  && left.sampleRate === right.sampleRate
  && left.bitDepth === right.bitDepth
  && left.fileFormat === right.fileFormat
  && left.deliveryMethod === right.deliveryMethod
  && left.requestedDeliverables.length === right.requestedDeliverables.length
  && left.requestedDeliverables.every((value, index) => value === right.requestedDeliverables[index])
  && left.deadline === right.deadline
  && left.creativeDirection === right.creativeDirection;

const entryKey = (entry: ProjectEntry) => `${entry.client.clientId}:${entry.project.projectId}`;

export function ProjectsRouteV21({
  workspace,
  onSelectProject,
  onNewProject,
  onRefresh,
  onSaveSuccess,
  loading,
  projectCreationAvailable,
  projectCreationHelp,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  onSelectProject: (clientId: string, projectId: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  onSaveSuccess: (message: string | null) => void;
  loading: boolean;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editInfo, setEditInfo] = useState<ProjectEditInfo | null>(null);
  const [editInfoError, setEditInfoError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProjectEditForm | null>(null);
  const [editExpectedLastModifiedAt, setEditExpectedLastModifiedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const snapshot = workspace.status === "ready" ? workspace.value : null;
  const entries = useMemo<ProjectEntry[]>(() => snapshot
    ? snapshot.clients.flatMap((client) => client.projects.map((project) => ({ client, project })))
    : [], [snapshot]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesFilter = (entry: ProjectEntry) => {
    if (!snapshot || filter === "all") return true;
    const { project } = entry;
    const hasAttention = snapshot.tasks.some((task) => task.clientId === entry.client.clientId && task.projectId === project.projectId);
    if (filter === "attention") return hasAttention;
    if (filter === "delivered") return project.deliveredRevision !== null;
    if (filter === "approved") return project.approvedRevision !== null && project.deliveredRevision === null && project.currentRevision === project.approvedRevision;
    return project.deliveredRevision === null && (project.approvedRevision === null || project.currentRevision > project.approvedRevision);
  };
  const filteredEntries = entries.filter((entry) => {
    const searchable = [entry.project.projectName, entry.project.projectId, entry.client.clientName, entry.client.clientId, entry.project.artist];
    return (!normalizedQuery || searchable.some((value) => value.toLocaleLowerCase().includes(normalizedQuery))) && matchesFilter(entry);
  });

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filteredEntries.some((entry) => entryKey(entry) === selectedKey)) {
      setSelectedKey(entryKey(filteredEntries[0]));
    }
  }, [filteredEntries.map(entryKey).join("|"), selectedKey]);

  const selected = entries.find((entry) => entryKey(entry) === selectedKey) ?? null;

  useEffect(() => {
    setEditing(false);
    setForm(null);
    setEditExpectedLastModifiedAt(null);
    setSaveError(null);
    setEditInfo(null);
    setEditInfoError(null);
    if (!selected) return;
    let cancelled = false;
    invoke<ProjectEditInfo>("get_project_edit_info", { clientId: selected.client.clientId, projectId: selected.project.projectId })
      .then((info) => { if (!cancelled) setEditInfo(info); })
      .catch((error: unknown) => {
        if (!cancelled) setEditInfoError(error instanceof Error ? error.message : String(error));
      });
    return () => { cancelled = true; };
  }, [selected?.client.clientId, selected?.project.projectId]);

  if (workspace.status === "loading") return <section className="notice" aria-live="polite">{productCopy.projects.reading}</section>;
  if (workspace.status === "error") return <section className="notice error" role="alert"><strong>{productCopy.projects.loadFailed}</strong><span>{workspace.message}</span></section>;

  const currentSnapshot = workspace.value;
  const editingAvailable = editInfo?.updateSupported === true;
  const editUnavailableHelp = editInfo?.message ?? editInfoError ?? "Checking Automation editing support…";
  const values = editing && form ? form : editInfo ? formFromInfo(editInfo) : null;
  const dirty = Boolean(editing && form && editInfo && !formsEqual(form, formFromInfo(editInfo)));

  const beginEdit = () => {
    if (!editInfo?.updateSupported) return;
    setForm(formFromInfo(editInfo));
    setEditExpectedLastModifiedAt(editInfo.lastModifiedAt);
    setSaveError(null);
    onSaveSuccess(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setForm(null);
    setEditExpectedLastModifiedAt(null);
    setSaveError(null);
  };
  const setValue = <K extends keyof ProjectEditForm>(key: K, value: ProjectEditForm[K]) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
  };
  const toggleDeliverable = (value: string) => {
    if (!form) return;
    setValue("requestedDeliverables", form.requestedDeliverables.includes(value)
      ? form.requestedDeliverables.filter((item) => item !== value)
      : [...form.requestedDeliverables, value]);
  };
  const save = async () => {
    if (!selected || !form || !editInfo || !editExpectedLastModifiedAt) return;
    if (!form.projectName.trim()) { setSaveError("Project Name is required."); return; }
    if (!form.artist.trim()) { setSaveError("Artist is required."); return; }
    if (!form.deliveryMethod.trim()) { setSaveError("Delivery Method is required."); return; }
    if (form.requestedDeliverables.length === 0) { setSaveError("Select at least one requested deliverable."); return; }
    const bpm = form.bpm.trim() ? Number(form.bpm) : null;
    if (bpm !== null && (!Number.isFinite(bpm) || bpm <= 0)) { setSaveError("BPM must be a positive number or blank."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke<ProjectUpdateResult>("update_project", { request: {
        clientId: selected.client.clientId,
        projectId: selected.project.projectId,
        expectedLastModifiedAt: editExpectedLastModifiedAt,
        projectName: form.projectName.trim(),
        artist: form.artist.trim(),
        album: form.album.trim(),
        producer: form.producer.trim(),
        mixEngineer: form.mixEngineer.trim(),
        bpm,
        musicalKey: form.musicalKey.trim(),
        timeSignature: form.timeSignature.trim(),
        sampleRate: form.sampleRate,
        bitDepth: form.bitDepth,
        fileFormat: form.fileFormat,
        deliveryMethod: form.deliveryMethod.trim(),
        requestedDeliverables: form.requestedDeliverables,
        deadline: form.deadline || null,
        creativeDirection: form.creativeDirection.trim(),
      } });
      if (!result.ok) { setSaveError(result.message); return; }
      setEditing(false);
      setForm(null);
      setEditExpectedLastModifiedAt(null);
      onSaveSuccess(result.message);
      onRefresh();
      setEditInfo(await invoke<ProjectEditInfo>("get_project_edit_info", { clientId: selected.client.clientId, projectId: selected.project.projectId }));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const filterOptions: Array<[ProjectFilter, string]> = [
    ["all", "All"], ["attention", "Needs Attention"], ["inProgress", "In Progress"], ["approved", "Approved"], ["delivered", "Delivered"],
  ];

  return <div className="projects-v21-route">
    <section className="directory-toolbar" aria-labelledby="project-directory-heading">
      <div><p className="kicker">{productCopy.clients.studioKicker}</p><h2 id="project-directory-heading">{entries.length} {entries.length === 1 ? productCopy.projects.singular : productCopy.projects.plural}</h2></div>
      <div className="directory-actions"><button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="projects-new-project-help"><ActionIcon name="add" />{productCopy.clients.newProject}</button></div>
    </section>
    <p id="projects-new-project-help" className="action-help directory-help">{projectCreationHelp}</p>

    {(currentSnapshot.status === "unavailable" || currentSnapshot.status === "invalid" || currentSnapshot.status === "empty") && <WorkspaceContent snapshot={currentSnapshot} />}

    {entries.length > 0 && <div className="projects-v21-toolbar">
      <label className="projects-v21-search"><ActionIcon name="search" /><input type="search" aria-label="Search projects" placeholder="Search project, ID, client, or artist" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {query && <button type="button" className="secondary projects-v21-clear" onClick={() => setQuery("")}><ActionIcon name="close" />Clear</button>}
      <div className="projects-v21-filters" aria-label="Project status filter">{filterOptions.map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : "secondary"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    </div>}

    {entries.length > 0 && filteredEntries.length === 0 && <div className="planned-message projects-v21-no-results" role="status"><strong>No projects match the current search and filter.</strong><p>Clear the search or choose a different status filter.</p><button type="button" className="secondary" onClick={() => { setQuery(""); setFilter("all"); }}><ActionIcon name="close" />Clear Search and Filter</button></div>}

    {filteredEntries.length > 0 && <div className="projects-v21-grid">
      <section className="projects-v21-list" aria-label="Project directory">
        <div className="projects-v21-list-head"><span>Name / info</span><span>Current / Approved / Delivered</span><span>Status</span></div>
        {filteredEntries.map((entry) => {
          const active = entryKey(entry) === selectedKey;
          const hasAttention = currentSnapshot.tasks.some((task) => task.clientId === entry.client.clientId && task.projectId === entry.project.projectId);
          const status = projectStatus(entry.project, hasAttention);
          const selectEntry = () => setSelectedKey(entryKey(entry));
          return <div key={entryKey(entry)} className={`projects-v21-row${active ? " selected" : ""}`} data-selected={active ? "true" : "false"} onClick={selectEntry} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectEntry(); } }} tabIndex={0}>
            <span className="projects-v21-row-main"><a href="#project-overview" className="projects-v21-project-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelectProject(entry.client.clientId, entry.project.projectId); }}>{entry.project.projectName}</a><small>{entry.client.clientName} · {entry.project.artist || productCopy.common.notSet}</small><code>{entry.project.projectId}</code></span>
            <span className="projects-v21-cad" aria-label={`Current ${compactRevision(entry.project.currentRevision)}, Approved ${compactRevision(entry.project.approvedRevision)}, Delivered ${compactRevision(entry.project.deliveredRevision)}`}>{compactRevision(entry.project.currentRevision)} / {compactRevision(entry.project.approvedRevision)} / {compactRevision(entry.project.deliveredRevision)}</span>
            <span className={`projects-v21-status projects-v21-status-${status.toLocaleLowerCase().replaceAll(" ", "-")}`}>{status}</span>
          </div>;
        })}
      </section>

      {selected && <aside className="projects-v21-inspector" aria-label="Selected Project Details">
        <div className="projects-v21-inspector-heading"><div><p className="kicker">Selected Project</p><h3>{editInfo?.projectName ?? selected.project.projectName}</h3><p>{selected.client.clientName}</p></div><div className="projects-v21-inspector-actions">{editing ? <><button type="button" className="secondary" onClick={cancelEdit} disabled={saving}><ActionIcon name="close" />Cancel</button><button type="button" onClick={save} disabled={saving || !dirty}><ActionIcon name="save" />{saving ? "Saving…" : "Save Changes"}</button></> : <button type="button" onClick={beginEdit} disabled={!editingAvailable || loading} title={!editingAvailable ? editUnavailableHelp : undefined}><ActionIcon name="edit" />Edit Project</button>}</div></div>

        {!editingAvailable && !editing && <div className="projects-v21-capability" role="status"><strong>Editing unavailable.</strong> {editUnavailableHelp}</div>}
        {saveError && <div className="form-error" role="alert">{saveError}</div>}

        <section className="projects-v21-inspector-section"><h4>Project Identity</h4><div className="projects-v21-fields">
          <label><span>Project Name</span>{editing && values ? <input aria-label="Project Name" value={values.projectName} onChange={(event) => setValue("projectName", event.target.value)} disabled={saving} /> : <strong>{editInfo?.projectName ?? selected.project.projectName}</strong>}</label>
          <label><span>Client</span><strong>{selected.client.clientName}</strong></label>
          <label><span>Artist</span>{editing && values ? <input aria-label="Artist" value={values.artist} onChange={(event) => setValue("artist", event.target.value)} disabled={saving} /> : <strong>{editInfo?.artist ?? selected.project.artist}</strong>}</label>
          <label><span>Album</span>{editing && values ? <input aria-label="Album" value={values.album} onChange={(event) => setValue("album", event.target.value)} disabled={saving} /> : <strong>{editInfo?.album || productCopy.common.notSet}</strong>}</label>
        </div></section>

        <section className="projects-v21-inspector-section"><h4>Project Details</h4><div className="projects-v21-fields">
          <label><span>Producer</span>{editing && values ? <input aria-label="Producer" value={values.producer} onChange={(event) => setValue("producer", event.target.value)} disabled={saving} /> : <strong>{editInfo?.producer || productCopy.common.notSet}</strong>}</label>
          <label><span>Mix Engineer</span>{editing && values ? <input aria-label="Mix Engineer" value={values.mixEngineer} onChange={(event) => setValue("mixEngineer", event.target.value)} disabled={saving} /> : <strong>{editInfo?.mixEngineer || productCopy.common.notSet}</strong>}</label>
          <label><span>BPM</span>{editing && values ? <input aria-label="BPM" inputMode="decimal" value={values.bpm} onChange={(event) => setValue("bpm", event.target.value)} disabled={saving} /> : <strong>{editInfo?.bpm ?? productCopy.common.notSet}</strong>}</label>
          <label><span>Key</span>{editing && values ? <input aria-label="Key" value={values.musicalKey} onChange={(event) => setValue("musicalKey", event.target.value)} disabled={saving} /> : <strong>{editInfo?.musicalKey || productCopy.common.notSet}</strong>}</label>
          <label><span>Time Signature</span>{editing && values ? <input aria-label="Time Signature" value={values.timeSignature} onChange={(event) => setValue("timeSignature", event.target.value)} disabled={saving} /> : <strong>{editInfo?.timeSignature || productCopy.common.notSet}</strong>}</label>
        </div></section>

        <section className="projects-v21-inspector-section"><h4>Audio Requirements</h4><div className="projects-v21-fields compact">
          <label><span>Sample Rate</span>{editing && values ? <select aria-label="Sample Rate" value={values.sampleRate} onChange={(event) => setValue("sampleRate", Number(event.target.value))} disabled={saving}>{[44100, 48000, 88200, 96000, 176400, 192000].map((value) => <option key={value} value={value}>{value.toLocaleString()} Hz</option>)}</select> : <strong>{editInfo ? `${editInfo.sampleRate.toLocaleString()} Hz` : `${selected.project.sampleRate.toLocaleString()} Hz`}</strong>}</label>
          <label><span>Bit Depth</span>{editing && values ? <select aria-label="Bit Depth" value={values.bitDepth} onChange={(event) => setValue("bitDepth", Number(event.target.value))} disabled={saving}>{[16, 24, 32].map((value) => <option key={value} value={value}>{value}-bit</option>)}</select> : <strong>{editInfo ? `${editInfo.bitDepth}-bit` : `${selected.project.bitDepth}-bit`}</strong>}</label>
          <label><span>File Format</span>{editing && values ? <select aria-label="File Format" value={values.fileFormat} onChange={(event) => setValue("fileFormat", event.target.value)} disabled={saving}><option>WAV</option><option>AIFF</option></select> : <strong>{editInfo?.fileFormat ?? selected.project.fileFormat}</strong>}</label>
        </div></section>

        <section className="projects-v21-inspector-section"><h4>Delivery Requirements</h4><div className="projects-v21-fields">
          <label><span>Delivery Method</span>{editing && values ? <input aria-label="Delivery Method" value={values.deliveryMethod} onChange={(event) => setValue("deliveryMethod", event.target.value)} disabled={saving} /> : <strong>{editInfo?.deliveryMethod ?? selected.project.deliveryMethod}</strong>}</label>
          <label><span>Deadline</span>{editing && values ? <input type="date" aria-label="Deadline" value={values.deadline} onChange={(event) => setValue("deadline", event.target.value)} disabled={saving} /> : <strong>{editInfo?.deadline ?? selected.project.deadline ?? productCopy.common.notSet}</strong>}</label>
          <div className="projects-v21-deliverables"><span>Requested Deliverables</span>{editing && values ? <div className="projects-v21-deliverable-options">{DELIVERABLES.map(([value, label]) => <label key={value}><input type="checkbox" checked={values.requestedDeliverables.includes(value)} onChange={() => toggleDeliverable(value)} disabled={saving} /><span>{label}</span></label>)}</div> : editInfo ? <div className="projects-v21-chip-list">{editInfo.requestedDeliverables.map((value) => <span key={value}>{friendlyDeliverable(value)}</span>)}</div> : <strong>Checking…</strong>}</div>
        </div></section>

        <section className="projects-v21-inspector-section"><h4>Creative Direction</h4>{editing && values ? <textarea aria-label="Creative Direction" value={values.creativeDirection} onChange={(event) => setValue("creativeDirection", event.target.value)} disabled={saving} rows={5} /> : <p className="projects-v21-creative">{editInfo?.creativeDirection || productCopy.common.notSet}</p>}</section>

        <section className="projects-v21-inspector-section metadata"><h4>Project Information</h4><dl><div><dt>Project ID</dt><dd><code>{selected.project.projectId}</code></dd></div><div><dt>Path</dt><dd><code>{editInfo?.projectPath ?? "Checking…"}</code></dd></div><div><dt>Created</dt><dd>{editInfo ? formatTimestamp(editInfo.createdAt) : formatTimestamp(selected.project.createdAt)}</dd></div><div><dt>Last Modified</dt><dd>{editInfo ? formatTimestamp(editInfo.lastModifiedAt) : "Checking…"}</dd></div><div><dt>Schema</dt><dd>{editInfo?.schemaVersion ?? selected.project.schemaVersion}</dd></div><div><dt>Document ID</dt><dd><code>{editInfo?.documentId ?? "Checking…"}</code></dd></div></dl></section>

        <button type="button" className="projects-v21-open" onClick={() => onSelectProject(selected.client.clientId, selected.project.projectId)}><ActionIcon name="open" />Open Project</button>
        <p className="projects-v21-forward-note">Project edits update requirements going forward. Existing audio, revisions, approvals, and delivery artifacts are not rewritten automatically.</p>
      </aside>}
    </div>}

    <RouteIssues snapshot={currentSnapshot} />
  </div>;
}
