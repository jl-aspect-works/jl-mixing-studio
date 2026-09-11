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
  rankRows: candidateIds.map(() => []),
});

export const competitionRanks = (rankRows: CandidateRanking["rankRows"]): number[] => {
  let nextRank = 1;
  return rankRows.flatMap((row) => {
    if (row.length === 0) return [];
    const rank = nextRank;
    nextRank += row.length;
    return [rank];
  });
};

export const rankingIsComplete = (ranking: CandidateRanking): boolean => {
  if (ranking.unranked.length > 0) return false;
  const occupiedSlots = ranking.rankRows.flatMap((row, index) => row.length > 0 ? [index + 1] : []);
  const expectedRanks = competitionRanks(ranking.rankRows);
  return occupiedSlots.length > 0
    && occupiedSlots.every((slot, index) => slot === expectedRanks[index]);
};

export const noPreferenceRanking = (candidateIds: readonly string[]): CandidateRanking => ({
  unranked: [],
  rankRows: [[...candidateIds], ...candidateIds.slice(1).map(() => [])],
});

export const rankingDestinationForSlot = (
  ranking: CandidateRanking,
  slotNumber: number,
): RankingDestination => {
  const slotIndex = Math.max(0, slotNumber - 1);
  return ranking.rankRows[slotIndex]?.length > 0
    ? { kind: "tie", index: slotIndex }
    : { kind: "newRow", index: slotIndex };
};

export const shortcutRank = (
  event: Pick<KeyboardEvent, "key" | "target" | "metaKey" | "ctrlKey" | "altKey">,
  candidateCount: number,
): number | null => {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const target = event.target;
  if (target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
  )) return null;
  if (!/^\d$/.test(event.key) || event.key === "0") return null;
  const rank = Number(event.key);
  return rank <= Math.min(candidateCount, 9) ? rank : null;
};

export const moveCandidate = (
  ranking: CandidateRanking,
  candidateId: string,
  destination: RankingDestination,
): CandidateRanking => {
  const sourceRowIndex = ranking.rankRows.findIndex((row) => row.includes(candidateId));
  const sourceRow = sourceRowIndex >= 0 ? ranking.rankRows[sourceRowIndex] : null;
  if (!ranking.unranked.includes(candidateId) && !sourceRow) return ranking;
  if (destination.kind === "tie" && destination.index === sourceRowIndex) return ranking;

  const unranked = ranking.unranked.filter((id) => id !== candidateId);
  const rankRows = ranking.rankRows
    .map((row) => row.filter((id) => id !== candidateId))
    .map((row) => [...row]);

  if (destination.kind === "unranked") return {
    unranked: [...unranked, candidateId],
    rankRows,
  };

  let targetIndex = destination.index;
  targetIndex = Math.max(0, targetIndex);
  while (rankRows.length <= targetIndex) rankRows.push([]);

  if (destination.kind === "tie") {
    rankRows[targetIndex] = [...rankRows[targetIndex], candidateId];
  } else {
    rankRows[targetIndex] = [candidateId];
  }
  return { unranked, rankRows };
};
