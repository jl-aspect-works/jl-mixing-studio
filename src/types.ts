export interface VersionCheck {
  available: boolean;
  supported: boolean;
  studioCreationSupported: boolean;
  clientCreationSupported: boolean;
  projectCreationSupported: boolean;
  intakeValidationSupported: boolean;
  revisionCreationSupported: boolean;
  revisionApprovalSupported: boolean;
  deliveryCreationSupported: boolean;
  version: string | null;
  message: string;
}

export type FolderLocation = "workspace" | "studio" | "client" | "project" | "intake" | "audioPrep" | "references" | "revisions" | "delivery";
export interface FolderRequest { location: FolderLocation; clientId: string | null; projectId: string | null; }
export interface FolderResult { path: string; }

export interface DeliveryNotesRequest { clientId: string; projectId: string; }
export interface DeliveryNotesUpdateRequest extends DeliveryNotesRequest { content: string; }
export interface DeliveryNotesDocument { content: string; maxBytes: number; }

export interface StudioCreationRequest {
  studioName: string;
  mixEngineer: string | null;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
}

export type StudioCreationSummary = StudioCreationRequest;

export type StudioOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "rejected"
  | "uncertain"
  | "failed";

export interface StudioOperationResult {
  ok: boolean;
  code: StudioOperationCode;
  message: string;
  studio: StudioCreationSummary | null;
}

export interface DeliveryCreationRequest {
  clientId: string;
  projectId: string;
  replacementMode: "default" | "overwrite" | "clean";
  createZip: boolean;
  confirmedDeletions: string[];
}

export interface PlannedDeliveryFile {
  sourceName: string;
  deliverableType: string;
  path: string;
}

export interface ExcludedDeliveryFile {
  name: string;
  reason: string;
}

export interface DeliveryCreationPreview {
  clientId: string;
  projectId: string;
  projectName: string;
  currentRevision: number;
  approvedRevision: number;
  deliveredRevision: number | null;
  deliveryMethod: string;
  replacementMode: "default" | "overwrite" | "clean";
  createZip: boolean;
  zipName: string | null;
  selected: PlannedDeliveryFile[];
  excluded: ExcludedDeliveryFile[];
  deletions: string[];
}

export type DeliveryOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "approvalRequired"
  | "alreadyDelivered"
  | "rejected"
  | "uncertain"
  | "failed";

export interface DeliveryOperationResult {
  ok: boolean;
  code: DeliveryOperationCode;
  message: string;
  delivery: DeliveryCreationPreview | null;
}

export interface RevisionCreationRequest {
  clientId: string;
  projectId: string;
  description: string | null;
}

export interface RevisionCreationSummary {
  clientId: string;
  projectId: string;
  number: number;
  description: string;
}

export type RevisionOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "rejected"
  | "uncertain"
  | "failed";

export interface RevisionOperationResult {
  ok: boolean;
  code: RevisionOperationCode;
  message: string;
  revision: RevisionCreationSummary | null;
}

export interface RevisionApprovalRequest {
  clientId: string;
  projectId: string;
  revision: number;
  approvedBy: string;
}

export interface RevisionApprovalSummary {
  clientId: string;
  projectId: string;
  revision: number;
  approvedBy: string;
  approvedAt: string | null;
}

export type ApprovalOperationCode =
  | "ready"
  | "approved"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "revisionUnavailable"
  | "alreadyApproved"
  | "rejected"
  | "uncertain"
  | "failed";

export interface ApprovalOperationResult {
  ok: boolean;
  code: ApprovalOperationCode;
  message: string;
  approval: RevisionApprovalSummary | null;
}

export interface IntakeRequest {
  clientId: string;
  projectId: string;