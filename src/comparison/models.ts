export type ProjectRegion = {
  regionId: string;
  name: string;
  startSeconds: number;
  endSeconds: number | null;
  builtIn: boolean;
};

export type ComparisonDocument = {
  schemaVersion: number;
  regions: ProjectRegion[];
  completedSessions: unknown[];
};

export type ComparisonCandidateAvailability = {
  revisionId: string;
  revisionNumber: number;
  eligible: boolean;
  reason: string | null;
};

export type ComparisonSetupData = {
  document: ComparisonDocument;
  candidates: ComparisonCandidateAvailability[];
};

export type FrozenComparisonCandidate = {
  revisionId: string;
  revisionNumber: number;
  blindId: string;
};

export type FrozenComparisonSession = {
  candidates: readonly FrozenComparisonCandidate[];
  regions: readonly ProjectRegion[];
  loudnessMatch: boolean;
};

export type RegionDraft = {
  regionId: string | null;
  name: string;
  start: string;
  end: string;
};
