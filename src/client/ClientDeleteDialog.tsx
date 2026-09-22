import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ClientSummary } from "../types";
import {
  executeClientDeletion,
  planClientDeletion,
  type ClientDeleteSummary,
} from "./clientDeleteService";
import "./ClientDeleteDialog.css";

const size = (bytes: number) => bytes < 1024 ? `${bytes} bytes` : bytes < 1024 ** 2
  ? `${(bytes / 1024).toFixed(1)} KB` : bytes < 1024 ** 3
    ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;

export function ClientDeleteDialog({ client, onClose, onDeleted }: {
  client: ClientSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [summary, setSummary] = useState<ClientDeleteSummary | null>(null);
  const [confirmedName, setConfirmedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    let active = true;
    void planClientDeletion(client.clientId).then((result) => {
      if (!active) return;
      if (!result.ok || !result.data.summary) {
        setError(result.message || "The authoritative deletion summary could not be prepared.");
      } else {
        setSummary(result.data.summary);
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [client.clientId]);

  const remove = async () => {
    if (!summary || confirmedName !== summary.client.name || executing) return;
    setExecuting(true);
    setError(null);
    try {
      const result = await executeClientDeletion(client.clientId, summary.fingerprint, confirmedName);
      if (!result.ok || !result.data.deleted) {
        const partial = result.data.partial_cleanup && result.data.remaining_path
          ? ` Partial client data remains at ${result.data.remaining_path}. Do not delete another client until this is reviewed.`
          : "";
        setError((result.message || "The client was not deleted.") + partial);
        return;
      }
      onDeleted();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExecuting(false);
    }
  };

  return createPortal(<div className="dialog-backdrop client-delete-backdrop" onKeyDown={(event) => {
    if (event.key === "Escape" && !executing) onClose();
    if (event.key === "Enter") event.preventDefault();
  }}><section className="dialog client-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="client-delete-title">
    <h2 id="client-delete-title">Delete Client</h2>
    {!summary && !error && <p role="status">Preparing authoritative deletion summary…</p>}
    {summary && <>
      <p className="client-delete-warning"><strong>This permanently deletes the client and all remaining client content. It cannot be undone.</strong></p>
      <dl className="client-delete-summary">
        <div><dt>Client</dt><dd>{summary.client.name}</dd></div>
        <div><dt>Client ID</dt><dd><code>{summary.client.id}</code></dd></div>
        <div><dt>Document ID</dt><dd><code>{summary.client.document_id}</code></dd></div>
        <div><dt>Path</dt><dd><code>{summary.client.path}</code></dd></div>
        <div><dt>Projects</dt><dd>{summary.project_count}</dd></div>
        <div><dt>Client contents</dt><dd>{summary.file_count.toLocaleString()} files · {size(summary.total_bytes)}</dd></div>
        <div><dt>Recoverable</dt><dd>No</dd></div>
      </dl>
      <p>Deletion includes client metadata and every non-project file or folder remaining inside this client directory.</p>
      <label className="client-delete-confirm"><span>Type <strong>{summary.client.name}</strong> to confirm</span><input autoFocus aria-label="Type Client Name to confirm deletion" value={confirmedName} onChange={(event) => setConfirmedName(event.target.value)} disabled={executing} autoComplete="off" /></label>
    </>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={executing}>Cancel</button><button type="button" className="danger" onClick={() => void remove()} disabled={!summary || confirmedName !== summary.client.name || executing}>{executing ? "Deleting…" : "Permanently Delete Client"}</button></div>
  </section></div>, document.body);
}
