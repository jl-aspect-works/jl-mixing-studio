import { describe, expect, it } from "vitest";
import {
  competitionRanks,
  initialRanking,
  moveCandidate,
  noPreferenceRanking,
  rankingDestinationForSlot,
  rankingIsComplete,
  shortcutRank,
} from "./ranking";

describe("comparison ranking", () => {
  it("starts every candidate explicitly unranked", () => {
    const ranking = initialRanking(["A", "B"]);
    expect(ranking).toEqual({ unranked: ["A", "B"], rankRows: [[], []] });
    expect(rankingIsComplete(ranking)).toBe(false);
  });

  it("creates separate rows and ties with competition rank numbering", () => {
    let ranking = initialRanking(["A", "B", "C", "D"]);
    ranking = moveCandidate(ranking, "B", { kind: "newRow", index: 0 });
    ranking = moveCandidate(ranking, "D", { kind: "newRow", index: 1 });
    ranking = moveCandidate(ranking, "C", { kind: "tie", index: 1 });
    ranking = moveCandidate(ranking, "A", rankingDestinationForSlot(ranking, 4));

    expect(ranking.rankRows).toEqual([["B"], ["D", "C"], [], ["A"]]);
    expect(competitionRanks(ranking.rankRows)).toEqual([1, 2, 4]);
    expect(rankingIsComplete(ranking)).toBe(true);
  });

  it("splits a tied candidate and recalculates five-candidate ranks", () => {
    let ranking = noPreferenceRanking(["A", "B", "C", "D", "E"]);
    ranking = moveCandidate(ranking, "A", rankingDestinationForSlot(ranking, 1));
    ranking = moveCandidate(ranking, "B", rankingDestinationForSlot(ranking, 2));
    ranking = moveCandidate(ranking, "C", rankingDestinationForSlot(ranking, 2));
    ranking = moveCandidate(ranking, "D", rankingDestinationForSlot(ranking, 2));
    ranking = moveCandidate(ranking, "E", rankingDestinationForSlot(ranking, 5));

    expect(ranking.rankRows).toEqual([["A"], ["B", "C", "D"], [], [], ["E"]]);
    expect(competitionRanks(ranking.rankRows)).toEqual([1, 2, 5]);
  });

  it("returns a ranked candidate to Unranked", () => {
    const ranking = moveCandidate(noPreferenceRanking(["A", "B", "C"]), "B", { kind: "unranked" });
    expect(ranking).toEqual({ unranked: ["B"], rankRows: [["A", "C"], [], []] });
    expect(rankingIsComplete(ranking)).toBe(false);
  });

  it("maps numbered slots to a new position or an occupied-rank tie", () => {
    const ranking: ReturnType<typeof initialRanking> = {
      unranked: ["D"],
      rankRows: [["A"], ["B", "C"], [], []],
    };
    expect(rankingDestinationForSlot(ranking, 1)).toEqual({ kind: "tie", index: 0 });
    expect(rankingDestinationForSlot(ranking, 2)).toEqual({ kind: "tie", index: 1 });
    expect(rankingDestinationForSlot(ranking, 3)).toEqual({ kind: "newRow", index: 2 });
    expect(rankingDestinationForSlot(ranking, 4)).toEqual({ kind: "newRow", index: 3 });
  });

  it("accepts bounded number shortcuts outside text-entry controls", () => {
    expect(shortcutRank({ key: "1", target: null, metaKey: false, ctrlKey: false, altKey: false }, 3)).toBe(1);
    expect(shortcutRank({ key: "4", target: null, metaKey: false, ctrlKey: false, altKey: false }, 3)).toBeNull();
    expect(shortcutRank({ key: "1", target: document.createElement("textarea"), metaKey: false, ctrlKey: false, altKey: false }, 3)).toBeNull();
    expect(shortcutRank({ key: "1", target: null, metaKey: false, ctrlKey: true, altKey: false }, 3)).toBeNull();
  });

  it("is complete when every candidate is ranked even when ties leave slots empty", () => {
    expect(rankingIsComplete({ unranked: [], rankRows: [["A", "B"], [], ["C"]] })).toBe(true);
    expect(rankingIsComplete({ unranked: [], rankRows: [["A", "B"], ["C"], []] })).toBe(true);
    expect(rankingIsComplete({ unranked: ["C"], rankRows: [["A", "B"], [], []] })).toBe(false);
  });
});
