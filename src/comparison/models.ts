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
  completedSessions: CompletedComparisonSession[];
};

export type ComparisonCandidateAvailability = {
  revisionId: string;
  revisionNumber: number;
  eligible: boolean;
  reason: string | null;
  relativePath: string | null;
};

export type ComparisonSetupData = {
  document: ComparisonDocument;
  candidates: ComparisonCandidateAvailability[];
};

export type FrozenComparisonCandidate = {
  revisionId: string;
  revisionNumber: number;
  blindId: string;
  relativePath: string;
  integratedLufs: number | null;
  appliedGainDb: number | null;
};

export type FrozenComparisonSession = {
  candidates: readonly FrozenComparisonCandidate[];
  regions: readonly ProjectRegion[];
  loudnessMatch: boolean;
};

export type CompletedComparisonCandidate = {
  revisionId: string;
  revisionNumber: number;
  blindId: string;
  integratedLufs: number | null;
  appliedGainDb: number | null;
};

export type CompletedRegionSnapshot = {
  regionId: string;
  name: string;
  startSeconds: number;
  endSeconds: number | null;
};

export type CompletedComparisonRegionResult = {
  region: CompletedRegionSnapshot;
  rankRows: string[][];
  notes: Record<string, string>;
};

export type CompletedComparisonSession = {
  sessionId: string;
  completedAt: string;
  candidates: CompletedComparisonCandidate[];
  regions: CompletedComparisonRegionResult[];
  loudnessMatch: boolean;
};

export type CumulativeStanding = {
  revisionId: string;
  revisionNumber: number;
  averagePlacement: number;
  contributingSessions: number;
};

export type RegionalCumulativeStandings = {
  region: CompletedRegionSnapshot;
  standings: CumulativeStanding[];
};

export type ComparisonResultsData = {
  document: ComparisonDocument;
  fullSongStandings: CumulativeStanding[];
  regionalStandings: RegionalCumulativeStandings[];
};

export type CompleteComparisonSessionRequest = {
  clientId: string;
  projectId: string;
  candidates: CompletedComparisonCandidate[];
  regions: {
    region: CompletedRegionSnapshot;
    rankRows: string[][];
    notes: Record<string, string>;
  }[];
  loudnessMatch: boolean;
};

export type ComparisonLoudnessCandidate = {
  revisionId: string;
  revisionNumber: number;
  relativePath: string;
  integratedLufs: number;
  appliedGainDb: number;
  cacheState: "analyzed" | "reused";
};

export type ComparisonLoudnessResult = {
  candidates: ComparisonLoudnessCandidate[];
};

export type RegionDraft = {
  regionId: string | null;
  name: string;
  start: string;
  end: string;
};
