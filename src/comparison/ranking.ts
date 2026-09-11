export type CandidateRanking = {
  unranked: readonly string[];
  rankRows: readonly (readonly string[])[];
};

export type RankingDestination =
  | { kind: "unranked" }
  | { kind: "newRow"; index: number }
  | { kind: "tie"; index: number };

export const initialRanking = (candidateIds: readonly string[]): CandidateRanking => ({
  unranked: [...candidateIds],
  rankRows: [],
});

export const competitionRanks = (rankRows: CandidateRanking["rankRows"]): number[] => {
  let nextRank = 1;
  return rankRows.map((row) => {
    const rank = nextRank;
    nextRank += row.length;
    return rank;
  });
};

export const rankingIsComplete = (ranking: CandidateRanking): boolean => (
  ranking.unranked.length === 0 && ranking.rankRows.length > 0
);

export const noPreferenceRanking = (candidateIds: readonly string[]): CandidateRanking => ({
  unranked: [],
  rankRows: [[...candidateIds]],
});

export const moveCandidate = (
  ranking: CandidateRanking,
  candidateId: string,
  destination: RankingDestination,
): CandidateRanking => {
  const sourceRowIndex = ranking.rankRows.findIndex((row) => row.includes(candidateId));
  const sourceRow = sourceRowIndex >= 0 ? ranking.rankRows[sourceRowIndex] : null;
  if (!ranking.unranked.includes(candidateId) && !sourceRow) return ranking;
  if (destination.kind === "tie" && destination.index === sourceRowIndex) return ranking;

  const removedWholeRow = sourceRow?.length === 1;
  const unranked = ranking.unranked.filter((id) => id !== candidateId);
  const rankRows = ranking.rankRows
    .map((row) => row.filter((id) => id !== candidateId))
    .filter((row) => row.length > 0)
    .map((row) => [...row]);

  if (destination.kind === "unranked") return {
    unranked: [...unranked, candidateId],
    rankRows,
  };

  let targetIndex = destination.index;
  if (removedWholeRow && sourceRowIndex < destination.index) targetIndex -= 1;
  targetIndex = Math.max(0, Math.min(targetIndex, rankRows.length));

  if (destination.kind === "tie" && targetIndex < rankRows.length) {
    rankRows[targetIndex] = [...rankRows[targetIndex], candidateId];
  } else {
    rankRows.splice(targetIndex, 0, [candidateId]);
  }
  return { unranked, rankRows };
};
