import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import { FolderControl, RouteIssues, type ResourceState } from "../AppViews";
import { copy as productCopy } from "../resources/copy";
import { ActionIcon } from "../components/ActionIcon";

interface StudioEditInfo {
  updateSupported: boolean;
  documentId: string;
  lastModifiedAt: string;
  message: string;
}

interface StudioUpdateResult {
  ok: boolean;
  code: "updated" | "conflict" | "invalidInput" | "automationUnavailable" | "unsupportedCapability" | "rejected" | "uncertain" | "failed";
  message: string;
}

interface StudioEditForm {
  studioName: string;
  mixEngineer: string;
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

function friendlyDeliverable(value: string) {
  return DELIVERABLES.find(([key]) => key === value)?.[1] ?? value.replace(/_/g, " ");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formFromStudio(studio: NonNullable<WorkspaceSnapshot["studio"]>): StudioEditForm {
  return {
    studioName: studio.studioName,
    mixEngineer: studio.mixEngineer,
    sampleRate: studio.sampleRate,
    bitDepth: studio.bitDepth,
    fileFormat: studio.fileFormat,
    deliveryMethod: studio.deliveryMethod,
    requestedDeliverables: [...studio.requestedDeliverables],
  };
}

export function StudioRoute({ workspace, version, loading, setupAvailable, setupHelp, onSetup, onRefresh, onSaveSuccess }: {
  workspace: ResourceState<WorkspaceSnapshot>;
  version: ResourceState<VersionCheck>;
  loading: boolean;
  setupAvailable: boolean;
  setupHelp: string;
  onSetup: () => void;
  onRefresh: () => void;
  onSaveSuccess: (message: string) => void;
}) {
  const snapshot = workspace.status === "ready" ? workspace.value : null;
  const studio = snapshot?.studio ?? null;
  const workspacePath = snapshot?.workspacePath ?? null;
  const studioId = studio?.studioId ?? null;
  const [editInfo, setEditInfo] = useState<StudioEditInfo | null>(null);
  const [editInfoError, setEditInfoError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StudioEditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!studioId || !workspacePath) {
      setEditInfo(null);
      setEditInfoError(null);
      return () => { cancelled = true; };
    }
    invoke<StudioEditInfo>("get_studio_edit_info")
      .then((info) => { if (!cancelled) { setEditInfo(info); setEditInfoError(null); } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setEditInfo(null);
          setEditInfoError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => { cancelled = true; };
  }, [studioId, workspacePath]);

  if (workspace.status === "loading") return <section className="state-panel"><h2>{productCopy.studio.readingWorkspace}</h2></section>;
  if (workspace.status === "error") return <section className="state-panel error"><h2>{productCopy.studio.workspaceUnavailable}</h2><p>{workspace.message}</p><button type="button" onClick={onRefresh}><ActionIcon name="retry" />{productCopy.studio.tryAgain}</button></section>;
  if (!snapshot?.studio) {
    const unavailable = snapshot?.status === "unavailable";
    return <section className="planned-route" aria-labelledby="studio-state-heading">
      <div className="planned-banner"><div><span className="status-pill warning">{unavailable ? productCopy.studio.notConfigured : productCopy.studio.recoveryRequired}</span><h2 id="studio-state-heading">{unavailable ? productCopy.studio.createDefaultWorkspace : productCopy.studio.configurationUnreadable}</h2><p>{unavailable ? "Create a new JL Mixing workspace and choose where it should live." : productCopy.studio.checkSetupIssues}</p></div><button type="button" onClick={onSetup} disabled={!setupAvailable || loading} aria-describedby="studio-setup-help"><ActionIcon name="add" />{productCopy.studio.newStudio}</button></div>
      <p id="studio-setup-help" className="action-help">{setupHelp}</p>
      {snapshot && snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
    </section>;
  }

  const currentStudio = snapshot.studio;
  const beginEdit = () => {
    if (!editInfo?.updateSupported) return;
    setForm(formFromStudio(currentStudio));
    setSaveError(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setForm(null);
    setSaveError(null);
  };
  const toggleDeliverable = (value: string) => {
    if (!form) return;
    setForm({ ...form, requestedDeliverables: form.requestedDeliverables.includes(value)
      ? form.requestedDeliverables.filter((item) => item !== value)
      : [...form.requestedDeliverables, value] });
  };
  const save = async () => {
    if (!form || !editInfo) return;
    if (!form.studioName.trim()) { setSaveError("Studio Name is required."); return; }
    if (!form.deliveryMethod.trim()) { setSaveError("Default Delivery Method is required."); return; }
    if (form.requestedDeliverables.length === 0) { setSaveError("Select at least one requested deliverable."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke<StudioUpdateResult>("update_studio", { request: {
        expectedLastModifiedAt: editInfo.lastModifiedAt,
        studioName: form.studioName.trim(),
        mixEngineer: form.mixEngineer.trim(),
        sampleRate: form.sampleRate,
        bitDepth: form.bitDepth,
        fileFormat: form.fileFormat,
        deliveryMethod: form.deliveryMethod.trim(),
        requestedDeliverables: form.requestedDeliverables,
      } });
      if (!result.ok) { setSaveError(result.message); return; }
      setEditing(false);
      setForm(null);
      onSaveSuccess(result.message);
      onRefresh();
      setEditInfo(await invoke<StudioEditInfo>("get_studio_edit_info"));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const values = editing && form ? form : formFromStudio(currentStudio);
  const editingAvailable = editInfo?.updateSupported === true;
  const editUnavailableHelp = editInfo?.message ?? editInfoError ?? "Checking Automation editing support…";

  return <section className="studio-route" aria-labelledby="studio-details-heading">
    <div className="studio-hero">
      <div><p className="kicker">{productCopy.studio.yourStudio}</p><h2 id="studio-details-heading">{currentStudio.studioName}</h2><p className="studio-purpose">Studio identity and defaults used when creating future clients and projects.</p></div>
      <div className="studio-actions">{editing ? <><button type="button" className="secondary" onClick={cancelEdit} disabled={saving}><ActionIcon name="close" />Cancel</button><button type="button" onClick={save} disabled={saving} aria-busy={saving}><ActionIcon name="save" />{saving ? "Saving…" : "Save Changes"}</button></> : <><button type="button" onClick={beginEdit} disabled={!editingAvailable || loading} title={!editingAvailable ? editUnavailableHelp : undefined}><ActionIcon name="edit" />Edit Studio</button><button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{productCopy.common.refresh}</button></>}</div>
    </div>

    {!editingAvailable && !editing && <div className="studio-capability-note" role="status"><strong>Editing unavailable.</strong> {editUnavailableHelp}</div>}
    {saveError && <div className="form-error studio-save-error" role="alert">{saveError}</div>}

    <div className="studio-section-grid">
      <article className="studio-section"><div className="studio-section-heading"><div><h3>Studio Identity</h3><p>Name and default engineer for future work.</p></div></div><div className="studio-fields">
        <div className="studio-field"><span>Studio Name</span>{editing ? <input aria-label="Studio Name" value={values.studioName} onChange={(e) => setForm({...values, studioName:e.target.value})} disabled={saving} /> : <strong>{currentStudio.studioName}</strong>}</div>
        <div className="studio-field"><span>Default Mix Engineer</span>{editing ? <input aria-label="Default Mix Engineer" value={values.mixEngineer} onChange={(e) => setForm({...values, mixEngineer:e.target.value})} disabled={saving} placeholder="Not set" /> : <strong>{currentStudio.mixEngineer || productCopy.common.notSet}</strong>}</div>
      </div></article>

      <article className="studio-section"><div className="studio-section-heading"><div><h3>Audio Defaults</h3><p>Technical targets inherited by future work.</p></div></div><div className="studio-fields studio-fields-three">
        <div className="studio-field"><span>Sample Rate</span>{editing ? <select aria-label="Sample Rate" value={values.sampleRate} onChange={(e) => setForm({...values, sampleRate:Number(e.target.value)})} disabled={saving}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select> : <strong>{currentStudio.sampleRate.toLocaleString()} Hz</strong>}</div>
        <div className="studio-field"><span>Bit Depth</span>{editing ? <select aria-label="Bit Depth" value={values.bitDepth} onChange={(e) => setForm({...values, bitDepth:Number(e.target.value)})} disabled={saving}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select> : <strong>{currentStudio.bitDepth}-bit</strong>}</div>
        <div className="studio-field"><span>File Format</span>{editing ? <select aria-label="File Format" value={values.fileFormat} onChange={(e) => setForm({...values, fileFormat:e.target.value})} disabled={saving}><option>WAV</option><option>AIFF</option></select> : <strong>{currentStudio.fileFormat}</strong>}</div>
      </div></article>

      <article className="studio-section studio-section-wide"><div className="studio-section-heading"><div><h3>Delivery Defaults</h3><p>Default handoff method and deliverables for future work.</p></div></div><div className="studio-fields">
        <div className="studio-field"><span>Delivery Method</span>{editing ? <input aria-label="Delivery Method" value={values.deliveryMethod} onChange={(e) => setForm({...values, deliveryMethod:e.target.value})} disabled={saving} /> : <strong>{currentStudio.deliveryMethod}</strong>}</div>
        <div className="studio-field studio-deliverables-field"><span>Requested Deliverables</span>{editing ? <div className="studio-deliverable-options">{DELIVERABLES.map(([value,label])=><label key={value}><input type="checkbox" checked={values.requestedDeliverables.includes(value)} onChange={() => toggleDeliverable(value)} disabled={saving}/><span>{label}</span></label>)}</div> : <div className="studio-chip-list">{currentStudio.requestedDeliverables.map((value)=><span key={value} className="studio-chip">{friendlyDeliverable(value)}</span>)}</div>}</div>
      </div></article>

      <article className="studio-section studio-section-wide studio-information"><div className="studio-section-heading"><div><h3>Studio Information</h3><p>Workspace location and immutable Studio metadata. These values are read-only.</p></div></div>
        <dl className="studio-info-grid">
          <div><dt>Studio ID</dt><dd><code>{currentStudio.studioId}</code></dd></div>
          <div><dt>Workspace</dt><dd><code>{snapshot.workspacePath}</code></dd></div>
          <div><dt>Created</dt><dd>{formatTimestamp(currentStudio.createdAt)}</dd></div>
          <div><dt>Last Modified</dt><dd>{editInfo ? formatTimestamp(editInfo.lastModifiedAt) : "Checking…"}</dd></div>
          <div><dt>Schema</dt><dd>{currentStudio.schemaVersion}</dd></div>
          <div><dt>Document ID</dt><dd><code>{editInfo?.documentId ?? "Checking…"}</code></dd></div>
          <div><dt>Created With</dt><dd>{currentStudio.createdWith}</dd></div>
          <div><dt>Automation</dt><dd>{version.status === "ready" ? version.value.message : productCopy.studio.checkUnavailable}</dd></div>
          <div><dt>CLI Auto-directory Change</dt><dd>{currentStudio.changeDirectoryAfterCreate ? "Enabled" : "Disabled"}</dd></div>
        </dl><FolderControl location="workspace" label={productCopy.studio.openWorkspace} />
      </article>
    </div>

    <p className="studio-inheritance-note">Changes to Studio defaults apply to future work only. Existing clients and projects are not rewritten.</p>
    {snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
  </section>;
}
