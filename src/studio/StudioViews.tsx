import { useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import { FolderControl, RouteIssues, type ResourceState } from "../AppViews";
import { copy as productCopy } from "../resources/copy";
import type { StudioFormValues, StudioWorkflowState } from "../AppWorkflowModels";
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
  return DELIVERABLES.find(([key]) => key === value)?.[1] ?? value.replaceAll("_", " ");
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
  const [editInfo, setEditInfo] = useState<StudioEditInfo | null>(null);
  const [editInfoError, setEditInfoError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preparingEdit, setPreparingEdit] = useState(false);
  const [form, setForm] = useState<StudioEditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    setForm(formFromStudio(currentStudio));
    setSaveError(null);
    setEditInfoError(null);
    setEditInfo(null);
    setEditing(true);
    setPreparingEdit(true);
    void invoke<StudioEditInfo>("get_studio_edit_info")
      .then((info) => {
        setEditInfo(info);
        setEditInfoError(null);
      })
      .catch((error: unknown) => {
        setEditInfo(null);
        setEditInfoError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setPreparingEdit(false));
  };
  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setForm(null);
    setSaveError(null);
    setEditInfoError(null);
    setPreparingEdit(false);
  };
  const toggleDeliverable = (value: string) => {
    if (!form) return;
    setForm({
      ...form,
      requestedDeliverables: form.requestedDeliverables.includes(value)
        ? form.requestedDeliverables.filter((item) => item !== value)
        : [...form.requestedDeliverables, value],
    });
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
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      setEditing(false);
      setForm(null);
      onSaveSuccess(result.message);
      onRefresh();
      const refreshedInfo = await invoke<StudioEditInfo>("get_studio_edit_info");
      setEditInfo(refreshedInfo);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const values = editing && form ? form : formFromStudio(currentStudio);
  const saveUnavailableHelp = editInfoError ?? (preparingEdit ? "Reading Studio conflict metadata…" : null);

  return <section className="studio-route" aria-labelledby="studio-details-heading">
    <div className="studio-hero">
      <div>
        <p className="kicker">{productCopy.studio.yourStudio}</p>
        <h2 id="studio-details-heading">{currentStudio.studioName}</h2>
        <p className="studio-purpose">Studio identity and defaults used when creating future clients and projects.</p>
      </div>
      <div className="studio-actions">
        {editing ? <>
          <button type="button" className="secondary" onClick={cancelEdit} disabled={saving}><ActionIcon name="close" />Cancel</button>
          <button type="button" onClick={save} disabled={saving || preparingEdit || !editInfo} aria-busy={saving || preparingEdit}><ActionIcon name="save" />{saving ? "Saving…" : preparingEdit ? "Preparing…" : "Save Changes"}</button>
        </> : <>
          <button type="button" onClick={beginEdit}><ActionIcon name="edit" />Edit Studio</button>
          <button type="button" className="secondary" onClick={onRefresh} disabled={loading}><ActionIcon name="refresh" />{productCopy.common.refresh}</button>
        </>}
      </div>
    </div>

    {editing && saveUnavailableHelp && <div className="studio-capability-note" role="status"><strong>{editInfoError ? "Save unavailable." : "Preparing edit."}</strong> {saveUnavailableHelp}</div>}
    {saveError && <div className="form-error studio-save-error" role="alert">{saveError}</div>}

    <div className="studio-section-grid">
      <article className="studio-section">
        <div className="studio-section-heading"><div><h3>Studio Identity</h3><p>Name and default engineer for future work.</p></div></div>
        <div className="studio-fields">
          <div className="studio-field"><span>Studio Name</span>{editing ? <input value={values.studioName} onChange={(e) => setForm({...values, studioName:e.target.value})} disabled={saving} /> : <strong>{currentStudio.studioName}</strong>}</div>
          <div className="studio-field"><span>Default Mix Engineer</span>{editing ? <input value={values.mixEngineer} onChange={(e) => setForm({...values, mixEngineer:e.target.value})} disabled={saving} placeholder="Not set" /> : <strong>{currentStudio.mixEngineer || productCopy.common.notSet}</strong>}</div>
        </div>
      </article>

      <article className="studio-section">
        <div className="studio-section-heading"><div><h3>Audio Defaults</h3><p>Technical targets inherited by future work.</p></div></div>
        <div className="studio-fields studio-fields-three">
          <div className="studio-field"><span>Sample Rate</span>{editing ? <select value={values.sampleRate} onChange={(e) => setForm({...values, sampleRate:Number(e.target.value)})} disabled={saving}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select> : <strong>{currentStudio.sampleRate.toLocaleString()} Hz</strong>}</div>
          <div className="studio-field"><span>Bit Depth</span>{editing ? <select value={values.bitDepth} onChange={(e) => setForm({...values, bitDepth:Number(e.target.value)})} disabled={saving}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select> : <strong>{currentStudio.bitDepth}-bit</strong>}</div>
          <div className="studio-field"><span>File Format</span>{editing ? <select value={values.fileFormat} onChange={(e) => setForm({...values, fileFormat:e.target.value})} disabled={saving}><option>WAV</option><option>AIFF</option></select> : <strong>{currentStudio.fileFormat}</strong>}</div>
        </div>
      </article>

      <article className="studio-section studio-section-wide">
        <div className="studio-section-heading"><div><h3>Delivery Defaults</h3><p>Default handoff method and deliverables for future work.</p></div></div>
        <div className="studio-fields">
          <div className="studio-field"><span>Delivery Method</span>{editing ? <input value={values.deliveryMethod} onChange={(e) => setForm({...values, deliveryMethod:e.target.value})} disabled={saving} /> : <strong>{currentStudio.deliveryMethod}</strong>}</div>
          <div className="studio-field studio-deliverables-field"><span>Requested Deliverables</span>{editing ? <div className="studio-deliverable-options">{DELIVERABLES.map(([value,label])=><label key={value}><input type="checkbox" checked={values.requestedDeliverables.includes(value)} onChange={() => toggleDeliverable(value)} disabled={saving}/><span>{label}</span></label>)}</div> : <div className="studio-chip-list">{currentStudio.requestedDeliverables.map((value)=><span key={value} className="studio-chip">{friendlyDeliverable(value)}</span>)}</div>}</div>
        </div>
      </article>

      <article className="studio-section studio-section-wide studio-information">
        <div className="studio-section-heading"><div><h3>Studio Information</h3><p>Workspace location and immutable Studio metadata. Conflict metadata is read when editing begins.</p></div></div>
        <dl className="studio-info-grid">
          <div><dt>Studio ID</dt><dd><code>{currentStudio.studioId}</code></dd></div>
          <div><dt>Workspace</dt><dd><code>{snapshot.workspacePath}</code></dd></div>
          <div><dt>Created</dt><dd>{formatTimestamp(currentStudio.createdAt)}</dd></div>
          <div><dt>Last Modified</dt><dd>{editInfo ? formatTimestamp(editInfo.lastModifiedAt) : editing && preparingEdit ? "Checking…" : "Read when editing"}</dd></div>
          <div><dt>Schema</dt><dd>{currentStudio.schemaVersion}</dd></div>
          <div><dt>Document ID</dt><dd><code>{editInfo?.documentId ?? (editing && preparingEdit ? "Checking…" : "Read when editing")}</code></dd></div>
          <div><dt>Created With</dt><dd>{currentStudio.createdWith}</dd></div>
          <div><dt>Automation</dt><dd>{version.status === "ready" ? version.value.message : productCopy.studio.checkUnavailable}</dd></div>
          <div><dt>CLI Auto-directory Change</dt><dd>{currentStudio.changeDirectoryAfterCreate ? "Enabled" : "Disabled"}</dd></div>
        </dl>
        <FolderControl location="workspace" label={productCopy.studio.openWorkspace} />
      </article>
    </div>

    <p className="studio-inheritance-note">Changes to Studio defaults apply to future work only. Existing clients and projects are not rewritten.</p>
    {snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
  </section>;
}

export function StudioDialog({ state, values, onChange, onChooseLocation, onCreate, onClose }: {
  state: Exclude<StudioWorkflowState, { status: "closed" }>;
  values: StudioFormValues;
  onChange: (values: StudioFormValues) => void;
  onChooseLocation: () => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const pending = state.status === "preflighting" || state.status === "creating";
  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}><section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-dialog-title"><p className="kicker">{productCopy.studio.guidedSetup}</p><h2 id="studio-dialog-title">{state.status === "uncertain" ? productCopy.studio.creationVerification : "Create new workspace"}</h2>
    {(state.status === "editing" || state.status === "preflighting" || state.status === "creating") && <form onSubmit={onCreate} noValidate><p className="dialog-intro">Choose a location and enter the studio details. Studio will create a <code>Mixes</code> workspace there and make it active automatically.</p>{state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}<div className="field"><span>Workspace location</span><div className="folder-control"><code>{values.workspaceRoot || "No location selected"}</code><div className="directory-actions"><button type="button" className="secondary" onClick={onChooseLocation} disabled={pending}><ActionIcon name="folder" />Choose Location…</button></div></div></div><label>{productCopy.studio.studioName}<input aria-label={productCopy.studio.studioName} value={values.studioName} onChange={(e) => onChange({...values, studioName:e.target.value})} required disabled={pending}/></label><label>{productCopy.studio.mixEngineer} <span>{productCopy.studio.optional}</span><input aria-label={productCopy.studio.mixEngineer} value={values.mixEngineer} onChange={(e) => onChange({...values, mixEngineer:e.target.value})} disabled={pending}/></label><label>{productCopy.studio.sampleRate}<select aria-label={productCopy.studio.sampleRate} value={values.sampleRate} onChange={(e) => onChange({...values, sampleRate:e.target.value})} disabled={pending}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select></label><label>{productCopy.studio.bitDepth}<select aria-label={productCopy.studio.bitDepth} value={values.bitDepth} onChange={(e) => onChange({...values, bitDepth:e.target.value})} disabled={pending}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select></label><label>{productCopy.studio.fileFormat}<select aria-label={productCopy.studio.fileFormat} value={values.fileFormat} onChange={(e) => onChange({...values, fileFormat:e.target.value})} disabled={pending}><option>WAV</option><option>AIFF</option></select></label><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}><ActionIcon name="close" />{productCopy.common.cancel}</button><button type="submit" disabled={pending || !values.workspaceRoot.trim()} aria-busy={pending}><ActionIcon name="add" />{state.status === "preflighting" ? "Checking…" : state.status === "creating" ? "Creating…" : "Create Workspace"}</button></div></form>}
    {state.status === "uncertain" && <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">{productCopy.studio.uncertainHelp}</p><div className="dialog-actions"><button type="button" onClick={onClose}><ActionIcon name="close" />{productCopy.common.close}</button></div></div>}
  </section></div>;
}
