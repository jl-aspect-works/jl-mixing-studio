import { useEffect, useState } from "react";
import { ActionIcon } from "../../components/ActionIcon";
import { handleDialogKeyDown } from "../../components/dialogKeyboard";
import {
  executeProjectContentDelete,
  planProjectContentDelete,
  type ContentDeletePlan,
  type ProjectFileEntry,
} from "./projectFileService";
import "./ProjectFileMutationDialog.css";

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function ContentDeleteDialog({ clientId, projectId, entry, onClose, onCompleted }: {
  clientId: string;
  projectId: string;
  entry: ProjectFileEntry;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
}) {
  const [plan, setPlan] = useState<ContentDeletePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;
    setPlan(null);
    setError(null);
    void planProjectContentDelete({ clientId, projectId, relativePath: entry.relativePath })
      .then((result) => { if (active) setPlan(result); })
      .catch((failure) => { if (active) setError(message(failure)); });
    return () => { active = false; };
  }, [clientId, projectId, entry.relativePath]);

  const confirm = async () => {
    if (!plan || pending || (plan.isDirectory && confirmation !== plan.displayName)) return;
    setPending(true);
    setError(null);
    try {
      await executeProjectContentDelete({
        clientId, projectId, relativePath: plan.relativePath,
        fingerprint: plan.fingerprint, confirmName: plan.displayName,
      });
      await onCompleted();
    } catch (failure) {
      setError(message(failure));
      setPending(false);
      setPlan(null); // A failed execute may have changed the filesystem: require a fresh review.
    }
  };

  return <div className="dialog-backdrop" onKeyDown={(event) => handleDialogKeyDown(event, {
    defaultDisabled: true,
    escapeDisabled: pending,
    onEscape: onClose,
  })}>
    <section className="client-dialog project-file-mutation-dialog" role="dialog" aria-modal="true" aria-labelledby="content-delete-title">
      <p className="kicker">Project files</p>
      <h2 id="content-delete-title">Delete {entry.displayName}?</h2>
      {!plan && !error && <p role="status">Checking the selected content…</p>}
      {plan && <>
        <p className="dialog-intro">Permanently delete <strong>{plan.relativePath}</strong>?</p>
        <p>{plan.fileCount} {plan.fileCount === 1 ? "file" : "files"}, {plan.directoryCount} {plan.directoryCount === 1 ? "folder" : "folders"}, {plan.totalBytes.toLocaleString()} bytes. {plan.isDirectory ? "The folder and everything inside it will be removed." : "Only this file will be removed."}</p>
        {plan.workingCopiesRetained?.length > 0 && <p>Working Audio copies will remain: {plan.workingCopiesRetained.join(", ")}.</p>}
        <p className="project-file-delete-warning">This cannot be undone. The managed project roots remain protected.</p>
        {plan.isDirectory && <label>Type <strong>{plan.displayName}</strong> to confirm
          <input autoComplete="off" aria-label="Confirm folder name" value={confirmation} disabled={pending} onChange={(event) => setConfirmation(event.target.value)} />
        </label>}
      </>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="secondary" disabled={pending} onClick={onClose}><ActionIcon name="close" />Cancel</button>
        <button type="button" className="destructive" disabled={!plan || pending || (plan.isDirectory && confirmation !== plan.displayName)} onClick={() => void confirm()}><ActionIcon name="delete" />{pending ? "Deleting…" : plan?.isDirectory ? "Delete folder" : "Delete file"}</button>
      </div>
    </section>
  </div>;
}
