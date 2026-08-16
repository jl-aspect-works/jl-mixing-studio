import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  ProjectSummary,
} from "../types";
import { FolderControl, safeError, type ResourceState } from "../AppShellViews";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import type {
  DeliveryPackageDeleteRequest,
  DeliveryStatusRequest,
  DeliveryStatusResult,
  ManagedDeliverableStatus,
  ManagedDeliveryPackageStatus,
  ManagedDeliveryStatus,
} from "./statusModels";
import "./DeliveryView.css";

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const formatBytes = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  if (value < 1024) return `${value.toLocaleString()} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[index]}`;
};

const titleCase = (value: string | null | undefined) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";

const fileName = (path: string) => path.split("/").at(-1) ?? path;

const deliverableStatusLabel = (file: ManagedDeliverableStatus) => {
  switch (file.status) {
    case "current": return "Verified";
    case "missing": return "Missing";
    case "mismatch": return "Changed";
    case "unsafe": return "Unsafe";
    case "unavailable": return "Unavailable";
    default: return titleCase(file.status);
  }
};

const packageStatusLabel = (value: string) => {
  switch (value) {
    case "current": return "Current";
    case "stale": return "Rebuild needed";
    case "none": return "Not built";
    case "attention": return "Needs attention";
    default: return titleCase(value);
  }
};

