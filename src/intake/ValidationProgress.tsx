import type { IntakeValidationProgress } from "./models";
import "./ValidationProgress.css";

export function ValidationProgress({ progress }: { progress: IntakeValidationProgress }) {
  const total = progress.total;
  const scanning = progress.phase === "scanning" || total === null;
  const finalizing = progress.phase === "finalizing";
  const complete = progress.phase === "complete";
  const completed = total === null ? 0 : Math.min(progress.completed, total);
  const current = total === null ? 0 : Math.min(completed + 1, total);
  const active = progress.active.map((path) => {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] ?? path;
  });

  const label = scanning
    ? "Scanning files…"
    : finalizing
      ? "Finalizing validation…"
      : complete
        ? `Validated ${completed} of ${total} files`
        : `Validating ${current} of ${total} files`;

  return (
    <div className="intake-validation-progress" role="status" aria-live="polite">
      <div className="intake-validation-progress-heading">
        <strong>{label}</strong>
      </div>
      {scanning ? (
        <progress aria-label="Scanning files for validation" />
      ) : finalizing ? (
        <progress aria-label="Finalizing validation" />
      ) : (
        <progress
          aria-label={complete ? `Validated ${completed} of ${total} files` : `Validating ${current} of ${total} files`}
          value={completed}
          max={Math.max(total, 1)}
        />
      )}
      {!scanning && !finalizing && !complete && active.length > 0 && (
        <small title={progress.active.join(" · ")}>Processing: {active.join(" · ")}</small>
      )}
    </div>
  );
}
