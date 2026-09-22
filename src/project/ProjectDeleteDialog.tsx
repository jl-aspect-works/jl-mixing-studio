import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ClientSummary, ProjectSummary } from "../types";
import { executeProjectDeletion, planProjectDeletion, type ProjectDeleteSummary } from "./projectDeleteService";
import "./ProjectDeleteDialog.css";

const size = (bytes: number) => bytes < 1024 ? `${bytes} bytes` : bytes < 1024 ** 2
  ? `${(bytes / 1024).toFixed(1)} KB` : bytes < 1024 ** 3
    ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;

export function ProjectDeleteDialog({ client, project, onClose, onDeleted }: {
  client: ClientSummary; project: ProjectSummary; onClose: () => void; onDeleted: () => void;
}) {
  const [summary, setSummary] = useState<ProjectDeleteSummary | null>(null);
  const [confirmedName, setConfirmedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    let active = true;
    void planProjectDeletion(client.clientId, project.projectId).then((result) => {
      if (!active) return;
      if (!result.ok || !result.data.summary) setError(result.message || "The authoritative deletion summary could not be prepared.");
      else setSummary(result.data.summary);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [client.clientId, project.projectId]);

  const remove = async () => {
    if (!summary || confirmedName !== summary.project.name || executing) return;
    setExecuting(true); setError(null);
    try {
      const result = await executeProjectDeletion(client.clientId, project.projectId, summary.fingerprint, confirmedName);
      if (!result.ok || !result.data.deleted) {
        const partial = result.data.partial_cleanup && result.data.remaining_path
          ? ` Partial project data remains at ${result.data.remaining_path}. Do not delete another project until this is reviewed.` : "";
        setError((result.message || "The project was not deleted.") + partial); return;
      }
      onDeleted();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setExecuting(false); }
  };

  return createPortal(<div className="dialog-backdrop project-delete-backdrop" onKeyDown={(event) => {
    if (event.key === "Escape" && !executing) onClose();
    if (event.key === "Enter") event.preventDefault();
  }}><section className="dialog project-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="project-delete-title">
    <h2 id="project-delete-title">Delete Project</h2>
    {!summary && !error && <p role="status">Preparing authoritative deletion summary…</p>}
    {summary && <>
      <p className="project-delete-warning"><strong>This permanently deletes the complete project and cannot be undone.</strong></p>
      <dl className="project-delete-summary">
        <div><dt>Project</dt><dd>{summary.project.name}</dd></div>
        <div><dt>Client</dt><dd>{summary.client.name}</dd></div>
        <div><dt>Project ID</dt><dd><code>{summary.project.id}</code></dd></div>
        <div><dt>Client ID</dt><dd><code>{summary.client.id}</code></dd></div>
        <div><dt>Path</dt><dd><code>{summary.project.path}</code></dd></div>
        <div><dt>Project contents</dt><dd>{summary.file_count.toLocaleString()} files · {size(summary.total_bytes)}</dd></div>
      </dl>
      <p>Deletion includes revisions, deliveries, reports, project audio/files, DAW files, and project metadata.</p>
      <p><strong>External Revision and Delivered Listening copies will remain in their configured destinations.</strong></p>
      <label className="project-delete-confirm"><span>Type <strong>{summary.project.name}</strong> to confirm</span><input autoFocus aria-label="Type Project Name to confirm deletion" value={confirmedName} onChange={(event) => setConfirmedName(event.target.value)} disabled={executing} autoComplete="off" /></label>
    </>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={executing}>Cancel</button><button type="button" className="danger" onClick={() => void remove()} disabled={!summary || confirmedName !== summary.project.name || executing}>{executing ? "Deleting…" : "Permanently Delete Project"}</button></div>
  </section></div>, document.body);
}
