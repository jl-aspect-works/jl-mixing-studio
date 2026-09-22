import type { ManagedImportProgress } from "./models";

export function audioPrepResetProgressPresentation(progress: ManagedImportProgress | null) {
  if (!progress || !progress.total || !progress.overallTotal) return null;
  const total = progress.total;
  const completed = Math.max(0, Math.min(progress.completed, total));
  const max = progress.overallTotal;
  // The final response, not an early engine event, establishes completed reset status.
  const value = Math.max(0, Math.min(progress.overallCompleted ?? 0, max - 1));
  const label = progress.phase === "planning" || progress.phase === "staging"
    ? `Preparing ${completed} of ${total}`
    : progress.phase === "importing"
      ? `Processing ${completed} of ${total}`
      : "Finishing Audio Prep reset…";
  return { label, value, max, active: progress.active };
}
