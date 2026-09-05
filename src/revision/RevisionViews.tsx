import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ClientSummary,
  ProjectSummary,
  RevisionLifecycleAction,
  RevisionLifecycleResult,
  RevisionLifecycleSupport,
  RevisionSummary,
} from "../types";
import { addWorkspaceRefreshListener } from "../app/workspaceRefreshEvents";
import { ActionIcon } from "../components/ActionIcon";
import { ComparisonFlow } from "../comparison";
import { MarkdownDocumentEditor } from "../components/MarkdownDocumentEditor";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { RevisionFileBrowser } from "./RevisionFileBrowser";
import {
  RevisionListeningBadge,
  RevisionListeningDetails,
  useRevisionListeningSummary,
} from "./RevisionListeningSummary";
import {
  getRevisionNotes,
  updateRevisionDescription,
  updateRevisionNotes,
  type RevisionNotesDocument,
} from "./revisionWorkspaceService";
import "./RevisionViews.css";
import "./RevisionCompact.css";

const formatRevisionTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

const lifecycleOf = (revision: RevisionSummary) => revision.lifecycle ?? "open";

export function RevisionBadges({
  project,
  number,
  historicallyApproved,
  lifecycle = "open",
}: {
  project: ProjectSummary;
  number: number;
  historicallyApproved: boolean;
  lifecycle?: "open" | "closed";
}) {
  const badges: Array<[string, string]> = [];
  if (number === project.currentRevision) badges.push(["Current", "current"]);
  if (number === project.approvedRevision) badges.push(["Approved", "approved"]);
  if (number === project.deliveredRevision) badges.push(["Delivered", "delivered"]);
  if (lifecycle === "closed") badges.push(["Closed", "closed"]);
  if (historicallyApproved && number !== project.approvedRevision) badges.push(["Previously approved", "approved"]);
  if (badges.length === 0 && number < project.currentRevision) badges.push(["Superseded", ""]);
  return <span className="revision-badges">
    {badges.map(([label, className]) => <span key={label} className={`revision-badge ${className}`}>{label}</span>)}
  </span>;
}

type NotesState =
  | { status: "loading"; content: string; saved: string; maxBytes: number }
  | { status: "ready"; content: string; saved: string; maxBytes: number }
  | { status: "error"; content: string; saved: string; maxBytes: number; message: string };

const emptyNotesState: NotesState = { status: "loading", content: "", saved: "", maxBytes: 65_536 };

type LifecycleSupportState =
  | { status: "loading"; value: null }
  | { status: "ready"; value: RevisionLifecycleSupport }
  | { status: "error"; value: null; message: string };

type PendingRevisionMutation = {
  action: RevisionLifecycleAction;
  revision: RevisionSummary;
};

