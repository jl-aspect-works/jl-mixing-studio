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
  if (progress.phase === "planning" || total <= 0) {
    return {
      label: "Preparing import…",
      determinate: false,
      value: 0,
      max: 1,
      ariaLabel: "Preparing import",
    };
  }

  const completed = Math.max(0, Math.min(progress.completed, total));
  const activeFileNumber = Math.min(completed + 1, total);
  const reconstructedOverallTotal = total * 2 + 1;
  const overallTotal = progress.overallTotal && progress.overallTotal > 0
    ? progress.overallTotal
    : reconstructedOverallTotal;
  let reconstructedValue = 0;
  let label = "Preparing import…";

  switch (progress.phase) {
    case "staging":
      reconstructedValue = completed;
      label = `Preparing ${activeFileNumber} of ${total} files`;
      break;
    case "importing":
      reconstructedValue = total + completed;
      label = `Importing ${activeFileNumber} of ${total} files`;
      break;
    case "finalizing":
      reconstructedValue = total * 2;
      label = "Finalizing import…";
      break;
    case "complete":
      return {
        label: "Finalizing import…",
        determinate: false,
        value: Math.max(0, overallTotal - 1),
        max: overallTotal,
        ariaLabel: "Finalizing import",
      };
    default:
      return {
        label,
        determinate: false,
        value: 0,
        max: 1,
        ariaLabel: "Preparing import",
      };
  }

  const reportedOverall = progress.overallCompleted;
  const value = reportedOverall === null || reportedOverall === undefined
    ? reconstructedValue
    : Math.max(0, Math.min(reportedOverall, overallTotal));

  return {
    label,
    determinate: true,
    value,
    max: overallTotal,
    ariaLabel: `${label} (${value} of ${overallTotal} overall steps)`,
  };
}
