import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClientSummary, ProjectSummary, RevisionSummary } from "../types";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { RevisionFileBrowser } from "./RevisionFileBrowser";
import {
  getRevisionNotes,
  updateRevisionDescription,
  updateRevisionNotes,
  type RevisionNotesDocument,
} from "./revisionWorkspaceService";
import "./RevisionViews.css";

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

export function RevisionBadges({
  project,
  number,
  historicallyApproved,
}: {
  project: ProjectSummary;
  number: number;
  historicallyApproved: boolean;
}) {
  const badges: Array<[string, string]> = [];
  if (number === project.currentRevision) badges.push(["Current", "current"]);
  if (number === project.approvedRevision) badges.push(["Approved", "approved"]);
  if (number === project.deliveredRevision) badges.push(["Delivered", "delivered"]);
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

export function RevisionsView({
  client,
  project,
  loading,
  actionError,
  creationAvailable,
  creationHelp,
  approvalAvailable,
  approvalHelp,
  onRefresh,
  onNewRevision,
  onApprove,
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
  onProjects: () => void;
  onOverview: () => void;
  onRefresh: () => void;
  onNewRevision: () => void;
  onApprove: (revision: RevisionSummary) => void;
  onSelectView: (view: ProjectShellView) => void;
}) {
  const revisions = useMemo(
    () => [...project.revisions].sort((left, right) => right.number - left.number),
    [project.revisions],
  );
  const [selectedNumber, setSelectedNumber] = useState(project.currentRevision);
  const selected = revisions.find((revision) => revision.number === selectedNumber) ?? revisions[0] ?? null;
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(selected?.description ?? "");
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<NotesState>(emptyNotesState);
  const [notesBusy, setNotesBusy] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    if (!revisions.some((revision) => revision.number === selectedNumber)) {
      setSelectedNumber(project.currentRevision);
    }
  }, [project.currentRevision, revisions, selectedNumber]);

  useEffect(() => {
    setDescriptionEditing(false);
    setDescriptionDraft(selected?.description ?? "");
    setDescriptionError(null);
  }, [selected?.number, selected?.description]);

  useEffect(() => {
    if (!selected) {
      setNotes({ status: "ready", content: "", saved: "", maxBytes: 65_536 });
      return;
    }
    let current = true;
    setNotes(emptyNotesState);
    void getRevisionNotes({ clientId: client.clientId, projectId: project.projectId, revision: selected.number })
      .then((document: RevisionNotesDocument) => {
        if (current) setNotes({ status: "ready", content: document.content, saved: document.content, maxBytes: document.maxBytes });
      })
      .catch((error: unknown) => {
        if (current) setNotes({ ...emptyNotesState, status: "error", message: errorMessage(error, "Revision Notes could not be loaded.") });
      });
    return () => { current = false; };
  }, [client.clientId, project.projectId, selected?.number]);

  const saveDescription = async () => {
    if (!selected || !descriptionDraft.trim() || descriptionDraft.trim() === selected.description) {
      setDescriptionEditing(false);
      setDescriptionDraft(selected?.description ?? "");
      return;
    }
    setDescriptionBusy(true);
    setDescriptionError(null);
    try {
      const result = await updateRevisionDescription({
        clientId: client.clientId,
        projectId: project.projectId,
        revision: selected.number,
        description: descriptionDraft.trim(),
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
      setNotes((current) => ({ ...current, status: "error", message: errorMessage(error, "Revision Notes could not be saved.") }));
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

  const selectedAlreadyApproved = selected?.number === project.approvedRevision;

  return <>
    <ProjectNavigationBar active="revisions" onSelect={onSelectView} />

    <div className="revisions-summary-row">
      <section className="panel revisions-context" aria-labelledby="revisions-heading">
        <div>
          <h2 id="revisions-heading">Revisions</h2>
          <p>Mix history, notes, and revision files for this project.</p>
        </div>
      </section>
      <section className="panel revisions-quick-actions" aria-labelledby="revision-actions-heading">
        <h2 id="revision-actions-heading">Quick Actions</h2>
        <div className="action-stack">
          <button type="button" onClick={onNewRevision} disabled={!creationAvailable || loading} title={creationHelp}>New Revision</button>
          <button
            type="button"
            className="secondary"
            onClick={() => { if (selected) onApprove(selected); }}
            disabled={!selected || !approvalAvailable || selectedAlreadyApproved || loading}
            title={selectedAlreadyApproved ? "The selected revision is already approved." : approvalHelp}
          >Approve Revision</button>
          <button type="button" className="secondary" onClick={() => void openRevisionsFolder()}>Open Revisions Folder</button>
        </div>
      </section>
    </div>

    {actionError && <div className="inline-notice error" role="alert">{actionError}</div>}
    {folderError && <div className="inline-notice error" role="alert">{folderError}</div>}

    {revisions.length === 0 ? <section className="empty-state"><h2>No revisions recorded</h2><p>This project doesn’t have a revision yet.</p></section> : <div className="revisions-workspace">
      <nav className="panel revision-history" aria-label="Revision history">
        <div className="revision-history-header"><h2>Revision History</h2></div>
        <div className="revision-history-list">
          {revisions.map((revision) => <button
            key={revision.revisionId}
            type="button"
            className={`revision-history-item${revision.number === selected?.number ? " active" : ""}`}
            aria-current={revision.number === selected?.number ? "true" : undefined}
            onClick={() => setSelectedNumber(revision.number)}
          >
            <span className="revision-history-title">
              <strong>Revision {String(revision.number).padStart(2, "0")}</strong>
              <RevisionBadges project={project} number={revision.number} historicallyApproved={revision.approvedAt !== null} />
            </span>
            <span className="revision-history-description">{revision.description}</span>
            <span className="revision-history-date">{formatRevisionTimestamp(revision.createdAt)}</span>
          </button>)}
        </div>
      </nav>

      {selected && <main className="revision-detail">
        <section className="panel revision-detail-header" aria-labelledby="revision-detail-heading">
          <div className="revision-detail-heading">
            <div>
              <h2 id="revision-detail-heading">Revision {String(selected.number).padStart(2, "0")}</h2>
              <small>Created {formatRevisionTimestamp(selected.createdAt)} · {selected.revisionId}</small>
            </div>
            <RevisionBadges project={project} number={selected.number} historicallyApproved={selected.approvedAt !== null} />
          </div>

          {descriptionEditing ? <div className="revision-description-edit">
            <input
              autoFocus
              aria-label="Revision description"
              value={descriptionDraft}
              disabled={descriptionBusy}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); void saveDescription(); }
                if (event.key === "Escape") { event.preventDefault(); setDescriptionEditing(false); setDescriptionDraft(selected.description); }
              }}
            />
            <button type="button" disabled={descriptionBusy || !descriptionDraft.trim()} onClick={() => void saveDescription()}>{descriptionBusy ? "Saving…" : "Save"}</button>
            <button type="button" className="secondary" disabled={descriptionBusy} onClick={() => { setDescriptionEditing(false); setDescriptionDraft(selected.description); }}>Cancel</button>
          </div> : <div className="revision-description-row">
            <p>{selected.description}</p>
            <button type="button" className="secondary" onClick={() => setDescriptionEditing(true)}>Edit Description</button>
          </div>}
          {descriptionError && <div className="inline-notice error" role="alert">{descriptionError}</div>}
        </section>

        <section className="panel revision-notes-panel" aria-labelledby="revision-notes-heading">
          <div className="revision-notes-heading">
            <h2 id="revision-notes-heading">Revision Notes</h2>
            <span>{notes.status === "loading" ? "Loading…" : `${new TextEncoder().encode(notes.content).length.toLocaleString()} / ${notes.maxBytes.toLocaleString()} bytes`}</span>
          </div>
          {notes.status === "error" && <div className="inline-notice error" role="alert">{notes.message}</div>}
          <textarea
            aria-label="Revision Notes"
            disabled={notes.status === "loading" || notesBusy}
            value={notes.content}
            onChange={(event) => setNotes((current) => ({ ...current, content: event.target.value }))}
          />
          <div className="revision-notes-actions">
            <button
              type="button"
              disabled={notes.status === "loading" || notesBusy || notes.content === notes.saved || new TextEncoder().encode(notes.content).length > notes.maxBytes}
              onClick={() => void saveNotes()}
            >{notesBusy ? "Saving…" : "Save Notes"}</button>
          </div>
        </section>

        <section className="panel revision-files-panel" aria-labelledby="revision-files-heading">
          <div className="revision-files-heading"><h2 id="revision-files-heading">Revision Files</h2></div>
          <RevisionFileBrowser key={selected.number} clientId={client.clientId} projectId={project.projectId} revision={selected.number} />
        </section>
      </main>}
    </div>}
  </>;
}
