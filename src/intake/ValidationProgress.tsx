import type { IntakeValidationProgress } from "./models";

export function ValidationProgress({ progress }: { progress: IntakeValidationProgress }) {
  const total = progress.total;
  const scanning = progress.phase === "scanning" || total === null;
  const finalizing = progress.phase === "finalizing" || progress.phase === "complete";
  const completed = total === null ? 0 : Math.min(progress.completed, total);
  const active = progress.active.map((path) => path.split(/[\\/]/).at(-1) ?? path);

  const label = scanning
    ? "Scanning files…"
    : finalizing
      ? `Validated ${completed} of ${total} files`
      : `Validating ${completed} of ${total} files`;

  return (
    <div className="intake-validation-progress" role="status" aria-live="polite">
      <div className="intake-validation-progress-heading">
        <strong>{label}</strong>
        {finalizing && <span>Finalizing validation…</span>}
      </div>
      {scanning ? (
        <progress aria-label="Scanning files for validation" />
      ) : (
        <progress
          aria-label={`Validated ${completed} of ${total} files`}
          value={completed}
          max={Math.max(total, 1)}
        />
      )}
      {!scanning && !finalizing && active.length > 0 && (
        <small title={progress.active.join(" · ")}>Processing: {active.join(" · ")}</small>
      )}
    </div>
  );
}
