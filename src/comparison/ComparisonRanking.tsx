import { useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import {
  moveCandidate,
  noPreferenceRanking,
  rankingDestinationForSlot,
  rankingIsComplete,
  type CandidateRanking,
  type RankingDestination,
} from "./ranking";

function CandidatePlacement({
  candidateId,
  ranking,
  active,
  onChoose,
  onMove,
  slotCount,
  onDragStart,
}: {
  candidateId: string;
  ranking: CandidateRanking;
  active: boolean;
  onChoose: () => void;
  onMove: (destination: RankingDestination) => void;
  slotCount: number;
  onDragStart: () => void;
}) {
  const move = (value: string) => {
    if (value === "unranked") onMove({ kind: "unranked" });
    else {
      onMove(rankingDestinationForSlot(ranking, Number(value.split(":")[1])));
    }
  };

  return <div className={`comparison-ranking-candidate${active ? " active" : ""}`} draggable onDragStart={onDragStart}>
    <button type="button" className="comparison-candidate-chip" aria-pressed={active} onClick={onChoose} title={`Select Candidate ${candidateId}`}><span aria-hidden="true">⠿</span>{candidateId}</button>
    <select aria-label={`Ranking destination for Candidate ${candidateId}`} value="" onChange={(event) => move(event.target.value)}>
      <option value="" disabled>Move…</option>
      <option value="unranked">Move to Unranked</option>
      {Array.from({ length: slotCount }, (_, index) => <option key={index + 1} value={`slot:${index + 1}`}>Move to {index + 1}</option>)}
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
  const slots = Array.from({ length: candidateIds.length }, (_, index) => index + 1);
  const place = (candidateId: string, destination: RankingDestination) => onChange(moveCandidate(ranking, candidateId, destination));
  const drop = (destination: RankingDestination) => {
    if (draggedCandidate) place(draggedCandidate, destination);
    setDraggedCandidate(null);
  };
  const candidate = (candidateId: string) => <CandidatePlacement
    key={candidateId}
    candidateId={candidateId}
    ranking={ranking}
    slotCount={candidateIds.length}
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
      <p className="comparison-placeholder">Drop onto a numbered slot. Dropping onto an occupied slot creates a tie.</p>
      <div className="comparison-rank-order" aria-label="Rank ordering">
        {slots.map((slotNumber) => {
          const row = ranking.rankRows[slotNumber - 1];
          const occupied = row && row.length > 0;
          return <div className={`comparison-rank-slot${occupied ? " occupied" : ""}`} key={slotNumber} aria-label={`Rank slot ${slotNumber}`} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(rankingDestinationForSlot(ranking, slotNumber))}>
            <strong>{slotNumber}</strong><div>{occupied ? row.map(candidate) : <span>Drop Candidate {activeCandidate} or press {slotNumber}</span>}</div>
          </div>;
        })}
      </div>
      <small className="comparison-rank-shortcuts">1–{Math.min(candidateIds.length, 9)} keyboard shortcuts rank Candidate {activeCandidate}</small>
      {ranking.unranked.length === 0 && !rankingIsComplete(ranking) && <small className="comparison-rank-validation" role="status">Adjust occupied slots to competition ranking: ties skip the following slot numbers.</small>}
      <button type="button" className="secondary comparison-no-preference" onClick={() => onChange(noPreferenceRanking(candidateIds))}><ActionIcon name="check" />No Preference — tie all at rank 1</button>
    </section>
  </>;
}
