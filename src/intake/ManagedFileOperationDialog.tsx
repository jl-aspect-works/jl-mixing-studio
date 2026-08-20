import { useEffect, useMemo, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import {
  chooseManagedImportSources,
  executeAudioPrepReset,
  executeManagedImport,
  planAudioPrepReset,
  planManagedImport,
  type ManagedConflictDecision,
  type ManagedImportSourceKind,
  type ManagedOperationResult,
  type ManagedPlan,
  type ManagedPlanItem,
} from "./managedClientFilesService";
import "./ManagedFileOperationDialog.css";

export type ManagedFileOperationMode = "import" | "audioPrepReset";

export interface ManagedFileOperationDialogProps {
  clientId: string;
  projectId: string;
  mode: ManagedFileOperationMode;
  relativePaths?: string[];
  onClose: () => void;
  onCompleted: () => void;
}

type DialogState =
  | { status: "source" }
  | { status: "planning"; sourceKind?: ManagedImportSourceKind; sources?: string[] }
  | { status: "review"; plan: ManagedPlan; sourceKind?: ManagedImportSourceKind; sources?: string[] }
  | { status: "executing"; plan: ManagedPlan; sourceKind?: ManagedImportSourceKind; sources?: string[] }
  | { status: "success"; result: ManagedOperationResult }
  | { status: "error"; message: string };

const areaLabel = (area: string) => area === "original_delivery" ? "Original Delivery" : area === "audio_prep" ? "Audio Prep" : area;
const fileLabel = (item: ManagedPlanItem) => item.source_relative_path || item.destination_relative_path;

const messageFrom = (result: ManagedOperationResult, fallback: string) =>
  result.message || fallback;

export function ManagedFileOperationDialog({
  clientId,
  projectId,
  mode,
  relativePaths = [],
  onClose,
  onCompleted,
}: ManagedFileOperationDialogProps) {
  const [state, setState] = useState<DialogState>(mode === "import" ? { status: "source" } : { status: "planning" });
  const [decisions, setDecisions] = useState<Record<string, ManagedConflictDecision>>({});

  const planReset = () => {
    setState({ status: "planning" });
    setDecisions({});
    void planAudioPrepReset({ clientId, projectId, relativePaths })
      .then((result) => {
        if (!result.ok || !result.data.plan) {
          setState({ status: "error", message: messageFrom(result, "Audio Prep could not be reviewed.") });
          return;
        }
        setState({ status: "review", plan: result.data.plan });
      })
      .catch((error: unknown) => setState({ status: "error", message: error instanceof Error ? error.message : "Audio Prep could not be reviewed." }));
  };

  useEffect(() => {
    if (mode === "audioPrepReset") planReset();
    // The initial selection is fixed for the lifetime of this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseSource = async (sourceKind: ManagedImportSourceKind) => {
    setState({ status: "planning", sourceKind });
    setDecisions({});
    try {
      const sources = await chooseManagedImportSources(sourceKind);
      if (sources.length === 0) {
        setState({ status: "source" });
        return;
      }
      const result = await planManagedImport({ clientId, projectId, sourceKind, sources });
      if (!result.ok || !result.data.plan) {
        setState({ status: "error", message: messageFrom(result, "The selected client files could not be reviewed.") });
        return;
      }
      setState({ status: "review", plan: result.data.plan, sourceKind, sources });
    } catch (error: unknown) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The selected client files could not be reviewed." });
    }
  };

  const review = state.status === "review" || state.status === "executing" ? state : null;
  const conflicts = useMemo(() => review?.plan.items.filter((item) => item.conflict) ?? [], [review]);
  const unresolved = conflicts.filter((item) => !decisions[item.id]);
  const originalItems = review?.plan.items.filter((item) => item.area === "original_delivery") ?? [];
  const audioItems = review?.plan.items.filter((item) => item.area === "audio_prep") ?? [];

  const setAll = (decision: ManagedConflictDecision) => {
    setDecisions(Object.fromEntries(conflicts.map((item) => [item.id, decision])));
  };

  const execute = async () => {
    if (!review || unresolved.length > 0) return;
    setState({ status: "executing", plan: review.plan, sourceKind: review.sourceKind, sources: review.sources });
    try {
      const result = mode === "import"
        ? await executeManagedImport({
            clientId,
            projectId,
            sourceKind: review.sourceKind!,
            sources: review.sources!,
            planId: review.plan.plan_id,
            decisions,
          })
        : await executeAudioPrepReset({
            clientId,
            projectId,
            relativePaths,
            planId: review.plan.plan_id,
            decisions,
          });
      if (!result.ok) {
        setState({ status: "error", message: messageFrom(result, "The managed file operation could not be completed.") });
        return;
      }
      setState({ status: "success", result });
      onCompleted();
    } catch (error: unknown) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The managed file operation could not be completed." });
    }
  };

  const pending = state.status === "planning" || state.status === "executing";
  const title = mode === "import" ? "Import Client Files" : "Copy to Audio Prep";

  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
    <section className="client-dialog managed-file-dialog" role="dialog" aria-modal="true" aria-labelledby="managed-file-dialog-title">
      <p className="kicker">Managed files</p>
      <h2 id="managed-file-dialog-title">{title}</h2>

      {state.status === "source" && <>
        <p className="dialog-intro">Choose what the client delivered.</p>
        <div className="managed-source-options">
          <button type="button" onClick={() => void chooseSource("zip")}><strong>ZIP Archive</strong><span>Import one ZIP and preserve its folder structure.</span></button>
          <button type="button" onClick={() => void chooseSource("folder")}><strong>Folder</strong><span>Import one folder and preserve its internal structure.</span></button>
          <button type="button" onClick={() => void chooseSource("files")}><strong>Files</strong><span>Choose one or more individual files.</span></button>
        </div>
        <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}><ActionIcon name="close" />Cancel</button></div>
      </>}

      {state.status === "planning" && <div className="managed-operation-progress" role="status"><span className="client-files-spinner" aria-hidden="true" /><strong>Reviewing files…</strong><p>No project files are being changed yet.</p></div>}

      {review && <>
        <p className="dialog-intro">Review what Studio will change before continuing.</p>
        <section className="managed-plan-summary" aria-label="Managed file operation summary">
          {mode === "import" && <article><strong>{originalItems.length}</strong><span>Original Delivery operations</span></article>}
          <article><strong>{audioItems.length}</strong><span>Audio Prep operations</span></article>
          <article><strong>{conflicts.length}</strong><span>Need a decision</span></article>
        </section>

        {conflicts.length === 0 ? <p className="managed-no-conflicts">No existing project files will be overwritten.</p> : <section className="managed-conflicts" aria-labelledby="managed-conflicts-heading">
          <div className="managed-conflicts-heading">
            <div><h3 id="managed-conflicts-heading">{conflicts.length} {conflicts.length === 1 ? "file needs" : "files need"} your attention</h3><p>Every existing destination requires an explicit Replace or Skip decision.</p></div>
            {conflicts.length > 1 && <div className="managed-apply-all"><span>Apply to all:</span><button type="button" className="secondary" onClick={() => setAll("replace")} disabled={pending}>Replace All</button><button type="button" className="secondary" onClick={() => setAll("skip")} disabled={pending}>Skip All</button></div>}
          </div>
          <div className="managed-conflict-list">{conflicts.map((item) => <article key={item.id} className={item.area === "audio_prep" ? "audio-prep-conflict" : ""}>
            <div><strong>{fileLabel(item)}</strong><span>{areaLabel(item.area)}</span>{item.area === "audio_prep" && <small>Replacing this file will overwrite the current prepared version.</small>}</div>
            <div className="managed-conflict-actions" role="group" aria-label={`Decision for ${fileLabel(item)} in ${areaLabel(item.area)}`}>
              <button type="button" className={decisions[item.id] === "replace" ? "selected" : "secondary"} aria-pressed={decisions[item.id] === "replace"} onClick={() => setDecisions((current) => ({ ...current, [item.id]: "replace" }))} disabled={pending}>Replace</button>
              <button type="button" className={decisions[item.id] === "skip" ? "selected" : "secondary"} aria-pressed={decisions[item.id] === "skip"} onClick={() => setDecisions((current) => ({ ...current, [item.id]: "skip" }))} disabled={pending}>Skip</button>
            </div>
          </article>)}</div>
        </section>}

        {state.status === "executing" && <div className="managed-executing" role="status"><span className="client-files-spinner" aria-hidden="true" />{mode === "import" ? "Importing client files…" : "Updating Audio Prep…"}</div>}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={pending}><ActionIcon name="close" />{mode === "import" ? "Cancel Import" : "Cancel"}</button>
          <button type="button" onClick={() => void execute()} disabled={pending || unresolved.length > 0}><ActionIcon name="check" />{state.status === "executing" ? "Working…" : mode === "import" ? "Import Files" : "Copy to Audio Prep"}</button>
        </div>
      </>}

      {state.status === "success" && <>
        <div className="managed-operation-success" role="status"><strong>{mode === "import" ? "Import complete" : "Audio Prep updated"}</strong><p>{(() => { const items = state.result.data.result?.items ?? []; const changed = items.filter((item) => item.result === "created" || item.result === "replaced").length; const skipped = items.filter((item) => item.result === "skipped").length; return `${changed} ${changed === 1 ? "file operation" : "file operations"} completed${skipped ? ` · ${skipped} skipped` : ""}.`; })()}</p></div>
        <div className="dialog-actions"><button type="button" onClick={onClose}><ActionIcon name="check" />Done</button></div>
      </>}

      {state.status === "error" && <>
        <div className="form-error" role="alert">{state.message}</div>
        <p className="dialog-intro">No additional changes will be made until you try again.</p>
        <div className="dialog-actions">
          {mode === "import" && <button type="button" className="secondary" onClick={() => setState({ status: "source" })}><ActionIcon name="back" />Choose another source</button>}
          {mode === "audioPrepReset" && <button type="button" className="secondary" onClick={planReset}><ActionIcon name="refresh" />Try again</button>}
          <button type="button" onClick={onClose}><ActionIcon name="close" />Close</button>
        </div>
      </>}
    </section>
  </div>;
}
