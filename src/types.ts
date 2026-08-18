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
  workspaceRoot: string;
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
  revisionNumber: number;
}

export interface RevisionApprovalSummary {
  clientId: string;
  projectId: string;
  revisionNumber: number;
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
  | "rejected"
  | "uncertain"
  | "failed";

export interface ApprovalOperationResult {
  ok: boolean;
  code: ApprovalOperationCode;
  message: string;
  approval: RevisionApprovalSummary | null;
}

export type DeliveryReplacementMode = "default" | "overwrite" | "clean";

export interface IntakeRequest {
  clientId: string;
  projectId: string;
}

export type IntakeOperationCode =
  | "ready"
  | "validated"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "rejected"
  | "failed";

export interface IntakeReportSummary {
  clientId: string;
  projectId: string;
  path: string;
  content: string;
}

export interface IntakeOperationResult {
  ok: boolean;
  code: IntakeOperationCode;
  message: string;
  report: IntakeReportSummary | null;
  validation?: IntakeValidationData | null;
}

export interface IntakeValidationFinding {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  relativePath: string | null;
}

export interface IntakeValidationFile {
  relativePath: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  sampleRate: number | null;
  bitDepth: number | null;
  fileFormat: string | null;
  channels: number | null;
  durationSeconds: number | null;
  decodeOk: boolean | null;
  exactDuplicateOf: string | null;
  exactDualMono: boolean | null;
  status: "ok" | "warning" | "error";
  findings: IntakeValidationFinding[];
}

export interface AudioPrepValidationFile extends IntakeValidationFile {
  originalDeliveryRelativePath?: string | null;
  originalFilename?: string | null;
  provenanceState?: "exact_content" | "ambiguous" | "unavailable" | null;
}

export interface IntakeValidationCounts {
  files: number;
  ok: number;
  warnings: number;
  errors: number;
}

export interface IntakeValidationTarget {
  sampleRate: number | null;
  bitDepth: number | null;
  fileFormat: string | null;
}

export interface AudioPrepValidationData {
  area: "audio_prep";
  relativePath: string;
  status: "ready" | "needs_attention" | "blocked";
  target: IntakeValidationTarget;
  counts: IntakeValidationCounts;
  findings: IntakeValidationFinding[];
  files: AudioPrepValidationFile[];
}

export interface IntakeValidationData {
  area: "original_delivery";
  relativePath: string;
  mode: "cache" | "incremental" | "full";
  cacheUsed: boolean;
  status: "ready" | "needs_attention" | "blocked";
  target: IntakeValidationTarget;
  counts: IntakeValidationCounts;
  findings: IntakeValidationFinding[];
  files: IntakeValidationFile[];
  audioPrep?: AudioPrepValidationData | null;
}

export interface DeliveryStatusRequest {
  clientId: string;
  projectId: string;
}

export interface DeliveryStatusFile {
  path: string;
  source: string | null;
  deliverableType: string | null;
  status: "current" | "missing" | "mismatch" | "untracked";
  expectedSha256: string | null;
  actualSha256: string | null;
  sizeBytes: number | null;
}

export interface DeliveryStatusPackage {
  name: string;
  status: "current" | "stale" | "missing" | "untracked";
  sizeBytes: number | null;
}

export interface DeliveryStatusData {
  projectId: string;
  deliveredRevision: number | null;
  packageState: "current" | "stale" | "missing" | "untracked" | "not_created";
  files: DeliveryStatusFile[];
  packages: DeliveryStatusPackage[];
  notesStatus: "current" | "stale" | "missing";
  unexpectedEntries: string[];
}

export interface DeliveryStatusResult {
  ok: boolean;
  message: string;
  delivery: DeliveryStatusData | null;
}

export interface DeliveryPackageDeleteRequest {
  clientId: string;
  projectId: string;
  zipName: string;
}

export interface ProjectSummary {
  clientId: string;
  projectId: string;
  projectName: string;
  artist: string;
  status: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  currentRevision: number;
  approvedRevision: number | null;
  deliveredRevision: number | null;
  revisions: RevisionSummary[];
  delivery: DeliverySummary | null;
  path: string;
}

export interface RevisionSummary {
  number: number;
  status: string;
  description: string;
  createdAt: string;
  approvedAt: string | null;
  path: string;
}

export interface DeliverySummary {
  revision: number;
  createdAt: string;
  path: string;
}

export interface ClientSummary {
  clientId: string;
  clientName: string;
  defaultArtist: string | null;
  projects: ProjectSummary[];
  path: string;
}

export interface StudioSummary {
  studioId: string;
  studioName: string;
  rootPath: string;
  schemaVersion: string;
  createdWith: string;
  createdAt: string;
  mixEngineer: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  deliveryMethod: string;
  requestedDeliverables: string[];
  changeDirectoryAfterCreate: boolean;
}

export type WorkspaceStatus = "healthy" | "empty" | "partial" | "unavailable" | "invalid";
export interface WorkspaceCounts { clients: number; projects: number; }
export interface WorkspaceIssue { code: string; message: string; path: string | null; }
export interface WorkspaceSnapshot {
  workspacePath: string;
  status: WorkspaceStatus;
  studio: StudioSummary | null;
  clients: ClientSummary[];
  counts: WorkspaceCounts;
  issues: WorkspaceIssue[];
}

export interface SystemInfo {
  product: string;
  version: string;
  apiVersion: string;
  metadataSchemaVersions: string[];
  capabilities: string[];
}

export interface ClientCreationRequest {
  clientId: string;
  clientName: string;
  defaultArtist: string | null;
}

export interface ClientCreationSummary {
  clientId: string;
  clientName: string;
  defaultArtist: string | null;
}

export type ClientOperationCode =
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

export interface ClientOperationResult {
  ok: boolean;
  code: ClientOperationCode;
  message: string;
  client: ClientCreationSummary | null;
}

export interface ProjectCreationRequest {
  clientId: string;
  projectName: string;
  artist: string | null;
}

export interface ProjectCreationSummary {
  clientId: string;
  projectId: string;
  projectName: string;
  artist: string;
}

export type ProjectOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "clientUnavailable"
  | "rejected"
  | "uncertain"
  | "failed";

export interface ProjectOperationResult {
  ok: boolean;
  code: ProjectOperationCode;
  message: string;
  project: ProjectCreationSummary | null;
}
