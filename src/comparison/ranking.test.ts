import { describe, expect, it } from "vitest";
import {
  competitionRanks,
  initialRanking,
  moveCandidate,
  noPreferenceRanking,
  rankingIsComplete,
} from "./ranking";

describe("comparison ranking", () => {
  it("starts every candidate explicitly unranked", () => {
    const ranking = initialRanking(["A", "B"]);
    expect(ranking).toEqual({ unranked: ["A", "B"], rankRows: [] });
    expect(rankingIsComplete(ranking)).toBe(false);
  });

  it("creates separate rows and ties with competition rank numbering", () => {
    let ranking = initialRanking(["A", "B", "C", "D"]);
    ranking = moveCandidate(ranking, "B", { kind: "newRow", index: 0 });
    ranking = moveCandidate(ranking, "D", { kind: "newRow", index: 1 });
    ranking = moveCandidate(ranking, "C", { kind: "tie", index: 1 });
    ranking = moveCandidate(ranking, "A", { kind: "newRow", index: 2 });

    expect(ranking.rankRows).toEqual([["B"], ["D", "C"], ["A"]]);
    expect(competitionRanks(ranking.rankRows)).toEqual([1, 2, 4]);
    expect(rankingIsComplete(ranking)).toBe(true);
  });

  it("splits a tied candidate and recalculates five-candidate ranks", () => {
    let ranking = noPreferenceRanking(["A", "B", "C", "D", "E"]);
    ranking = moveCandidate(ranking, "A", { kind: "newRow", index: 0 });
    ranking = moveCandidate(ranking, "E", { kind: "newRow", index: 2 });

    expect(ranking.rankRows).toEqual([["A"], ["B", "C", "D"], ["E"]]);
    expect(competitionRanks(ranking.rankRows)).toEqual([1, 2, 5]);
  });

  it("returns a ranked candidate to Unranked", () => {
    const ranking = moveCandidate(noPreferenceRanking(["A", "B", "C"]), "B", { kind: "unranked" });
    expect(ranking).toEqual({ unranked: ["B"], rankRows: [["A", "C"]] });
    expect(rankingIsComplete(ranking)).toBe(false);
  });
});
