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
  if (progress.phase === "planning" && (progress.total === null || progress.total === undefined || progress.total <= 0)) {
    return {
      label: "Scanning import…",
      determinate: false,
      value: 0,
      max: 1,
      ariaLabel: "Scanning import",
    };
  }

  const total = progress.total ?? fallbackTotal;
  if (total <= 0) {
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
  const hasReportedOverall = progress.overallTotal !== null
    && progress.overallTotal !== undefined
    && progress.overallTotal > 0;

  const reconstructedOverallTotal = progress.phase === "planning" ? total : total * 2 + 1;
  const overallTotal = hasReportedOverall ? progress.overallTotal! : reconstructedOverallTotal;

  let label: string;
  let reconstructedValue: number;
  switch (progress.phase) {
    case "planning":
      label = `Checking import files ${Math.max(1, completed)} of ${total}`;
      reconstructedValue = completed;
      break;
    case "staging":
      label = `Preparing ${activeFileNumber} of ${total} files`;
      reconstructedValue = completed;
      break;
    case "importing":
      label = `Importing ${activeFileNumber} of ${total} files`;
      reconstructedValue = total + completed;
      break;
    case "finalizing":
      label = total > 1 && hasReportedOverall
        ? `Finalizing import ${Math.max(1, completed)} of ${total}`
        : "Finalizing import…";
      reconstructedValue = total * 2;
      break;
    case "complete":
      label = "Import complete";
      reconstructedValue = overallTotal;
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

  const reportedOverall = progress.overallCompleted;
  const rawValue = reportedOverall === null || reportedOverall === undefined
    ? reconstructedValue
    : Math.max(0, Math.min(reportedOverall, overallTotal));
  const value = progress.phase === "complete"
    ? overallTotal
    : Math.min(rawValue, Math.max(0, overallTotal - 1));

  return {
    label,
    determinate: true,
    value,
    max: overallTotal,
    ariaLabel: `${label} (${value} of ${overallTotal} overall steps)`,
  };
}
