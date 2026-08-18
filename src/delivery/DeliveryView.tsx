import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  ProjectSummary,
} from "../types";
import { safeError, type ResourceState } from "../AppShellViews";
import { addWorkspaceRefreshListener } from "../app/workspaceRefreshEvents";
import { ActionIcon } from "../components/ActionIcon";
import { MarkdownDocumentEditor } from "../components/MarkdownDocumentEditor";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { DeliveryFilesList } from "./DeliveryFilesList";
import type {
  DeliveryStatusRequest,
  DeliveryStatusResult,
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

const fileName = (path: string) => {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
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

  useEffect(() => addWorkspaceRefreshListener(() => {
    void refreshStatus();
    if (!deliveryDocumentId || notesSaving) return;
    if (notes.status === "ready" && notesDraft !== notes.value.content) return;

    const request: DeliveryNotesRequest = { clientId, projectId: project.projectId };
    void invoke<DeliveryNotesDocument>("get_delivery_notes", { request })
      .then((document) => {
        setNotes({ status: "ready", value: document });
        setNotesDraft(document.content);
        setNotesMessage(null);
      })
      .catch((error: unknown) => {
        setNotesMessage(safeError(error, "Delivery Notes could not be refreshed."));
      });
  }), [clientId, project.projectId, deliveryDocumentId, notes, notesDraft, notesSaving, refreshStatus]);

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

  const openDeliveryFolder = async () => {
    setStatusMessage(null);
    try {
      await invoke("open_folder", {
        request: { location: "delivery", clientId, projectId: project.projectId },
      });
    } catch (error: unknown) {
      setStatusMessage(safeError(error, "The Final Delivery folder could not be opened."));
    }
  };

  return <>
    <ProjectNavigationBar active="delivery" onSelect={onSelectView} />

    <section className="panel delivery-summary-panel" aria-labelledby="delivery-heading">
      <div className="delivery-heading-row">
        <div>
          <p className="kicker">Final delivery</p>
          <h2 id="delivery-heading">Delivery</h2>
          <p className="delivery-heading-copy">Prepare, verify, document and package the approved mix.</p>
        </div>
        {!delivery && <div className="delivery-heading-actions">
          <button type="button" onClick={onCreate} disabled={!creationAvailable || loading}>
            <ActionIcon name="add" />{loading ? "Checking…" : "Create Delivery"}
          </button>
        </div>}
      </div>

      {actionError && <div className="form-error" role="alert">{actionError}</div>}
      <div className="delivery-summary-grid">
        <div className={`delivery-readiness delivery-readiness-${readiness.tone}`} role="status">
          <strong>{readiness.title}</strong>
          <span>{readiness.detail}</span>
        </div>
        <dl className="delivery-details-grid" aria-label="Delivery status summary">
          <div>
            <dt>Source Revision</dt>
            <dd>{managed?.revisions.source ? `Revision ${managed.revisions.source.toString().padStart(2, "0")}` : delivery ? `Revision ${delivery.revision.toString().padStart(2, "0")}` : "—"}</dd>
          </div>
          <div>
            <dt>Deliverables</dt>
            <dd>{managed ? managed.deliverableCount : delivery?.files.length ?? "—"}</dd>
            <small>{managed?.state === "ready" ? "Verified" : managed?.state === "needs_attention" ? "Review required" : "Not built"}</small>
          </div>
          <div>
            <dt>Package</dt>
            <dd>{managed ? packageStatusLabel(managed.packageState) : "Checking…"}</dd>
            <small>{activePackage?.name ?? "No generated ZIP"}</small>
          </div>
          <div>
            <dt>Last Build</dt>
            <dd>{activePackage ? formatTimestamp(activePackage.modifiedAt) : delivery ? formatTimestamp(delivery.createdAt) : "—"}</dd>
            <small>{activePackage ? formatBytes(activePackage.sizeBytes) : ""}</small>
          </div>
        </dl>
      </div>
      {!creationAvailable && <p className="action-help">{creationHelp}</p>}
      {status.status === "loading" && <p className="delivery-status-loading" role="status">Reconciling delivery files and package state…</p>}
      {statusMessage && <p className="delivery-inline-message" role="status">{statusMessage}</p>}
    </section>

    {managed && managed.issues.length > 0 && <section className="delivery-issues panel" aria-labelledby="delivery-issues-heading">
      <div className="panel-heading"><div><p className="kicker">Verification</p><h2 id="delivery-issues-heading">Needs attention</h2></div><span>{managed.issues.length}</span></div>
      <ul>{managed.issues.map((issue, index) => <li key={`${issue.code}-${issue.path ?? index}`}><strong>{issue.path ? fileName(issue.path) : titleCase(issue.code)}</strong><span>{issue.message}</span></li>)}</ul>
    </section>}

    <div className="delivery-document-row">
      <section className="panel delivery-notes-panel" aria-labelledby="delivery-notes-heading">
        {!deliveryDocumentId ? <>
          <div className="panel-heading"><div><p className="kicker">Package document</p><h2 id="delivery-notes-heading">Delivery Notes</h2></div></div>
          <div className="delivery-empty-inline"><span>Delivery Notes are created with the first managed delivery.</span></div>
        </> : <MarkdownDocumentEditor
          headingId="delivery-notes-heading"
          kicker="Package document"
          title="Delivery Notes"
          ariaLabel="Delivery Notes Markdown content"
          value={notesDraft}
          savedValue={notes.status === "ready" ? notes.value.content : notesDraft}
          maxBytes={notes.status === "ready" ? notes.value.maxBytes : 65_536}
          loading={notes.status === "loading"}
          loadingLabel="Reading Delivery_Notes.md…"
          saving={notesSaving}
          disabled={notes.status !== "ready"}
          error={notes.status === "error" ? notes.message : null}
          saveLabel="Save Delivery Notes"
          minRows={9}
          onSave={saveNotes}
          onChange={(value) => {
            setNotesDraft(value);
            setNotesMessage(null);
          }}
        />}
        {notesMessage && <p role="status">{notesMessage}</p>}
      </section>

      <section className="delivery-package panel" aria-labelledby="delivery-package-heading">
        <div className="panel-heading">
          <div><p className="kicker">Package</p><h2 id="delivery-package-heading">Package Details</h2></div>
          {activePackage && <span className={`delivery-package-badge delivery-package-${activePackage.status}`}>{packageStatusLabel(activePackage.status)}</span>}
        </div>
        {!activePackage ? <div className="delivery-empty-inline">
          <strong>No generated ZIP</strong>
          <span>Create or rebuild the delivery with ZIP enabled when the deliverables and notes are ready.</span>
          {delivery && <div className="delivery-package-actions">
            <button type="button" className="secondary" onClick={() => void openDeliveryFolder()}><ActionIcon name="folder" />Open Delivery Folder</button>
            <button type="button" onClick={onCreate} disabled={!creationAvailable || loading}><ActionIcon name="refresh" />Rebuild Package</button>
          </div>}
        </div> : <div className="delivery-package-content">
          <div className="delivery-package-row">
            <div>
              <strong>{activePackage.name}</strong>
              <span>{formatBytes(activePackage.sizeBytes)} · {formatTimestamp(activePackage.modifiedAt)}</span>
            </div>
          </div>
          <dl className="delivery-package-metadata">
            <div><dt>Status</dt><dd>{packageStatusLabel(activePackage.status)}</dd></div>
            <div><dt>Size</dt><dd>{formatBytes(activePackage.sizeBytes)}</dd></div>
            <div><dt>Modified</dt><dd>{formatTimestamp(activePackage.modifiedAt)}</dd></div>
          </dl>
          <div className="delivery-package-actions">
            <button type="button" className="secondary" onClick={() => void openDeliveryFolder()}><ActionIcon name="folder" />Open Delivery Folder</button>
            <button type="button" onClick={onCreate} disabled={!creationAvailable || loading}><ActionIcon name="refresh" />Rebuild Package</button>
          </div>
        </div>}
        {activePackage?.issues.length ? <ul className="delivery-package-issues">{activePackage.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul> : null}
      </section>
    </div>

    {managed && managed.state !== "not_created"
      ? <DeliveryFilesList
          clientId={clientId}
          projectId={project.projectId}
          files={displayFiles}
          sourceRevision={managed.revisions.source}
        />
      : <section className="panel delivery-files-panel" aria-labelledby="delivery-files-heading">
          <div className="panel-heading"><div><p className="kicker">Deliverables</p><h2 id="delivery-files-heading">Delivery Files</h2></div></div>
          <div className="delivery-empty-inline"><span>No managed deliverables have been created yet.</span></div>
        </section>}
  </>;
}