export function RevisionsView({
  client,
  project,
  loading,
  actionError,
  creationAvailable,
  creationHelp,
  approvalAvailable,
  approvalHelp,
  deliveryAvailable,
  deliveryHelp,
  onRefresh,
  onNewRevision,
  onApprove,
  onCreateDelivery,
  onSelectView,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  loading: boolean;
  actionError: string | null;
  creationAvailable: boolean;
  creationHelp: string;
  approvalAvailable: boolean;
  approvalHelp: string;
  deliveryAvailable: boolean;
  deliveryHelp: string;
  onProjects: () => void;
  onOverview: () => void;
  onRefresh: () => void;
  onNewRevision: () => void;
  onApprove: (revision: RevisionSummary) => void;
  onCreateDelivery: () => void;
  onSelectView: (view: ProjectShellView) => void;
}) {
  const revisions = useMemo(
    () => [...project.revisions].sort((left, right) => right.number - left.number),
    [project.revisions],
  );
  const initialSelectedNumber = project.currentRevision || revisions[0]?.number || 0;
  const [selectedNumber, setSelectedNumber] = useState(initialSelectedNumber);
  const selected = revisions.find((revision) => revision.number === selectedNumber) ?? revisions[0] ?? null;
  const listeningSummary = useRevisionListeningSummary(
    client.clientId,
    project.projectId,
    selected?.number ?? 0,
  );
  const [descriptionDraft, setDescriptionDraft] = useState(selected?.description ?? "");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<NotesState>(emptyNotesState);
  const [notesBusy, setNotesBusy] = useState(false);
  const notesRef = useRef<NotesState>(notes);
  const notesBusyRef = useRef(notesBusy);
  const notesRequestSequence = useRef(0);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [lifecycleSupport, setLifecycleSupport] = useState<LifecycleSupportState>({ status: "loading", value: null });
  const [pendingMutation, setPendingMutation] = useState<PendingRevisionMutation | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { notesBusyRef.current = notesBusy; }, [notesBusy]);

  useEffect(() => {
    if (!revisions.some((revision) => revision.number === selectedNumber)) {
      setSelectedNumber(project.currentRevision || revisions[0]?.number || 0);
    }
  }, [project.currentRevision, revisions, selectedNumber]);

  useEffect(() => {
    setDescriptionDraft(selected?.description ?? "");
    setDescriptionEditing(false);
    setDescriptionError(null);
  }, [selected?.number, selected?.description]);

  useEffect(() => {
    let cancelled = false;
    setLifecycleSupport({ status: "loading", value: null });
    invoke<RevisionLifecycleSupport>("get_revision_lifecycle_support")
      .then((value) => { if (!cancelled) setLifecycleSupport({ status: "ready", value }); })
      .catch((error: unknown) => {
        if (!cancelled) setLifecycleSupport({
          status: "error",
          value: null,
          message: errorMessage(error, "Revision lifecycle capabilities could not be checked."),
        });
      });
    return () => { cancelled = true; };
  }, []);

  const loadRevisionNotes = useCallback(async (preserveDirty: boolean, showLoading: boolean) => {
    if (!selected) {
      setNotes({ status: "ready", content: "", saved: "", maxBytes: 65_536 });
      return;
    }
    const currentNotes = notesRef.current;
    if (preserveDirty && (notesBusyRef.current || currentNotes.content !== currentNotes.saved)) return;

    const sequence = ++notesRequestSequence.current;
    if (showLoading) setNotes(emptyNotesState);
    try {
      const document: RevisionNotesDocument = await getRevisionNotes({
        clientId: client.clientId,
        projectId: project.projectId,
        revision: selected.number,
      });
      if (notesRequestSequence.current !== sequence) return;
      setNotes({ status: "ready", content: document.content, saved: document.content, maxBytes: document.maxBytes });
    } catch (error: unknown) {
      if (notesRequestSequence.current !== sequence) return;
      setNotes((current) => ({
        ...current,
        status: "error",
        message: errorMessage(error, "Revision Notes could not be loaded."),
      }));
    }
  }, [client.clientId, project.projectId, selected?.number]);

  useEffect(() => {
    void loadRevisionNotes(false, true);
    return () => { notesRequestSequence.current += 1; };
  }, [loadRevisionNotes]);

  useEffect(
    () => addWorkspaceRefreshListener(() => { void loadRevisionNotes(true, false); }),
    [loadRevisionNotes],
  );

  const saveDescription = async () => {
    if (!selected) return;
    const description = descriptionDraft.trim();
    if (!description) {
      setDescriptionDraft(selected.description);
      setDescriptionEditing(false);
      return;
    }
    if (description === selected.description) {
      setDescriptionEditing(false);
      return;
    }
    setDescriptionBusy(true);
    setDescriptionError(null);
    try {
      const result = await updateRevisionDescription({
        clientId: client.clientId,
        projectId: project.projectId,
        revision: selected.number,
        description,
      });
      if (!result.ok || !result.revision || result.revision.revision !== selected.number) {
        setDescriptionError(result.message || "The revision description could not be verified.");
        return;
      }
      setDescriptionDraft(result.revision.description);
      setDescriptionEditing(false);
      onRefresh();
    } catch (error) {
      setDescriptionError(errorMessage(error, "The revision description could not be updated."));
    } finally {
      setDescriptionBusy(false);
    }
  };

  const saveNotes = async () => {
    if (!selected || notes.status === "loading" || notes.content === notes.saved) return;
    setNotesBusy(true);
    try {
      const document = await updateRevisionNotes({
        clientId: client.clientId,
        projectId: project.projectId,
        revision: selected.number,
        content: notes.content,
      });
      setNotes({ status: "ready", content: document.content, saved: document.content, maxBytes: document.maxBytes });
    } catch (error) {
      setNotes((current) => ({ ...current, status: "error", message: errorMessage(error, "Revision Notes could not be saved."), }));
    } finally {
      setNotesBusy(false);
    }
  };

  const openRevisionsFolder = async () => {
    setFolderError(null);
    try {
      await invoke("open_folder", {
        request: { location: "revisions", clientId: client.clientId, projectId: project.projectId },
      });
    } catch (error) {
      setFolderError(errorMessage(error, "The Revisions folder could not be opened."));
    }
  };

  const confirmMutation = async () => {
    if (!pendingMutation) return;
    setMutationBusy(true);
    setMutationError(null);
    try {
      const result = await invoke<RevisionLifecycleResult>("mutate_revision_lifecycle", {
        request: {
          clientId: client.clientId,
          projectId: project.projectId,
          revision: pendingMutation.revision.number,
          action: pendingMutation.action,
        },
      });
      if (!result.ok) {
        setMutationError(result.message);
        return;
      }
      setMutationNotice(result.message);
      setPendingMutation(null);
      onRefresh();
    } catch (error) {
      setMutationError(errorMessage(error, "The revision state could not be changed."));
    } finally {
      setMutationBusy(false);
    }
  };

  const selectedApproved = selected?.number === project.approvedRevision;
  const selectedDelivered = selected?.number === project.deliveredRevision;
  const selectedLifecycle = selected ? lifecycleOf(selected) : "open";
  const support = lifecycleSupport.status === "ready" ? lifecycleSupport.value : null;
  const lifecycleAvailable = support?.available === true && support.lifecycleSupported;
  const unapproveAvailable = support?.available === true && support.unapproveSupported;
  const supportHelp = lifecycleSupport.status === "error"
    ? lifecycleSupport.message
    : support?.message ?? "Checking revision lifecycle support…";

  const approvalTitle = (() => {
    if (!selected) return "Select a revision first.";
    if (selectedApproved) {
      if (!unapproveAvailable) return supportHelp;
      return "Review and confirm removing approval from this revision.";
    }
    if (selectedLifecycle === "closed") return "Reopen this revision before approving it.";
    return approvalHelp;
  })();

  const lifecycleTitle = (() => {
    if (!selected) return "Select a revision first.";
    if (!lifecycleAvailable) return supportHelp;
    return selectedLifecycle === "closed"
      ? "Reopen this revision and return it to active workflow consideration."
      : "Close this revision without deleting its files or history.";
  })();

  if (comparisonOpen) {
    return <ComparisonFlow client={client} project={project} onClose={() => setComparisonOpen(false)} />;
  }

  return <>
    <ProjectNavigationBar
      active="revisions"
      onSelect={onSelectView}
      actions={<><button type="button" className="secondary" onClick={() => setComparisonOpen(true)} disabled={revisions.length < 2 || loading} title={revisions.length < 2 ? "Create at least two revisions before starting a comparison." : "Compare two or more normal revisions without seeing their identities."}>New Comparison</button><button type="button" onClick={onNewRevision} disabled={!creationAvailable || loading} title={creationHelp}><ActionIcon name="add" />New Revision</button></>}
    />

    {actionError && <div className="inline-notice error" role="alert">{actionError}</div>}
    {folderError && <div className="inline-notice error" role="alert">{folderError}</div>}
    {mutationError && !pendingMutation && <div className="inline-notice error" role="alert">{mutationError}</div>}
    {mutationNotice && <div className="inline-notice" role="status">{mutationNotice}</div>}

    {revisions.length === 0 ? <section className="empty-state"><h2>No revisions recorded</h2><p>This project doesn’t have a revision yet.</p></section> : <>
      <div className="revisions-workspace">
        <nav className="panel revision-history" aria-label="Revision history">
          <div className="revision-history-header"><h2>Revision History</h2></div>
          <div className="revision-history-list">
            {revisions.map((revision) => <button
              key={revision.revisionId}
              type="button"
              className={`revision-history-item${revision.number === selected?.number ? " active" : ""}${lifecycleOf(revision) === "closed" ? " closed" : ""}`}
              aria-current={revision.number === selected?.number ? "true" : undefined}
              onClick={() => setSelectedNumber(revision.number)}
            >
              <span className="revision-history-title">
                <strong>Revision {String(revision.number).padStart(2, "0")}</strong>
                <RevisionBadges project={project} number={revision.number} lifecycle={lifecycleOf(revision)} historicallyApproved={revision.approvedAt !== null} />
              </span>
              <span className="revision-history-description">{revision.description}</span>
              <span className="revision-history-date">{formatRevisionTimestamp(revision.createdAt)}</span>
            </button>)}
          </div>
          <div className="revision-history-footer">
            <button type="button" className="secondary" onClick={() => void openRevisionsFolder()}><ActionIcon name="folder" />Open Revisions Folder</button>
          </div>
        </nav>

        {selected && <main className="revision-detail">
          <section className={`panel revision-detail-header${selectedLifecycle === "closed" ? " closed" : ""}`} aria-labelledby="revision-detail-heading">
            <div className="revision-detail-heading">
              <div>
                <h2 id="revision-detail-heading">Revision {String(selected.number).padStart(2, "0")}</h2>
                <small>Created {formatRevisionTimestamp(selected.createdAt)}</small>
              </div>
              <div className="revision-detail-heading-actions">
                <span className="revision-badges">
                  <RevisionBadges project={project} number={selected.number} lifecycle={selectedLifecycle} historicallyApproved={selected.approvedAt !== null} />
                  <RevisionListeningBadge summary={listeningSummary} />
                </span>
                {(!selectedApproved || !selectedDelivered) && <button
                  type="button"
                  className="secondary revision-lifecycle-action"
                  onClick={() => {
                    if (selectedApproved) setPendingMutation({ action: "unapprove", revision: selected });
                    else onApprove(selected);
                  }}
                  disabled={loading || (selectedApproved
                    ? !unapproveAvailable
                    : !approvalAvailable || selectedLifecycle === "closed")}
                  title={approvalTitle}
                ><ActionIcon name={selectedApproved ? "undo" : "check"} />{selectedApproved ? "Unapprove Revision" : "Approve Revision"}</button>}
                {selectedApproved && <button
                  type="button"
                  className="secondary revision-lifecycle-action"
                  onClick={onCreateDelivery}
                  disabled={!deliveryAvailable || loading}
                  title={deliveryHelp}
                ><ActionIcon name="download" />Create Delivery</button>}
                <button
                  type="button"
                  className="secondary revision-lifecycle-action"
                  onClick={() => setPendingMutation({ action: selectedLifecycle === "closed" ? "reopen" : "close", revision: selected })}
                  disabled={!lifecycleAvailable || loading}
                  title={lifecycleTitle}
                ><ActionIcon name={selectedLifecycle === "closed" ? "retry" : "archive"} />{selectedLifecycle === "closed" ? "Reopen Revision" : "Close Revision"}</button>
              </div>
            </div>

            {selectedApproved && selectedDelivered && <p className="revision-delivered-approval-note">Delivered revisions remain approved until delivery state is resolved.</p>}

            <div className="revision-description-click-edit">
              {descriptionEditing ? <input
                autoFocus
                aria-label="Revision description"
                value={descriptionDraft}
                disabled={descriptionBusy}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onBlur={() => void saveDescription()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDescriptionDraft(selected.description);
                    setDescriptionEditing(false);
                  }
                }}
              /> : <button
                type="button"
                className="revision-description-display"
                onClick={() => setDescriptionEditing(true)}
                disabled={descriptionBusy}
                aria-label="Edit revision description"
                title="Click to edit"
              >{descriptionDraft}</button>}
              {descriptionBusy && <span className="revision-description-saving">Saving…</span>}
            </div>
            {descriptionError && <div className="inline-notice error" role="alert">{descriptionError}</div>}
            <RevisionListeningDetails summary={listeningSummary} />
          </section>

          <section className="panel revision-notes-panel" aria-labelledby="revision-notes-heading">
            <MarkdownDocumentEditor
              headingId="revision-notes-heading"
              title="Revision Notes"
              ariaLabel="Revision Notes"
              value={notes.content}
              savedValue={notes.saved}
              maxBytes={notes.maxBytes}
              loading={notes.status === "loading"}
              loadingLabel="Loading Revision Notes…"
              saving={notesBusy}
              disabled={notes.status === "loading"}
              error={notes.status === "error" ? notes.message : null}
              saveLabel="Save Notes"
              onSave={() => void saveNotes()}
              onChange={(content) => setNotes((current) => ({ ...current, content }))}
            />
          </section>
        </main>}
      </div>

      {selected && <section className="panel revision-files-panel" aria-labelledby="revision-files-heading">
        <div className="revision-files-heading"><h2 id="revision-files-heading">Revision Files</h2></div>
        <RevisionFileBrowser key={selected.number} clientId={client.clientId} projectId={project.projectId} revision={selected.number} />
      </section>}
    </>}

    {pendingMutation && <div className="client-dialog-backdrop" role="presentation">
      <section className="client-dialog revision-lifecycle-dialog" role="dialog" aria-modal="true" aria-labelledby="revision-lifecycle-heading">
        <h2 id="revision-lifecycle-heading">{
          pendingMutation.action === "close" ? "Close Revision" : pendingMutation.action === "reopen" ? "Reopen Revision" : "Unapprove Revision"
        }</h2>
        <p>{pendingMutation.action === "close"
          ? `Revision ${String(pendingMutation.revision.number).padStart(2, "0")} will remain in history and on disk. Closing it removes it from active/current workflow consideration.`
          : pendingMutation.action === "reopen"
            ? `Revision ${String(pendingMutation.revision.number).padStart(2, "0")} will return to active workflow consideration and may become the Current revision.`
            : `Approval will be removed from Revision ${String(pendingMutation.revision.number).padStart(2, "0")}. No revision files or history will be deleted.`}</p>
        {mutationError && <div className="inline-notice error" role="alert">{mutationError}</div>}
        <div className="client-dialog-actions">
          <button type="button" className="secondary" disabled={mutationBusy} onClick={() => { setPendingMutation(null); setMutationError(null); }}>Cancel</button>
          <button type="button" disabled={mutationBusy} aria-busy={mutationBusy} onClick={() => void confirmMutation()}> {
            mutationBusy ? "Updating…" : pendingMutation.action === "close" ? "Close Revision" : pendingMutation.action === "reopen" ? "Reopen Revision" : "Unapprove Revision"
          }</button>
        </div>
      </section>
    </div>}
  </>;
}
