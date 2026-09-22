import { type FormEvent, useEffect, useRef, useState } from "react";
import { ActionIcon } from "../../components/ActionIcon";
import { handleDialogKeyDown } from "../../components/dialogKeyboard";
import type { ProjectFileEntry } from "./projectFileService";
import "./ProjectFileMutationDialog.css";

export type ProjectFileMutation = {
  kind: "rename" | "delete";
  entry: ProjectFileEntry;
};

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The project file action could not be completed.";

const filenameStem = (entry: ProjectFileEntry) => {
  if (!entry.extension) return entry.displayName;
  const suffix = `.${entry.extension}`;
  return entry.displayName.toLowerCase().endsWith(suffix.toLowerCase())
    ? entry.displayName.slice(0, -suffix.length)
    : entry.displayName;
};

export function ProjectFileMutationDialog({
  mutation,
  onRename,
  onDelete,
  onCompleted,
  onClose,
}: {
  mutation: ProjectFileMutation;
  onRename?: (entry: ProjectFileEntry, newStem: string) => void | Promise<void>;
  onDelete?: (entry: ProjectFileEntry) => void | Promise<void>;
  onCompleted: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { entry, kind } = mutation;
  const [renameStem, setRenameStem] = useState(() => filenameStem(entry));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (kind === "rename") input.current?.focus();
    else confirmButton.current?.focus();
  }, [kind]);

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (pending) return;
    const nextStem = renameStem.trim();
    if (kind === "rename" && (!nextStem || nextStem === filenameStem(entry))) {
      setError(nextStem ? "Enter a different file name." : "Enter a file name before renaming.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      if (kind === "rename" && onRename) await onRename(entry, nextStem);
      else if (kind === "delete" && onDelete) await onDelete(entry);
      else throw new Error(`${kind === "rename" ? "Rename" : "Delete"} is not available for this file.`);
      await onCompleted();
    } catch (actionError) {
      setError(errorMessage(actionError));
      setPending(false);
    }
  };

  const extension = entry.extension ? `.${entry.extension}` : "";
  const title = kind === "rename" ? "Rename project file" : "Delete project file";

  return <div
    className="dialog-backdrop"
    onKeyDown={(event) => handleDialogKeyDown(event, {
      defaultDisabled: pending,
      escapeDisabled: pending,
      onDefault: kind === "delete" ? () => void submit() : undefined,
      onEscape: onClose,
    })}
  >
    <section className="client-dialog project-file-mutation-dialog" role="dialog" aria-modal="true" aria-labelledby="project-file-mutation-title">
      <p className="kicker">Project files</p>
      <h2 id="project-file-mutation-title">{title}</h2>

      {kind === "rename" ? <form onSubmit={(event) => void submit(event)}>
        <p className="dialog-intro">Rename <strong>{entry.displayName}</strong>. The file extension stays unchanged.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label>
          File name
          <div className="project-file-rename-field">
            <input
              ref={input}
              aria-label="File name"
              value={renameStem}
              onChange={(event) => setRenameStem(event.target.value)}
              disabled={pending}
              autoComplete="off"
            />
            {extension && <span>{extension}</span>}
          </div>
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={pending}><ActionIcon name="close" />Cancel</button>
          <button type="submit" disabled={pending}><ActionIcon name="edit" />{pending ? "Renaming…" : "Rename"}</button>
        </div>
      </form> : <div>
        <p className="dialog-intro">Permanently delete <strong>{entry.displayName}</strong>?</p>
        <p className="project-file-delete-warning">This action cannot be undone. No other project files will be changed.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={pending}><ActionIcon name="close" />Cancel</button>
          <button ref={confirmButton} type="button" className="destructive" onClick={() => void submit()} disabled={pending}><ActionIcon name="delete" />{pending ? "Deleting…" : "Delete file"}</button>
        </div>
      </div>}
    </section>
  </div>;
}
