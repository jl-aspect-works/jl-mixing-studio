import { useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import { managedImportProgressPresentation } from "./managedImportProgress";
import type { IntakeValidationProgress, ManagedImportProgress } from "./models";
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
type ImportSelection = "add" | "skip";

export interface ManagedFileOperationDialogProps {
  clientId: string;
  projectId: string;
  mode: ManagedFileOperationMode;
  relativePaths?: string[];
  title?: string;
  sourceCancelLabel?: string;
  followupRunning?: boolean;
  followupProgress?: IntakeValidationProgress | null;
  onClose: () => void;
  onCompleted: () => void;
}

type DialogState =
  | { status: "source" }
  | { status: "planning"; sourceKind?: ManagedImportSourceKind; sources?: string[] }
  | { status: "review"; plan: ManagedPlan; sourceKind?: ManagedImportSourceKind; sources?: string[] }
  | { status: "executing"; plan: ManagedPlan; sourceKind?: ManagedImportSourceKind; sources?: string[] }
  | { status: "finalizing"; result: ManagedOperationResult }
  | { status: "success"; result: ManagedOperationResult }
  | { status: "error"; message: string };

type ReviewRow = {
  sourcePath: string;
  original: ManagedPlanItem | null;
  audio: ManagedPlanItem | null;
};

const messageFrom = (result: ManagedOperationResult, fallback: string) => result.message || fallback;
const destinationName = (item: ManagedPlanItem) => item.destination_relative_path.split("/").pop() || item.destination_relative_path;
const initialSelections = (plan: ManagedPlan): Record<string, ImportSelection> =>
  Object.fromEntries(plan.files.map((file) => [file.relative_path, "add" as const]));

const groupedRows = (plan: ManagedPlan): ReviewRow[] => {
  const rows = new Map<string, ReviewRow>();
  for (const file of plan.files) {
    rows.set(file.relative_path, { sourcePath: file.relative_path, original: null, audio: null });
  }
  for (const item of plan.items) {
    const row = rows.get(item.source_relative_path) ?? { sourcePath: item.source_relative_path, original: null, audio: null };
    if (item.area === "original_delivery") row.original = item;
    if (item.area === "audio_prep") row.audio = item;
    rows.set(item.source_relative_path, row);
  }
  return [...rows.values()];
};

const sourceReviewLabel = (sourceKind?: ManagedImportSourceKind, sources?: string[]) => {
  if (sourceKind === "files" && sources?.length) return `Reviewing ${sources.length} ${sources.length === 1 ? "file" : "files"}…`;
  if (sourceKind === "zip") return "Scanning ZIP…";
  if (sourceKind === "folder") return "Scanning folder…";
  return "Reviewing files…";
};

export function ManagedFileOperationDialog({
  clientId,
  projectId,
  mode,
  relativePaths = [],
  title,
  sourceCancelLabel = "Cancel",
  followupRunning = false,
  followupProgress = null,
  onClose,
  onCompleted,
}: ManagedFileOperationDialogProps) {
  const [state, setState] = useState<DialogState>(mode === "import" ? { status: "source" } : { status: "planning" });
  const [decisions, setDecisions] = useState<Record<string, ManagedConflictDecision>>({});
  const [selections, setSelections] = useState<Record<string, ImportSelection>>({});
  const [importProgress, setImportProgress] = useState<ManagedImportProgress | null>(null);
  const followupObserved = useRef(false);

  useEffect(() => {
    if (state.status !== "finalizing") {
      followupObserved.current = false;
      return;
    }
    if (followupRunning) {
      followupObserved.current = true;
      return;
    }
    if (followupObserved.current) setState({ status: "success", result: state.result });
  }, [followupRunning, state]);

  const planReset = () => {
    setState({ status: "planning" });
    setDecisions({});
    setSelections({});
    void planAudioPrepReset({ clientId, projectId, relativePaths })
      .then((result) => result.ok && result.data.plan ? setState({ status: "review", plan: result.data.plan }) : setState({ status: "error", message: messageFrom(result, "Audio Prep could not be reviewed.") }))
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
    setSelections({});
    try {
      const sources = await chooseManagedImportSources(sourceKind);
      if (sources.length === 0) { setState({ status: "source" }); return; }
      setState({ status: "planning", sourceKind, sources });
      const result = await planManagedImport({ clientId, projectId, sourceKind, sources });
      if (!result.ok || !result.data.plan) { setState({ status: "error", message: messageFrom(result, "The selected client files could not be reviewed.") }); return; }
      setSelections(initialSelections(result.data.plan));
      setState({ status: "review", plan: result.data.plan, sourceKind, sources });
    } catch (error: unknown) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The selected client files could not be reviewed." });
    }
  };

  const review = state.status === "review" || state.status === "executing" ? state : null;
  const conflicts = useMemo(() => review?.plan.items.filter((item) => item.conflict) ?? [], [review]);
  const rows = useMemo(() => review ? groupedRows(review.plan) : [], [review]);
  const selectedRelativePaths = useMemo(() => mode === "import" && review
    ? review.plan.files.map((file) => file.relative_path).filter((path) => selections[path] !== "skip")
    : [], [mode, review, selections]);
  const selectedSet = useMemo(() => new Set(selectedRelativePaths), [selectedRelativePaths]);
  const activeConflicts = mode === "import" ? conflicts.filter((item) => selectedSet.has(item.source_relative_path)) : conflicts;
  const unresolved = activeConflicts.filter((item) => !decisions[item.id]);
  const conflictFileCount = new Set(activeConflicts.map((item) => item.source_relative_path)).size;
  const audioItems = review?.plan.items.filter((item) => item.area === "audio_prep") ?? [];
  const skippedSelectionCount = mode === "import" && review ? review.plan.files.length - selectedRelativePaths.length : 0;
  const setAll = (decision: ManagedConflictDecision) => setDecisions((current) => ({
    ...current,
    ...Object.fromEntries(activeConflicts.map((item) => [item.id, decision])),
  }));
  const setDecision = (item: ManagedPlanItem, value: string) => {
    if (value !== "replace" && value !== "skip") return;
    setDecisions((current) => ({ ...current, [item.id]: value }));
  };
  const setSelection = (path: string, value: string) => {
    if (value !== "add" && value !== "skip") return;
    setSelections((current) => ({ ...current, [path]: value }));
  };
  const setAllSelections = (value: ImportSelection) => {
    if (!review) return;
    setSelections(Object.fromEntries(review.plan.files.map((file) => [file.relative_path, value])));
  };

  const actionCell = (item: ManagedPlanItem | null, area: "original" | "audio") => {
    if (!item) return <span className="managed-action-static muted">—</span>;
    if (mode === "import" && selections[item.source_relative_path] === "skip") return <span className="managed-action-static muted">Skipped</span>;
    if (!item.conflict) return <span className="managed-action-static add">Add</span>;
    const selected = decisions[item.id] ?? "";
    const renamedTarget = area === "audio" && destinationName(item) !== item.source_relative_path.split("/").pop();
    return <div className="managed-action-cell">
      {renamedTarget && <small>Matched: {destinationName(item)}</small>}
      <select
        aria-label={`${area === "original" ? "Client Files" : "Audio Prep"} action for ${item.source_relative_path}`}
        value={selected}
        disabled={state.status === "executing"}
        onChange={(event) => setDecision(item, event.target.value)}
      >
        <option value="">Choose…</option>
        <option value="replace">Replace</option>
        <option value="skip">Skip</option>
      </select>
      {!selected && <small className="managed-decision-required">Decision required</small>}
      {area === "audio" && <small className="managed-audio-warning">Replace overwrites the prepared copy.</small>}
    </div>;
  };

  const execute = async () => {
    if (!review || unresolved.length > 0 || (mode === "import" && selectedRelativePaths.length === 0)) return;
    const activeDecisions = mode === "import"
      ? Object.fromEntries(activeConflicts.flatMap((item) => decisions[item.id] ? [[item.id, decisions[item.id]]] : []))
      : decisions;
    setImportProgress(null);
    setState({ status: "executing", plan: review.plan, sourceKind: review.sourceKind, sources: review.sources });
    try {
      const result = mode === "import"
        ? await executeManagedImport(
          { clientId, projectId, sourceKind: review.sourceKind!, sources: review.sources!, planId: review.plan.plan_id, decisions: activeDecisions, selectedRelativePaths },
          setImportProgress,
        )
        : await executeAudioPrepReset({ clientId, projectId, relativePaths, planId: review.plan.plan_id, decisions: activeDecisions });
      if (!result.ok) { setState({ status: "error", message: messageFrom(result, "The managed file operation could not be completed.") }); return; }
      if (mode === "import") {
        setState({ status: "finalizing", result });
        onCompleted();
      } else {
        setState({ status: "success", result });
        onCompleted();
      }
    } catch (error: unknown) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The managed file operation could not be completed." });
    }
  };

  const pending = state.status === "planning" || state.status === "executing" || state.status === "finalizing";
  const dialogTitle = title ?? (mode === "import" ? "Import Client Files" : "Copy to Audio Prep");
  const importProgressUi = importProgress ? managedImportProgressPresentation(importProgress, selectedRelativePaths.length) : null;
  const finalizingProgress = followupProgress;

  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
    <section className="client-dialog managed-file-dialog" role="dialog" aria-modal="true" aria-labelledby="managed-file-dialog-title">
      <p className="kicker">Managed files</p><h2 id="managed-file-dialog-title">{dialogTitle}</h2>
      {state.status === "source" && <><p className="dialog-intro">Choose what the client delivered.</p><div className="managed-source-options">
        <button type="button" onClick={() => void chooseSource("zip")}><strong>ZIP Archive</strong><span>Import one ZIP and preserve its folder structure.</span></button>
        <button type="button" onClick={() => void chooseSource("folder")}><strong>Folder</strong><span>Import one folder and preserve its internal structure.</span></button>
        <button type="button" onClick={() => void chooseSource("files")}><strong>Files</strong><span>Choose one or more individual files.</span></button>
      </div><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}><ActionIcon name="close" />{sourceCancelLabel}</button></div></>}

      {state.status === "planning" && <div className="managed-operation-progress managed-operation-progress-primary" role="status" aria-live="polite"><span className="client-files-spinner" aria-hidden="true" /><strong>{sourceReviewLabel(state.sourceKind, state.sources)}</strong><p>Preparing the selected files for import. No project files are being changed yet.</p></div>}

      {state.status === "review" && <><p className="dialog-intro">{mode === "import" ? "Choose Add or Skip for each planned file, then resolve any destination conflicts for files being added." : "Review each file and choose what to do anywhere a destination already exists."}</p><section className="managed-plan-summary" aria-label="Managed file operation summary">{mode === "import" ? <><article><strong>{selectedRelativePaths.length}</strong><span>Files to add</span></article><article><strong>{skippedSelectionCount}</strong><span>Files to skip</span></article></> : <article><strong>{audioItems.length}</strong><span>Audio Prep operations</span></article>}<article><strong>{unresolved.length}</strong><span>Decisions remaining</span></article></section>
        {mode === "import" && <div className="managed-table-actions"><span>{selectedRelativePaths.length} of {state.plan.files.length} planned {state.plan.files.length === 1 ? "file" : "files"} selected.</span><div className="managed-apply-all"><span>Import selection:</span><button type="button" className="secondary" onClick={() => setAllSelections("add")}>Add All</button><button type="button" className="secondary" onClick={() => setAllSelections("skip")}>Skip All</button></div></div>}
        {mode === "import" && selectedRelativePaths.length === 0 ? <p className="managed-no-conflicts">No files are selected for import. Choose Add for at least one file to continue.</p> : activeConflicts.length === 0 ? <p className="managed-no-conflicts">No existing project files will be overwritten.</p> : <div className="managed-table-actions"><span>{conflictFileCount} {conflictFileCount === 1 ? "file has" : "files have"} {activeConflicts.length} destination {activeConflicts.length === 1 ? "conflict" : "conflicts"}. {unresolved.length} {unresolved.length === 1 ? "decision remains" : "decisions remain"}.</span>{activeConflicts.length > 1 && <div className="managed-apply-all"><span>Apply to selected conflicts:</span><button type="button" className="secondary" onClick={() => setAll("replace")}>Replace All</button><button type="button" className="secondary" onClick={() => setAll("skip")}>Skip All Conflicts</button></div>}</div>}
        <div className="managed-review-table-wrap"><table className={`managed-review-table ${mode === "import" ? "managed-review-table-import" : ""}`}><thead><tr><th>File</th>{mode === "import" && <th>Import</th>}<th>Client Files</th><th>Audio Prep</th></tr></thead><tbody>{rows.map((row) => <tr key={row.sourcePath}><td><strong>{row.sourcePath}</strong></td>{mode === "import" && <td><select aria-label={`Import selection for ${row.sourcePath}`} value={selections[row.sourcePath] ?? "add"} onChange={(event) => setSelection(row.sourcePath, event.target.value)}><option value="add">Add</option><option value="skip">Skip</option></select></td>}<td>{mode === "audioPrepReset" ? <span className="managed-action-static source">Source</span> : actionCell(row.original, "original")}</td><td>{actionCell(row.audio, "audio")}</td></tr>)}</tbody></table></div>
        <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}><ActionIcon name="close" />{mode === "import" ? "Cancel Import" : "Cancel"}</button><button type="button" onClick={() => void execute()} disabled={unresolved.length > 0 || (mode === "import" && selectedRelativePaths.length === 0)}><ActionIcon name="check" />{mode === "import" ? "Import Files" : "Copy to Audio Prep"}</button></div></>}

      {state.status === "executing" && (mode === "import" && importProgress && importProgressUi ? <div className="managed-operation-progress managed-operation-progress-primary" role="status" aria-live="polite"><strong>{importProgressUi.label}</strong>{importProgressUi.determinate ? <progress aria-label={importProgressUi.ariaLabel} value={importProgressUi.value} max={importProgressUi.max} /> : <progress aria-label={importProgressUi.ariaLabel} />}{importProgress.active.length > 0 && <small>Processing: {importProgress.active.map((path) => path.split(/[\\/]/).pop() ?? path).join(" · ")}</small>}</div> : <div className="managed-operation-progress managed-operation-progress-primary" role="status"><span className="client-files-spinner" aria-hidden="true" />{mode === "import" ? "Importing client files…" : "Updating Audio Prep…"}</div>)}

      {state.status === "finalizing" && <div className="managed-operation-progress managed-operation-progress-primary" role="status" aria-live="polite">
        <strong>{finalizingProgress?.phase === "finalizing" ? "Finalizing project…" : finalizingProgress?.total ? `Checking imported files… ${finalizingProgress.completed} of ${finalizingProgress.total}` : "Checking imported files…"}</strong>
        {finalizingProgress?.total ? <progress aria-label={`Checked ${finalizingProgress.completed} of ${finalizingProgress.total} files`} value={finalizingProgress.completed} max={Math.max(finalizingProgress.total, 1)} /> : <progress aria-label="Checking imported files" />}
        {finalizingProgress?.active.length ? <small>Processing: {finalizingProgress.active.map((path) => path.split(/[\\/]/).pop() ?? path).join(" · ")}</small> : <p>Import is complete. Studio is verifying the project before it becomes ready.</p>}
      </div>}

      {state.status === "success" && <><div className="managed-operation-success" role="status"><strong>{mode === "import" ? "Project ready" : "Audio Prep updated"}</strong><p>{(() => { const items = state.result.data.result?.items ?? []; const changed = items.filter((item) => item.result === "created" || item.result === "replaced").length; const operationSkipped = items.filter((item) => item.result === "skipped").length; const skipped = operationSkipped + (mode === "import" ? Object.values(selections).filter((value) => value === "skip").length : 0); return `${changed} ${changed === 1 ? "file operation" : "file operations"} completed${skipped ? ` · ${skipped} skipped` : ""}.`; })()}</p></div><div className="dialog-actions"><button type="button" onClick={onClose}><ActionIcon name="check" />Done</button></div></>}
      {state.status === "error" && <><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">No additional changes will be made until you try again.</p><div className="dialog-actions">{mode === "import" && <button type="button" className="secondary" onClick={() => setState({ status: "source" })}><ActionIcon name="back" />Choose another source</button>}{mode === "audioPrepReset" && <button type="button" className="secondary" onClick={planReset}><ActionIcon name="refresh" />Try again</button>}<button type="button" onClick={onClose}><ActionIcon name="close" />Close</button></div></>}
    </section>
  </div>;
}