export function DeliveryView({
  clientId,
  project,
  loading,
  actionError,
  creationAvailable,
  creationHelp,
  onCreate,
  onSelectView,
}: {
  clientId: string;
  project: ProjectSummary;
  loading: boolean;
  actionError: string | null;
  creationAvailable: boolean;
  creationHelp: string;
  onProjects: () => void;
  onOverview: () => void;
  onCreate: () => void;
  onRefresh: () => void;
  onSelectView: (view: ProjectShellView) => void;
}) {
  const delivery = project.delivery;
  const deliveryDocumentId = delivery?.documentId;
  const [notes, setNotes] = useState<ResourceState<DeliveryNotesDocument>>({ status: "loading" });
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<ResourceState<ManagedDeliveryStatus>>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus({ status: "loading" });
    setStatusMessage(null);
    const request: DeliveryStatusRequest = { clientId, projectId: project.projectId };
    try {
      const result = await invoke<DeliveryStatusResult>("get_delivery_status", { request });
      if (!result.ok || !result.delivery) {
        setStatus({ status: "error", message: result.message || "Delivery status is not available." });
        return;
      }
      setStatus({ status: "ready", value: result.delivery });
    } catch (error: unknown) {
      setStatus({ status: "error", message: safeError(error, "Delivery status could not be reconciled.") });
    }
  }, [clientId, project.projectId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, deliveryDocumentId, project.approvedRevision, project.deliveredRevision]);

  useEffect(() => {
    if (!deliveryDocumentId) {
      setNotes({ status: "loading" });
      setNotesDraft("");
      return;
    }
    setNotes({ status: "loading" });
    setNotesMessage(null);
    const request: DeliveryNotesRequest = { clientId, projectId: project.projectId };
    void invoke<DeliveryNotesDocument>("get_delivery_notes", { request })
      .then((document) => {
        setNotes({ status: "ready", value: document });
        setNotesDraft(document.content);
      })
      .catch((error: unknown) => setNotes({
        status: "error",
        message: safeError(error, "Delivery Notes could not be read."),
      }));
  }, [clientId, project.projectId, deliveryDocumentId]);

  const saveNotes = () => {
    if (notes.status !== "ready" || notesSaving || notesDraft === notes.value.content) return;
    setNotesSaving(true);
    setNotesMessage(null);
    const request: DeliveryNotesUpdateRequest = {
      clientId,
      projectId: project.projectId,
      content: notesDraft,
    };
    void invoke<DeliveryNotesDocument>("update_delivery_notes", { request })
      .then(async (document) => {
        setNotes({ status: "ready", value: document });
        setNotesDraft(document.content);
        setNotesMessage("Delivery Notes saved.");
        await refreshStatus();
      })
      .catch((error: unknown) => setNotesMessage(safeError(error, "Delivery Notes could not be saved.")))
      .finally(() => setNotesSaving(false));
  };

  const managed = status.status === "ready" ? status.value : null;
  const packages = managed?.packages ?? [];
  const activePackage = managed?.currentPackage ?? packages[0] ?? null;
  const packageNeedsRebuild = managed?.packageState === "stale" || managed?.packageState === "attention";
  const displayFiles = managed?.deliverables ?? [];
  const issueCount = managed?.issues.length ?? 0;
  const totalBytes = useMemo(
    () => displayFiles.reduce((total, file) => total + (file.sizeBytes ?? 0), 0),
    [displayFiles],
  );

  const readiness = (() => {
    if (project.approvedRevision === null) {
      return { tone: "attention", title: "Approval required", detail: "Approve a revision before creating a delivery." };
    }
    if (status.status === "error") {
      return { tone: "attention", title: "Delivery status unavailable", detail: status.message };
    }
    if (!managed || managed.state === "not_created") {
      return { tone: "neutral", title: "Ready for first delivery", detail: `Approved Revision ${project.approvedRevision} is ready to package.` };
    }
    if (managed.state === "needs_attention") {
      return { tone: "attention", title: "Delivery needs attention", detail: `${issueCount} ${issueCount === 1 ? "issue requires" : "issues require"} review before delivery.` };
    }
    if (packageNeedsRebuild) {
      return { tone: "attention", title: "Package rebuild needed", detail: "The managed delivery files are valid, but the generated ZIP is not current." };
    }
    if (managed.packageState === "none") {
      return { tone: "neutral", title: "Delivery files are verified", detail: "Create a ZIP package when the Delivery Notes are final." };
    }
    return { tone: "good", title: "Delivery is current", detail: `Revision ${managed.revisions.source ?? project.deliveredRevision ?? project.approvedRevision} is verified and the generated package is current.` };
  })();

  const deletePackage = async (pkg: ManagedDeliveryPackageStatus) => {
    if (deletingPackage) return;
    if (!window.confirm(`Delete generated package “${pkg.name}”?\n\nThe managed deliverables and Delivery Notes will not be changed.`)) return;
    setDeletingPackage(pkg.name);
    setStatusMessage(null);
    const request: DeliveryPackageDeleteRequest = {
      clientId,
      projectId: project.projectId,
      zipName: pkg.name,
    };
    try {
      const result = await invoke<DeliveryStatusResult>("delete_delivery_package", { request });
      if (!result.ok || !result.delivery) {
        setStatusMessage(result.message || "The generated package could not be deleted.");
        return;
      }
      setStatus({ status: "ready", value: result.delivery });
      setStatusMessage("Generated ZIP deleted. Delivery files were not changed.");
    } catch (error: unknown) {
      setStatusMessage(safeError(error, "The generated package could not be deleted."));
    } finally {
      setDeletingPackage(null);
    }
  };

  return <>
    <ProjectNavigationBar active="delivery" onSelect={onSelectView} />

    <section className="delivery-heading-row" aria-labelledby="delivery-heading">
      <div>
        <p className="kicker">Final delivery</p>
        <h2 id="delivery-heading">Delivery</h2>
        <p className="delivery-heading-copy">Prepare, verify, document, and package the approved mix without leaving Studio.</p>
      </div>
      <div className="delivery-heading-actions">
        <FolderControl location="delivery" clientId={clientId} projectId={project.projectId} label="Open Delivery Folder" />
        <button type="button" onClick={onCreate} disabled={!creationAvailable || loading}>
          {loading ? "Checking…" : delivery ? "Rebuild Delivery" : "Create Delivery"}
        </button>
      </div>
    </section>

    {actionError && <div className="form-error" role="alert">{actionError}</div>}
    <section className={`delivery-readiness delivery-readiness-${readiness.tone}`} role="status">
      <strong>{readiness.title}</strong>
      <span>{readiness.detail}</span>
    </section>
    {!creationAvailable && <p className="action-help">{creationHelp}</p>}

    <section className="delivery-status-grid" aria-label="Delivery status summary">
      <article className="delivery-status-card">
        <span>Source revision</span>
        <strong>{managed?.revisions.source ? `Revision ${managed.revisions.source.toString().padStart(2, "0")}` : delivery ? `Revision ${delivery.revision.toString().padStart(2, "0")}` : "—"}</strong>
      </article>
      <article className="delivery-status-card">
        <span>Deliverables</span>
        <strong>{managed ? managed.deliverableCount : delivery?.files.length ?? "—"}</strong>
        <small>{managed?.state === "ready" ? "Verified" : managed?.state === "needs_attention" ? "Review required" : "Not built"}</small>
      </article>
      <article className="delivery-status-card">
        <span>Package</span>
        <strong>{managed ? packageStatusLabel(managed.packageState) : "Checking…"}</strong>
        <small>{activePackage?.name ?? "No generated ZIP"}</small>
      </article>
      <article className="delivery-status-card">
        <span>Last build</span>
        <strong>{activePackage ? formatTimestamp(activePackage.modifiedAt) : delivery ? formatTimestamp(delivery.createdAt) : "—"}</strong>
        <small>{activePackage ? formatBytes(activePackage.sizeBytes) : ""}</small>
      </article>
    </section>

    {status.status === "loading" && <p className="delivery-status-loading" role="status">Reconciling delivery files and package state…</p>}
    {statusMessage && <p className="delivery-inline-message" role="status">{statusMessage}</p>}

    {managed && managed.issues.length > 0 && <section className="delivery-issues panel" aria-labelledby="delivery-issues-heading">
      <div className="panel-heading"><div><p className="kicker">Verification</p><h2 id="delivery-issues-heading">Needs attention</h2></div><span>{managed.issues.length}</span></div>
      <ul>{managed.issues.map((issue, index) => <li key={`${issue.code}-${issue.path ?? index}`}><strong>{issue.path ? fileName(issue.path) : titleCase(issue.code)}</strong><span>{issue.message}</span></li>)}</ul>
    </section>}

    <section className="delivery-package panel" aria-labelledby="delivery-package-heading">
      <div className="panel-heading">
        <div><p className="kicker">Package</p><h2 id="delivery-package-heading">Generated ZIP</h2></div>
        {activePackage && <span className={`delivery-package-badge delivery-package-${activePackage.status}`}>{packageStatusLabel(activePackage.status)}</span>}
      </div>
      {!activePackage ? <div className="delivery-empty-inline">
        <strong>No generated ZIP</strong>
        <span>Create or rebuild the delivery with ZIP enabled when the deliverables and notes are ready.</span>
      </div> : <div className="delivery-package-row">
        <div>
          <strong>{activePackage.name}</strong>
          <span>{formatBytes(activePackage.sizeBytes)} · {formatTimestamp(activePackage.modifiedAt)}</span>
        </div>
        <div className="delivery-package-actions">
          <button type="button" className="secondary" onClick={() => void deletePackage(activePackage)} disabled={deletingPackage !== null}>
            {deletingPackage === activePackage.name ? "Deleting…" : "Delete ZIP"}
          </button>
          <button type="button" onClick={onCreate} disabled={!creationAvailable || loading}>Rebuild Package</button>
        </div>
      </div>}
      {activePackage?.issues.length ? <ul className="delivery-package-issues">{activePackage.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul> : null}
    </section>

    <section className="panel delivery-notes-panel" aria-labelledby="delivery-notes-heading">
      <div className="panel-heading">
        <div><p className="kicker">Package document</p><h2 id="delivery-notes-heading">Delivery Notes</h2></div>
        {notes.status === "ready" && <span>{new TextEncoder().encode(notesDraft).length.toLocaleString()} / {notes.value.maxBytes.toLocaleString()} bytes</span>}
      </div>
      {!deliveryDocumentId && <div className="delivery-empty-inline"><span>Delivery Notes are created with the first managed delivery.</span></div>}
      {deliveryDocumentId && notes.status === "loading" && <p>Reading <code>Delivery_Notes.md</code>…</p>}
      {notes.status === "error" && <div className="form-error" role="alert">{notes.message}</div>}
      {notes.status === "ready" && <>
        <MarkdownEditor
          ariaLabel="Delivery Notes Markdown content"
          minRows={9}
          disabled={notesSaving}
          value={notesDraft}
          onChange={(value) => {
            setNotesDraft(value);
            setNotesMessage(null);
          }}
        />
        <div className="dialog-actions">
          <button
            type="button"
            onClick={saveNotes}
            disabled={notesSaving || notesDraft === notes.value.content || new TextEncoder().encode(notesDraft).length > notes.value.maxBytes}
            aria-busy={notesSaving}
          >{notesSaving ? "Saving…" : "Save Delivery Notes"}</button>
        </div>
      </>}
      {notesMessage && <p role="status">{notesMessage}</p>}
    </section>

    <section className="panel delivery-files-panel" aria-labelledby="delivery-files-heading">
      <div className="panel-heading">
        <div><p className="kicker">Deliverables</p><h2 id="delivery-files-heading">Delivery Files</h2></div>
        <span>{displayFiles.length} files · {formatBytes(totalBytes)}</span>
      </div>
      {!managed || managed.state === "not_created" ? <div className="delivery-empty-inline"><span>No managed deliverables have been created yet.</span></div> : <div className="table-scroll">
        <table className="delivery-files-table">
          <thead><tr><th>Filename</th><th>Type</th><th>Source</th><th>Size</th><th>Status</th><th>Duration</th></tr></thead>
          <tbody>{displayFiles.map((file) => <tr key={file.path} className={`delivery-file-${file.status}`}>
            <td><strong>{fileName(file.path)}</strong>{file.path.includes("/") && <small>{file.path}</small>}</td>
            <td>{titleCase(file.deliverableType)}</td>
            <td>{managed.revisions.source ? `Rev ${managed.revisions.source.toString().padStart(2, "0")}` : "—"}</td>
            <td>{formatBytes(file.sizeBytes)}</td>
            <td><span className={`delivery-file-status delivery-file-status-${file.status}`}>{deliverableStatusLabel(file)}</span></td>
            <td>—</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>;
}
