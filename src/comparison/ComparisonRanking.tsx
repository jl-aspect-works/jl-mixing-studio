import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
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
  dragging,
  onPointerDragStart,
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
  dragging: boolean;
  onPointerDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const placementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector("button")?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: Event) => {
      if (!placementRef.current?.contains(event.target as Node)) onCloseMenu();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuOpen, onCloseMenu]);

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

  return <div ref={placementRef} className={`comparison-ranking-candidate${active ? " active" : ""}${dragging ? " dragging" : ""}`}>
    <button ref={buttonRef} type="button" className="comparison-candidate-chip" aria-pressed={active} aria-haspopup="menu" aria-expanded={menuOpen} aria-description="Drag to rank or right-click for placement options" onPointerDown={onPointerDragStart} onClick={onChoose} onContextMenu={(event) => { event.preventDefault(); onChoose(); onOpenMenu(); }} onKeyDown={openFromKeyboard} title={`Select Candidate ${candidateId}`}><span aria-hidden="true">⠿</span>{candidateId}</button>
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
  const [draggingCandidate, setDraggingCandidate] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const slots = Array.from({ length: candidateIds.length }, (_, index) => index + 1);
  const place = (candidateId: string, destination: RankingDestination) => onChange(moveCandidate(ranking, candidateId, destination));
  const finishPointerDrag = (destination?: RankingDestination) => {
    const candidateId = draggedCandidate.current;
    draggedCandidate.current = null;
    setDraggingCandidate(null);
    setDragTarget(null);
    setDragPosition(null);
    if (candidateId && destination) place(candidateId, destination);
  };

  useEffect(() => {
    const movePointerDrag = (event: PointerEvent) => {
      if (!draggedCandidate.current) return;
      event.preventDefault();
      setDragPosition({ x: event.clientX, y: event.clientY });
    };
    const cancelPointerDrag = () => finishPointerDrag();
    document.addEventListener("pointermove", movePointerDrag, { passive: false });
    document.addEventListener("pointerup", cancelPointerDrag);
    document.addEventListener("pointercancel", cancelPointerDrag);
    return () => {
      document.removeEventListener("pointermove", movePointerDrag);
      document.removeEventListener("pointerup", cancelPointerDrag);
      document.removeEventListener("pointercancel", cancelPointerDrag);
    };
  });
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
    dragging={draggingCandidate === candidateId}
    onPointerDragStart={(event) => {
      if (typeof event.button === "number" && event.button !== 0) return;
      draggedCandidate.current = candidateId;
      setDraggingCandidate(candidateId);
      setDragTarget(null);
      setDragPosition({ x: event.clientX, y: event.clientY });
    }}
  />;

  return <>
    <section className={`panel comparison-unranked-panel${dragTarget === "unranked" ? " drag-target" : ""}`} aria-labelledby="comparison-unranked-title" onPointerEnter={() => { if (draggedCandidate.current) setDragTarget("unranked"); }} onPointerLeave={() => setDragTarget((current) => current === "unranked" ? null : current)} onPointerUp={(event) => { event.stopPropagation(); finishPointerDrag({ kind: "unranked" }); }}>
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
          return <div className={`comparison-rank-slot${occupied ? " occupied" : ""}${dragTarget === `slot:${slotNumber}` ? " drag-target" : ""}`} key={slotNumber} aria-label={`Rank slot ${slotNumber}`} onPointerEnter={() => { if (draggedCandidate.current) setDragTarget(`slot:${slotNumber}`); }} onPointerLeave={() => setDragTarget((current) => current === `slot:${slotNumber}` ? null : current)} onPointerUp={(event) => { event.stopPropagation(); finishPointerDrag(destination); }}>
            <strong>{slotNumber}</strong><div>{occupied ? row.map(candidate) : <span>Drop Candidate {activeCandidate} or press {slotNumber}</span>}</div>
          </div>;
        })}
      </div>
      <small className="comparison-rank-shortcuts">1–{Math.min(candidateIds.length, 9)} keyboard shortcuts rank Candidate {activeCandidate}</small>
      {ranking.unranked.length === 0 && !rankingIsComplete(ranking) && <small className="comparison-rank-validation" role="status">Adjust occupied slots to competition ranking: ties skip the following slot numbers.</small>}
      <button type="button" className="secondary comparison-no-preference" onClick={() => onChange(noPreferenceRanking(candidateIds))}><ActionIcon name="check" />No Preference — tie all at rank 1</button>
    </section>
    {draggingCandidate && dragPosition && <div className="comparison-candidate-drag-ghost" aria-hidden="true" style={{ left: dragPosition.x, top: dragPosition.y }}><span>⠿</span>{draggingCandidate}</div>}
  </>;
}
