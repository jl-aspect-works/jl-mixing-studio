import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
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
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onDragStart,
  onDragEnd,
}: {
  candidateId: string;
  ranking: CandidateRanking;
  active: boolean;
  onChoose: () => void;
  onMove: (destination: RankingDestination) => void;
  slotCount: number;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector("button")?.focus();
  }, [menuOpen]);

  const openFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    onChoose();
    onOpenMenu();
  };

  const move = (destination: RankingDestination) => {
    onMove(destination);
    onCloseMenu();
  };

  return <div className={`comparison-ranking-candidate${active ? " active" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onBlur={(event) => {
    if (menuOpen && !event.currentTarget.contains(event.relatedTarget)) onCloseMenu();
  }}>
    <button ref={buttonRef} type="button" className="comparison-candidate-chip" draggable aria-pressed={active} aria-haspopup="menu" aria-expanded={menuOpen} aria-description="Drag to rank or right-click for placement options" onClick={onChoose} onContextMenu={(event) => { event.preventDefault(); onChoose(); onOpenMenu(); }} onKeyDown={openFromKeyboard} title={`Select Candidate ${candidateId}`}><span aria-hidden="true">⠿</span>{candidateId}</button>
    {menuOpen && <div ref={menuRef} className="comparison-ranking-menu" role="menu" aria-label={`Move Candidate ${candidateId}`} onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseMenu();
      buttonRef.current?.focus();
    }}>
      <button type="button" role="menuitem" onClick={() => move({ kind: "unranked" })}>Move to Unranked</button>
      {Array.from({ length: slotCount }, (_, index) => <button type="button" role="menuitem" key={index + 1} onClick={() => move(rankingDestinationForSlot(ranking, index + 1))}>Place in slot {index + 1}</button>)}
    </div>}
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
  const [menuCandidate, setMenuCandidate] = useState<string | null>(null);
  const draggedCandidate = useRef<string | null>(null);
  const dragDestination = useRef<RankingDestination | null>(null);
  const slots = Array.from({ length: candidateIds.length }, (_, index) => index + 1);
  const place = (candidateId: string, destination: RankingDestination) => onChange(moveCandidate(ranking, candidateId, destination));
  const drop = (event: DragEvent<HTMLElement>, destination: RankingDestination) => {
    event.preventDefault();
    const candidateId = event.dataTransfer.getData("text/plain") || draggedCandidate.current;
    draggedCandidate.current = null;
    dragDestination.current = null;
    if (candidateId) place(candidateId, destination);
  };
  const finishDrag = (event: DragEvent<HTMLDivElement>) => {
    let destination = dragDestination.current;
    if (typeof document.elementFromPoint === "function") {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-ranking-destination]");
      const value = target?.dataset.rankingDestination;
      if (value === "unranked") destination = { kind: "unranked" };
      else if (value?.startsWith("slot:")) destination = rankingDestinationForSlot(ranking, Number(value.slice(5)));
    }
    const candidateId = draggedCandidate.current;
    draggedCandidate.current = null;
    dragDestination.current = null;
    if (candidateId && destination) place(candidateId, destination);
  };
  const candidate = (candidateId: string) => <CandidatePlacement
    key={candidateId}
    candidateId={candidateId}
    ranking={ranking}
    slotCount={candidateIds.length}
    menuOpen={menuCandidate === candidateId}
    onOpenMenu={() => setMenuCandidate(candidateId)}
    onCloseMenu={() => setMenuCandidate(null)}
    active={candidateId === activeCandidate}
    onChoose={() => onSelectCandidate(candidateId)}
    onMove={(destination) => place(candidateId, destination)}
    onDragStart={(event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", candidateId);
      draggedCandidate.current = candidateId;
      dragDestination.current = null;
    }}
    onDragEnd={finishDrag}
  />;

  const prepareDrop = (event: DragEvent<HTMLElement>, destination: RankingDestination) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    dragDestination.current = destination;
  };

  return <>
    <section className="panel comparison-unranked-panel" data-ranking-destination="unranked" aria-labelledby="comparison-unranked-title" onDragEnter={(event) => prepareDrop(event, { kind: "unranked" })} onDragOver={(event) => prepareDrop(event, { kind: "unranked" })} onDrop={(event) => drop(event, { kind: "unranked" })}>
      <h3 id="comparison-unranked-title">Unranked</h3>
      <p className="comparison-placeholder">Drag each candidate into a rank position. Right-click for placement options.</p>
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
          const destination = rankingDestinationForSlot(ranking, slotNumber);
          return <div className={`comparison-rank-slot${occupied ? " occupied" : ""}`} data-ranking-destination={`slot:${slotNumber}`} key={slotNumber} aria-label={`Rank slot ${slotNumber}`} onDragEnter={(event) => prepareDrop(event, destination)} onDragOver={(event) => prepareDrop(event, destination)} onDrop={(event) => drop(event, destination)}>
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
