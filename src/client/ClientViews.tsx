import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClientSummary, WorkspaceSnapshot } from "../types";
import {
  FolderControl,
  RouteIssues,
  WorkspaceContent,
  type ResourceState,
} from "../AppShellViews";
import { ActionIcon } from "../components/ActionIcon";
import { copy as productCopy } from "../resources/copy";
import "./ClientViews.css";

interface ClientEditInfo {
  updateSupported: boolean;
  clientId: string;
  clientPath: string;
  documentId: string;
  schemaVersion: string;
  createdWith: string;
  createdAt: string;
  lastModifiedAt: string;
  clientName: string;
  artist: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  deliveryMethod: string;
  requestedDeliverables: string[];
  message: string;
}

interface ClientUpdateResult {
  ok: boolean;
  code:
    | "updated"
    | "conflict"
    | "invalidInput"
    | "clientUnavailable"
    | "automationUnavailable"
    | "unsupportedCapability"
    | "rejected"
    | "uncertain"
    | "failed";
  message: string;
}

interface ClientEditForm {
  clientName: string;
  artist: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  deliveryMethod: string;
  requestedDeliverables: string[];
}

const DELIVERABLES = [
  ["main_mix", "Main Mix"],
  ["instrumental", "Instrumental"],
  ["acapella", "Acapella"],
  ["tv_mix", "TV Mix"],
  ["performance_mix", "Performance Mix"],
  ["stems", "Stems"],
  ["master", "Master"],
] as const;

const revisionLabel = (revision: number | null) =>
  revision === null ? productCopy.common.notSet : `${productCopy.projects.revisionPrefix} ${revision}`;

const friendlyDeliverable = (value: string) =>
  DELIVERABLES.find(([key]) => key === value)?.[1] ?? value.replace(/_/g, " ");

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formFromInfo = (info: ClientEditInfo): ClientEditForm => ({
  clientName: info.clientName,
  artist: info.artist,
  sampleRate: info.sampleRate,
  bitDepth: info.bitDepth,
  fileFormat: info.fileFormat,
  deliveryMethod: info.deliveryMethod,
  requestedDeliverables: [...info.requestedDeliverables],
});

const formsEqual = (left: ClientEditForm, right: ClientEditForm) =>
  left.clientName === right.clientName
  && left.artist === right.artist
  && left.sampleRate === right.sampleRate
  && left.bitDepth === right.bitDepth
  && left.fileFormat === right.fileFormat
  && left.deliveryMethod === right.deliveryMethod
  && left.requestedDeliverables.length === right.requestedDeliverables.length
  && left.requestedDeliverables.every((value, index) => value === right.requestedDeliverables[index]);

