import { invoke } from "@tauri-apps/api/core";
import type {
  CompleteComparisonSessionRequest,
  CompletedComparisonCandidate,
  CompletedComparisonRegionResult,
  CompletedComparisonSession,
  CompletedRegionSnapshot,
  ComparisonDocument,
  ComparisonLoudnessResult,
  ComparisonResultsData,
  ComparisonSetupData,
  CumulativeStanding,
  ProjectRegion,
  RegionalCumulativeStandings,
} from "./models";

type ProjectIdentity = { clientId: string; projectId: string };
type RegionValues = ProjectIdentity & { name: string; startSeconds: number; endSeconds: number };

type StoredRegion = {
  region_id: string;
  name: string;
  start_seconds: number;
  end_seconds: number | null;
  built_in: boolean;
};

type StoredCompletedCandidate = {
  revision_id: string;
  revision_number: number;
  blind_id: string;
  integrated_lufs: number | null;
  applied_gain_db: number | null;
  region_loudness?: Record<string, { integrated_lufs: number; applied_gain_db: number }>;
};

type StoredRegionSnapshot = {
  region_id: string;
  name: string;
  start_seconds: number;
  end_seconds: number | null;
};

type StoredCompletedRegionResult = {
  region: StoredRegionSnapshot;
  rank_rows: string[][];
  notes: Record<string, string>;
};

type StoredCompletedSession = {
  session_id: string;
  completed_at: string;
  candidates: StoredCompletedCandidate[];
  regions: StoredCompletedRegionResult[];
  loudness_match: boolean;
  region_loudness_match?: boolean;
};

type StoredDocument = {
  schema_version: number;
  regions: StoredRegion[];
  completed_sessions: StoredCompletedSession[];
};

type StoredSetup = Omit<ComparisonSetupData, "document"> & { document: StoredDocument };
type StoredLoudnessCandidate = {
  revision_id: string;
  revision_number: number;
  relative_path: string;
  integrated_lufs: number;
  applied_gain_db: number;
  cache_state: "analyzed" | "reused";
};
type StoredLoudnessResult = { candidates: StoredLoudnessCandidate[]; regions?: { region_id: string; candidates: StoredLoudnessCandidate[] }[] };
type StoredCumulativeStanding = {
  revision_id: string;
  revision_number: number;
  average_placement: number;
  contributing_sessions: number;
};
type StoredRegionalStandings = {
  region: StoredRegionSnapshot;
  standings: StoredCumulativeStanding[];
};
type StoredComparisonResults = {
  document: StoredDocument;
  full_song_standings: StoredCumulativeStanding[];
  regional_standings: StoredRegionalStandings[];
};

const projectRegion = (region: StoredRegion): ProjectRegion => ({
  regionId: region.region_id,
  name: region.name,
  startSeconds: region.start_seconds,
  endSeconds: region.end_seconds,
  builtIn: region.built_in,
});

const regionSnapshot = (region: StoredRegionSnapshot): CompletedRegionSnapshot => ({
  regionId: region.region_id,
  name: region.name,
  startSeconds: region.start_seconds,
  endSeconds: region.end_seconds,
});

const completedCandidate = (candidate: StoredCompletedCandidate): CompletedComparisonCandidate => ({
  revisionId: candidate.revision_id,
  revisionNumber: candidate.revision_number,
  blindId: candidate.blind_id,
  integratedLufs: candidate.integrated_lufs,
  appliedGainDb: candidate.applied_gain_db,
  regionLoudness: Object.fromEntries(Object.entries(candidate.region_loudness ?? {}).map(([id, value]) => [id, {
    integratedLufs: value.integrated_lufs, appliedGainDb: value.applied_gain_db,
  }])),
});

const completedRegionResult = (result: StoredCompletedRegionResult): CompletedComparisonRegionResult => ({
  region: regionSnapshot(result.region),
  rankRows: result.rank_rows,
  notes: result.notes,
});

const completedSession = (session: StoredCompletedSession): CompletedComparisonSession => ({
  sessionId: session.session_id,
  completedAt: session.completed_at,
  candidates: session.candidates.map(completedCandidate),
  regions: session.regions.map(completedRegionResult),
  loudnessMatch: session.loudness_match,
  regionLoudnessMatch: session.region_loudness_match ?? false,
});

const comparisonDocument = (document: StoredDocument): ComparisonDocument => ({
  schemaVersion: document.schema_version,
  regions: document.regions.map(projectRegion),
  completedSessions: document.completed_sessions.map(completedSession),
});

const cumulativeStanding = (standing: StoredCumulativeStanding): CumulativeStanding => ({
  revisionId: standing.revision_id,
  revisionNumber: standing.revision_number,
  averagePlacement: standing.average_placement,
  contributingSessions: standing.contributing_sessions,
});

