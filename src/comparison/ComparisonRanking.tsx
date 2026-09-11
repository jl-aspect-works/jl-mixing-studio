import { useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import {
  competitionRanks,
  moveCandidate,
  noPreferenceRanking,
  type CandidateRanking,
  type RankingDestination,
} from "./ranking";

function CandidatePlacement({
  candidateId,
  ranking,
  rankNumbers,
  active,
  onChoose,
  onMove,
  onDragStart,
}: {
  candidateId: string;
  ranking: CandidateRanking;
  rankNumbers: readonly number[];
  active: boolean;
  onChoose: () => void;
  onMove: (destination: RankingDestination) => void;
  onDragStart: () => void;
}) {
  const move = (value: string) => {
    if (value === "unranked") onMove({ kind: "unranked" });
    else {
      const [kind, index] = value.split(":");
      onMove({ kind: kind === "tie" ? "tie" : "newRow", index: Number(index) });
    }
  };

  return <div className={`comparison-ranking-candidate${active ? " active" : ""}`} draggable onDragStart={onDragStart}>
    <button type="button" className="comparison-candidate-chip" aria-pressed={active} onClick={onChoose} title={`Select Candidate ${candidateId}`}><span aria-hidden="true">⠿</span>{candidateId}</button>
    <select aria-label={`Ranking destination for Candidate ${candidateId}`} value="" onChange={(event) => move(event.target.value)}>
      <option value="" disabled>Move…</option>
      <option value="unranked">Move to Unranked</option>
      <option value="new:0">Place first</option>
      {ranking.rankRows.map((row, index) => <optgroup key={`${row.join("-")}:${index}`} label={`Rank ${rankNumbers[index]}`}>
        <option value={`tie:${index}`}>Tie at rank {rankNumbers[index]}</option>
        <option value={`new:${index + 1}`}>Place after rank {rankNumbers[index]}</option>
      </optgroup>)}
    </select>
  </div>;
}

export function ComparisonRanking({
  candidateIds,
  ranking,
  activeCandidate,
  onSelectCandidate,
  onChange,
}: {
  candidateIds: readonly string[];
  ranking: CandidateRanking;
  activeCandidate: string;
  onSelectCandidate: (candidateId: string) => void;
  onChange: (ranking: CandidateRanking) => void;
}) {
  const [draggedCandidate, setDraggedCandidate] = useState<string | null>(null);
  const rankNumbers = competitionRanks(ranking.rankRows);
  const place = (candidateId: string, destination: RankingDestination) => onChange(moveCandidate(ranking, candidateId, destination));
  const drop = (destination: RankingDestination) => {
    if (draggedCandidate) place(draggedCandidate, destination);
    setDraggedCandidate(null);
  };
  const candidate = (candidateId: string) => <CandidatePlacement
    key={candidateId}
    candidateId={candidateId}
    ranking={ranking}
    rankNumbers={rankNumbers}
    active={candidateId === activeCandidate}
    onChoose={() => onSelectCandidate(candidateId)}
    onMove={(destination) => place(candidateId, destination)}
    onDragStart={() => setDraggedCandidate(candidateId)}
  />;

  return <>
    <section className="panel comparison-unranked-panel" aria-labelledby="comparison-unranked-title" onDragOver={(event) => event.preventDefault()} onDrop={() => drop({ kind: "unranked" })}>
      <h3 id="comparison-unranked-title">Unranked</h3>
      <p className="comparison-placeholder">Drag each candidate into a rank position.</p>
      <div className="comparison-unranked" aria-label="Unranked candidates">
        {ranking.unranked.length > 0 ? ranking.unranked.map(candidate) : <span className="comparison-empty-pool">All candidates ranked</span>}
      </div>
    </section>

    <section className="panel comparison-rank-panel" aria-labelledby="comparison-rank-order-title">
      <h3 id="comparison-rank-order-title">Rank Ordering</h3>
      <p className="comparison-placeholder">Drop between rows for a new position or onto a row to create a tie.</p>
      <div className="comparison-rank-order" aria-label="Rank ordering">
        <div className="comparison-rank-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={() => drop({ kind: "newRow", index: 0 })}>Place first</div>
        {ranking.rankRows.map((row, index) => <div className="comparison-rank-entry" key={`${row.join("-")}:${index}`}>
          <div className="comparison-rank-row" aria-label={`Rank ${rankNumbers[index]}`} onDragOver={(event) => event.preventDefault()} onDrop={() => drop({ kind: "tie", index })}>
            <strong>{rankNumbers[index]}</strong><div>{row.map(candidate)}</div>
          </div>
          <div className="comparison-rank-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={() => drop({ kind: "newRow", index: index + 1 })}>Place after rank {rankNumbers[index]}</div>
        </div>)}
        {ranking.rankRows.length === 0 && <div className="comparison-empty-ranking">No candidates ranked</div>}
      </div>
      <button type="button" className="secondary comparison-no-preference" onClick={() => onChange(noPreferenceRanking(candidateIds))}><ActionIcon name="check" />No Preference — tie all at rank 1</button>
    </section>
  </>;
}