export function ClientsRoute({
  workspace,
  onSelectClient,
  onNewClient,
  onRefresh,
  loading,
  clientCreationAvailable,
  clientCreationHelp,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  onSelectClient: (clientId: string) => void;
  onNewClient: () => void;
  onRefresh: () => void;
  loading: boolean;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
}) {
  const [query, setQuery] = useState("");
  if (workspace.status === "loading") return <section className="notice" aria-live="polite">{productCopy.clients.reading}</section>;
  if (workspace.status === "error") return <section className="notice error" role="alert"><strong>{productCopy.clients.loadFailed}</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredClients = normalizedQuery
    ? snapshot.clients.filter((client) => client.clientName.toLocaleLowerCase().includes(normalizedQuery) || client.clientId.toLocaleLowerCase().includes(normalizedQuery))
    : snapshot.clients;

  return (
    <>
      <section className="directory-toolbar" aria-labelledby="client-directory-heading">
        <div><p className="kicker">{productCopy.clients.studioKicker}</p><h2 id="client-directory-heading">{snapshot.counts.clients} {snapshot.counts.clients === 1 ? productCopy.clients.singular : productCopy.clients.plural}</h2></div>
        <div className="directory-actions"><button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button><button type="button" onClick={onNewClient} disabled={!clientCreationAvailable} aria-describedby="clients-new-client-help"><ActionIcon name="add" />{productCopy.clients.newClient}</button></div>
      </section>
      <p id="clients-new-client-help" className="action-help directory-help">{clientCreationHelp}</p>

      {snapshot.clients.length > 0 && <div className="client-search-row" role="search">
        <label className="client-search-box">
          <ActionIcon name="search" />
          <input type="search" aria-label="Search clients" placeholder="Search by client name or ID" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {query && <button type="button" className="secondary client-search-clear" onClick={() => setQuery("")}><ActionIcon name="close" />Clear</button>}
      </div>}

      {(snapshot.status === "unavailable" || snapshot.status === "invalid" || snapshot.status === "empty") && (
        <WorkspaceContent snapshot={snapshot} />
      )}
      {snapshot.clients.length > 0 && filteredClients.length === 0 && (
        <div className="planned-message client-no-results" role="status"><strong>No clients match “{query.trim()}”</strong><p>Try a different client name or ID, or clear the search to show the full client directory.</p><button type="button" className="secondary" onClick={() => setQuery("")}><ActionIcon name="close" />Clear Search</button></div>
      )}
      {filteredClients.length > 0 && (
        <div className="table-scroll directory-table">
          <table>
            <thead><tr><th scope="col">{productCopy.clients.tableClient}</th><th scope="col">{productCopy.clients.tableClientId}</th><th scope="col">{productCopy.clients.tableDefaultArtist}</th><th scope="col">{productCopy.clients.tableProjects}</th></tr></thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.clientId}>
                  <td><button type="button" className="table-link" onClick={() => onSelectClient(client.clientId)}>{client.clientName}</button></td>
                  <td><code>{client.clientId}</code></td>
                  <td>{client.defaultArtist || productCopy.common.notSet}</td>
                  <td>{client.projects.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RouteIssues snapshot={snapshot} />
    </>
  );
}

export function ClientDetails({
  client,
  onBack,
  onSelectProject,
  onNewProject,
  onRefresh,
  onSaveSuccess,
  loading,
  projectCreationAvailable,
  projectCreationHelp,
}: {
  client: ClientSummary;
  onBack: () => void;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  onSaveSuccess: (message: string | null) => void;
  loading: boolean;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
}) {
  const [editInfo, setEditInfo] = useState<ClientEditInfo | null>(null);
  const [editInfoError, setEditInfoError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClientEditForm | null>(null);
  const [editExpectedLastModifiedAt, setEditExpectedLastModifiedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEditInfoError(null);
    invoke<ClientEditInfo>("get_client_edit_info", { clientId: client.clientId })
      .then((info) => {
        if (!cancelled) setEditInfo(info);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setEditInfo(null);
          setEditInfoError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => { cancelled = true; };
  }, [client]);

  const editingAvailable = editInfo?.updateSupported === true;
  const editUnavailableHelp = editInfo?.message ?? editInfoError ?? "Checking Automation editing support…";
  const viewValues = editInfo ? formFromInfo(editInfo) : {
    clientName: client.clientName,
    artist: client.defaultArtist,
    sampleRate: 0,
    bitDepth: 0,
    fileFormat: "",
    deliveryMethod: "",
    requestedDeliverables: [],
  };
  const values = editing && form ? form : viewValues;
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
  const toggleDeliverable = (value: string) => {
    if (!form) return;
    const requestedDeliverables = form.requestedDeliverables.includes(value)
      ? form.requestedDeliverables.filter((item) => item !== value)
      : [...form.requestedDeliverables, value];
    setForm({ ...form, requestedDeliverables });
  };
  const save = async () => {
    if (!form || !editInfo || !editExpectedLastModifiedAt) return;
    if (!form.clientName.trim()) { setSaveError("Client Name is required."); return; }
    if (!form.deliveryMethod.trim()) { setSaveError("Default Delivery Method is required."); return; }
    if (form.requestedDeliverables.length === 0) { setSaveError("Select at least one requested deliverable."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke<ClientUpdateResult>("update_client", { request: {
        clientId: client.clientId,
        expectedLastModifiedAt: editExpectedLastModifiedAt,
        clientName: form.clientName.trim(),
        artist: form.artist.trim(),
        sampleRate: form.sampleRate,
        bitDepth: form.bitDepth,
        fileFormat: form.fileFormat,
        deliveryMethod: form.deliveryMethod.trim(),
        requestedDeliverables: form.requestedDeliverables,
      } });
      if (!result.ok) { setSaveError(result.message); return; }
      setEditing(false);
      setForm(null);
      setEditExpectedLastModifiedAt(null);
      onSaveSuccess("Client settings were updated and verified.");
      onRefresh();
      setEditInfo(await invoke<ClientEditInfo>("get_client_edit_info", { clientId: client.clientId }));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return <div className="client-route">
    <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}>
      <button type="button" onClick={onBack}><ActionIcon name="back" />Clients</button><span aria-hidden="true">/</span><span aria-current="page">{client.clientName}</span>
    </nav></div>

    <section className="client-hero" aria-labelledby="client-details-heading">
      <div><p className="kicker">Client</p><h2 id="client-details-heading">{editInfo?.clientName ?? client.clientName}</h2><p className="client-purpose">Client identity and defaults used when creating future projects.</p></div>
      <div className="client-actions">{editing ? <><button type="button" className="secondary" onClick={cancelEdit} disabled={saving}><ActionIcon name="close" />Cancel</button><button type="button" onClick={save} disabled={saving || !dirty} aria-busy={saving}><ActionIcon name="save" />{saving ? "Saving…" : "Save Changes"}</button></> : <><button type="button" onClick={beginEdit} disabled={!editingAvailable || loading} title={!editingAvailable ? editUnavailableHelp : undefined}><ActionIcon name="edit" />Edit Client</button><button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></>}</div>
    </section>

    {!editingAvailable && !editing && <div className="client-capability-note" role="status"><strong>Editing unavailable.</strong> {editUnavailableHelp}</div>}
    {saveError && <div className="form-error client-save-error" role="alert">{saveError}</div>}

    <div className="client-section-grid">
      <article className="client-section"><div className="client-section-heading"><div><h3>Client Identity</h3><p>Stable identity plus display defaults for future projects.</p></div></div><div className="client-fields">
        <div className="client-field"><span>Client Name</span>{editing ? <input aria-label="Client Name" value={values.clientName} onChange={(event) => setForm({ ...values, clientName: event.target.value })} disabled={saving} /> : <strong>{editInfo?.clientName ?? client.clientName}</strong>}</div>
        <div className="client-field"><span>Client ID</span><strong><code>{client.clientId}</code></strong></div>
        <div className="client-field client-deliverables-field"><span>Default Artist</span>{editing ? <input aria-label="Default Artist" value={values.artist} onChange={(event) => setForm({ ...values, artist: event.target.value })} disabled={saving} placeholder="Not set" /> : <strong>{editInfo?.artist || client.defaultArtist || productCopy.common.notSet}</strong>}</div>
      </div></article>

      <article className="client-section"><div className="client-section-heading"><div><h3>Project Defaults</h3><p>Technical targets inherited by future projects.</p></div></div><div className="client-fields client-fields-three">
        <div className="client-field"><span>Sample Rate</span>{editing ? <select aria-label="Default Sample Rate" value={values.sampleRate} onChange={(event) => setForm({ ...values, sampleRate: Number(event.target.value) })} disabled={saving}>{[44100, 48000, 88200, 96000, 176400, 192000].map((value) => <option key={value} value={value}>{value.toLocaleString()} Hz</option>)}</select> : <strong>{editInfo ? `${editInfo.sampleRate.toLocaleString()} Hz` : "Checking…"}</strong>}</div>
        <div className="client-field"><span>Bit Depth</span>{editing ? <select aria-label="Default Bit Depth" value={values.bitDepth} onChange={(event) => setForm({ ...values, bitDepth: Number(event.target.value) })} disabled={saving}>{[16, 24, 32].map((value) => <option key={value} value={value}>{value}-bit</option>)}</select> : <strong>{editInfo ? `${editInfo.bitDepth}-bit` : "Checking…"}</strong>}</div>
        <div className="client-field"><span>File Format</span>{editing ? <select aria-label="Default File Format" value={values.fileFormat} onChange={(event) => setForm({ ...values, fileFormat: event.target.value })} disabled={saving}><option>WAV</option><option>AIFF</option></select> : <strong>{editInfo?.fileFormat ?? "Checking…"}</strong>}</div>
      </div></article>

      <article className="client-section client-section-wide"><div className="client-section-heading"><div><h3>Delivery Defaults</h3><p>Default handoff method and deliverables inherited by future projects.</p></div></div><div className="client-fields">
        <div className="client-field"><span>Delivery Method</span>{editing ? <input aria-label="Default Delivery Method" value={values.deliveryMethod} onChange={(event) => setForm({ ...values, deliveryMethod: event.target.value })} disabled={saving} /> : <strong>{editInfo?.deliveryMethod ?? "Checking…"}</strong>}</div>
        <div className="client-field client-deliverables-field"><span>Requested Deliverables</span>{editing ? <div className="client-deliverable-options">{DELIVERABLES.map(([value, label]) => <label key={value}><input type="checkbox" checked={values.requestedDeliverables.includes(value)} onChange={() => toggleDeliverable(value)} disabled={saving} /><span>{label}</span></label>)}</div> : editInfo ? <div className="client-chip-list">{editInfo.requestedDeliverables.map((value) => <span key={value} className="client-chip">{friendlyDeliverable(value)}</span>)}</div> : <strong>Checking…</strong>}</div>
      </div></article>

      <section className="client-section client-section-wide" aria-labelledby="client-projects-heading">
        <div className="client-section-heading"><div><p className="kicker">{productCopy.clients.projectsKicker}</p><h3 id="client-projects-heading">Projects</h3><p>{client.projects.length} {client.projects.length === 1 ? "project" : "projects"} for {editInfo?.clientName ?? client.clientName}.</p></div><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="client-new-project-help"><ActionIcon name="add" />{productCopy.clients.newProject}</button></div>
        <p id="client-new-project-help" className="action-help">{projectCreationHelp}</p>
        {client.projects.length === 0 ? (
          <div className="planned-message compact"><strong>{productCopy.clients.noProjects}</strong><p>{productCopy.clients.createFirstProject}</p></div>
        ) : (
          <div className="table-scroll client-projects-table">
            <table>
              <thead><tr><th scope="col">Project</th><th scope="col">Artist</th><th scope="col">Current</th><th scope="col">Approved</th><th scope="col">Delivered</th></tr></thead>
              <tbody>{client.projects.map((project) => (
                <tr key={project.projectId}>
                  <td><button type="button" className="table-link" onClick={() => onSelectProject(project.projectId)}>{project.projectName}</button></td>
                  <td>{project.artist}</td><td>{revisionLabel(project.currentRevision)}</td><td>{revisionLabel(project.approvedRevision)}</td><td>{revisionLabel(project.deliveredRevision)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <article className="client-section client-section-wide"><div className="client-section-heading"><div><h3>Client Information</h3><p>Stable storage identity and low-noise authoritative metadata. These values are read-only.</p></div></div>
        <dl className="client-info-grid">
          <div><dt>Client ID</dt><dd><code>{client.clientId}</code></dd></div>
          <div><dt>Storage Path</dt><dd><code>{editInfo?.clientPath ?? "Checking…"}</code></dd></div>
          <div><dt>Created</dt><dd>{editInfo ? formatTimestamp(editInfo.createdAt) : formatTimestamp(client.createdAt)}</dd></div>
          <div><dt>Last Modified</dt><dd>{editInfo ? formatTimestamp(editInfo.lastModifiedAt) : "Checking…"}</dd></div>
          <div><dt>Schema</dt><dd>{editInfo?.schemaVersion ?? "Checking…"}</dd></div>
          <div><dt>Document ID</dt><dd><code>{editInfo?.documentId ?? "Checking…"}</code></dd></div>
          <div><dt>Created With</dt><dd>{editInfo?.createdWith ?? "Checking…"}</dd></div>
        </dl>
        <FolderControl location="client" clientId={client.clientId} label="Open Client Folder" />
      </article>
    </div>

    <p className="client-inheritance-note">Changes to Client defaults apply to future projects only. Existing projects, revisions, and deliveries are not rewritten.</p>
  </div>;
}
