export interface DeliveryStatusRequest {
  clientId: string;
  projectId: string;
}

export interface DeliveryPackageDeleteRequest extends DeliveryStatusRequest {
  zipName: string;
}

export interface ManagedDeliveryIssue {
  code: string;
  message: string;
  path: string | null;
}

export interface ManagedDeliveryRevisions {
  current: number;
  approved: number | null;
  delivered: number | null;
  source: number | null;
}

export interface ManagedDeliverableStatus {
  path: string;
  deliverableType: string | null;
  sizeBytes: number | null;
  expectedSha256: string | null;
  actualSha256: string | null;
  status: "current" | "missing" | "mismatch" | "unsafe" | "unavailable" | string;
}

export interface ManagedDeliveryNotesStatus {
  path: string;
  present: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
}

export interface ManagedDeliveryPackageStatus {
  name: string;
  path: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
  status: "current" | "stale" | "invalid" | "unsafe" | string;
  issues: ManagedDeliveryIssue[];
}

export interface ManagedDeliveryStatus {
  deliveryPath: string;
  deliveryManifestPath: string;
  state: "not_created" | "ready" | "needs_attention" | string;
  revisions: ManagedDeliveryRevisions;
  deliverables: ManagedDeliverableStatus[];
  deliverableCount: number;
  untracked: string[];
  issues: ManagedDeliveryIssue[];
  notes: ManagedDeliveryNotesStatus;
  packages: ManagedDeliveryPackageStatus[];
  packageState: "none" | "current" | "stale" | "attention" | string;
  currentPackage: ManagedDeliveryPackageStatus | null;
}

export interface DeliveryStatusResult {
  ok: boolean;
  message: string;
  delivery: ManagedDeliveryStatus | null;
}
