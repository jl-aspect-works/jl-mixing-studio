import type { IntakeReport } from "../types";

export interface IntakeValidationProgress {
  clientId: string;
  projectId: string;
  phase: "scanning" | "validating" | "complete" | "finalizing";
  completed: number;
  total: number | null;
  active: string[];
}

export type IntakeWorkflowState =
  | { status: "closed" }
  | { status: "preflighting" }
  | { status: "confirming"; preview: IntakeReport }
  | { status: "running"; preview: IntakeReport }
  | { status: "uncertain"; message: string };
