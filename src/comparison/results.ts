import type {
  CompletedComparisonCandidate,
  CompletedComparisonRegionResult,
  CompletedComparisonSession,
  CumulativeStanding,
  FrozenComparisonSession,
} from "./models";
import type { CandidateRanking } from "./ranking";

export const completedCandidatesFromSession = (
  session: FrozenComparisonSession,
): CompletedComparisonCandidate[] => session.candidates.map((candidate) => ({
  revisionId: candidate.revisionId,
  revisionNumber: candidate.revisionNumber,
  blindId: candidate.blindId,
  integratedLufs: candidate.integratedLufs,
  appliedGainDb: candidate.appliedGainDb,
}));

export const completedRegionResultsFromRankings = (
  session: FrozenComparisonSession,
  rankings: Record<string, CandidateRanking>,
  notes: Record<string, string>,
) => {
  const revisionByBlind = new Map(session.candidates.map((candidate) => [candidate.blindId, candidate.revisionId]));
  return session.regions.map((region) => ({
    region: {
      regionId: region.regionId,
      name: region.name,
      startSeconds: region.startSeconds,
      endSeconds: region.endSeconds,
    },
    rankRows: rankings[region.regionId].rankRows
      .map((row) => row.map((blindId) => revisionByBlind.get(blindId) ?? blindId))
      .filter((row) => row.length > 0),
    notes: Object.fromEntries(session.candidates.flatMap((candidate) => {
      const value = notes[`${region.regionId}:${candidate.blindId}`]?.trim();
      return value ? [[candidate.revisionId, value]] : [];
    })),
  }));
};

export const sessionRegionWinner = (
  result: CompletedComparisonRegionResult,
): string | null => result.rankRows[0]?.[0] ?? null;

export const sessionFullSongWinner = (
  session: CompletedComparisonSession,
): string | null => {
  const result = session.regions.find((region) => region.region.regionId === "full-song");
  return result ? sessionRegionWinner(result) : null;
};

export const cumulativeTopRevisionId = (
  standings: readonly CumulativeStanding[],
): string | null => standings[0]?.revisionId ?? null;
