import type { ManagedImportProgress } from "./models";

export interface ManagedImportProgressPresentation {
  label: string;
  determinate: boolean;
  value: number;
  max: number;
  ariaLabel: string;
}

export function managedImportProgressPresentation(
  progress: ManagedImportProgress,
  fallbackTotal: number,
): ManagedImportProgressPresentation {
  const total = progress.total ?? fallbackTotal;
  if (total <= 0) {
    return {
      label: progress.phase === "planning" ? "Scanning import…" : "Preparing import…",
      determinate: false,
      value: 0,
      max: 1,
      ariaLabel: progress.phase === "planning" ? "Scanning import" : "Preparing import",
    };
  }

  const completed = Math.max(0, Math.min(progress.completed, total));
  const activeFileNumber = Math.min(completed + 1, total);
  const overallTotal = progress.overallTotal && progress.overallTotal > 0
    ? progress.overallTotal
    : total;
  const reportedOverall = progress.overallCompleted;
  const overallValue = reportedOverall === null || reportedOverall === undefined
    ? completed
    : Math.max(0, Math.min(reportedOverall, overallTotal));

  let label: string;
  switch (progress.phase) {
    case "planning":
      label = `Checking import files ${Math.max(1, completed)} of ${total}`;
      break;
    case "staging":
      label = `Preparing ${activeFileNumber} of ${total} files`;
      break;
    case "importing":
      label = `Importing ${activeFileNumber} of ${total} files`;
      break;
    case "finalizing":
      label = total > 1
        ? `Finalizing import ${Math.max(1, completed)} of ${total}`
        : "Finalizing import…";
      break;
    case "complete":
      label = "Import complete";
      break;
    default:
      return {
        label: "Preparing import…",
        determinate: false,
        value: 0,
        max: 1,
        ariaLabel: "Preparing import",
      };
  }

  const value = progress.phase === "complete"
    ? overallTotal
    : Math.min(overallValue, Math.max(0, overallTotal - 1));

  return {
    label,
    determinate: true,
    value,
    max: overallTotal,
    ariaLabel: `${label} (${value} of ${overallTotal} overall steps)`,
  };
}