const regionalCumulativeStandings = (region: StoredRegionalStandings): RegionalCumulativeStandings => ({
  region: regionSnapshot(region.region),
  standings: region.standings.map(cumulativeStanding),
});

const toStoredCompleteSessionRequest = (request: CompleteComparisonSessionRequest) => ({
  clientId: request.clientId,
  projectId: request.projectId,
  candidates: request.candidates.map((candidate) => ({
    revisionId: candidate.revisionId,
    revisionNumber: candidate.revisionNumber,
    blindId: candidate.blindId,
    integratedLufs: candidate.integratedLufs,
    appliedGainDb: candidate.appliedGainDb,
    regionLoudness: Object.fromEntries(Object.entries(candidate.regionLoudness ?? {}).map(([id, value]) => [id, {
      integratedLufs: value.integratedLufs, appliedGainDb: value.appliedGainDb,
    }])),
  })),
  regions: request.regions.map((result) => ({
    region: {
      regionId: result.region.regionId,
      name: result.region.name,
      startSeconds: result.region.startSeconds,
      endSeconds: result.region.endSeconds,
    },
    rankRows: result.rankRows,
    notes: result.notes,
  })),
  loudnessMatch: request.loudnessMatch,
  regionLoudnessMatch: request.regionLoudnessMatch ?? false,
});

export const getComparisonSetup = (request: ProjectIdentity) =>
  invoke<StoredSetup>("get_comparison_setup", { request })
    .then((setup): ComparisonSetupData => ({ ...setup, document: comparisonDocument(setup.document) }));

export const addComparisonRegion = (request: RegionValues) =>
  invoke<StoredRegion>("add_comparison_region", { request }).then(projectRegion);

export const updateComparisonRegion = (request: RegionValues & { regionId: string }) =>
  invoke<StoredRegion>("update_comparison_region", { request }).then(projectRegion);

export const deleteComparisonRegion = (request: ProjectIdentity & { regionId: string }) =>
  invoke<StoredDocument>("delete_comparison_region", { request }).then(comparisonDocument);

export const getComparisonResults = (request: ProjectIdentity) =>
  invoke<StoredComparisonResults>("get_comparison_results", { request })
    .then((results): ComparisonResultsData => ({
      document: comparisonDocument(results.document),
      fullSongStandings: results.full_song_standings.map(cumulativeStanding),
      regionalStandings: results.regional_standings.map(regionalCumulativeStandings),
    }));

export const completeComparisonSession = (request: CompleteComparisonSessionRequest) =>
  invoke<StoredCompletedSession>("complete_comparison_session", { request: toStoredCompleteSessionRequest(request) })
    .then(completedSession);

export const deleteComparisonSession = (request: ProjectIdentity & { sessionId: string }) =>
  invoke<StoredComparisonResults>("delete_comparison_session", { request })
    .then((results): ComparisonResultsData => ({
      document: comparisonDocument(results.document),
      fullSongStandings: results.full_song_standings.map(cumulativeStanding),
      regionalStandings: results.regional_standings.map(regionalCumulativeStandings),
    }));

export const clearComparisonHistory = (request: ProjectIdentity) =>
  invoke<StoredComparisonResults>("clear_comparison_history", { request })
    .then((results): ComparisonResultsData => ({
      document: comparisonDocument(results.document),
      fullSongStandings: results.full_song_standings.map(cumulativeStanding),
      regionalStandings: results.regional_standings.map(regionalCumulativeStandings),
    }));

export const analyzeComparisonLoudness = (
  request: ProjectIdentity & { candidates: { revisionId: string; revisionNumber: number; relativePath: string }[]; regions?: ProjectRegion[] },
) =>
  invoke<StoredLoudnessResult>("analyze_comparison_loudness", { request }).then((result): ComparisonLoudnessResult => ({
    candidates: result.candidates.map((candidate) => ({
      revisionId: candidate.revision_id,
      revisionNumber: candidate.revision_number,
      relativePath: candidate.relative_path,
      integratedLufs: candidate.integrated_lufs,
      appliedGainDb: candidate.applied_gain_db,
      cacheState: candidate.cache_state,
    })),
    regions: result.regions?.map((region) => ({ regionId: region.region_id, candidates: region.candidates.map((candidate) => ({
      revisionId: candidate.revision_id, revisionNumber: candidate.revision_number,
      relativePath: candidate.relative_path, integratedLufs: candidate.integrated_lufs,
      appliedGainDb: candidate.applied_gain_db, cacheState: candidate.cache_state,
    })) })),
  }));
