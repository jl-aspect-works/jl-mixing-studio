import { useEffect, useMemo, useState } from "react";
import type { ClientSummary, ProjectSummary } from "../types";
import {
  addComparisonRegion,
  deleteComparisonRegion,
  getComparisonSetup,
  updateComparisonRegion,
} from "./comparisonService";
import type {
  ComparisonSetupData,
  FrozenComparisonSession,
  ProjectRegion,
  RegionDraft,
} from "./models";
import {
  formatTimestamp,
  freezeComparisonSession,
  MAX_SHORTCUT_CANDIDATES,
  parseTimestamp,
} from "./session";

const emptyDraft: RegionDraft = { regionId: null, name: "", start: "0:00", end: "" };

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : typeof error === "string" ? error : fallback;

export function ComparisonSetup({
  client,
  project,
  onCancel,
  onStart,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  onCancel: () => void;
  onStart: (session: FrozenComparisonSession) => void;
}) {
  const [setup, setSetup] = useState<ComparisonSetupData | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set(["full-song"]));
  const [loudnessMatch, setLoudnessMatch] = useState(true);
  const [timelineConfirmed, setTimelineConfirmed] = useState(false);
  const [draft, setDraft] = useState<RegionDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getComparisonSetup({ clientId: client.clientId, projectId: project.projectId })
      .then((value) => { if (!cancelled) setSetup(value); })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason, "Comparison setup could not be loaded.")); });
    return () => { cancelled = true; };
  }, [client.clientId, project.projectId]);

  const candidates = useMemo(
    () => [...(setup?.candidates ?? [])].sort((left, right) => right.revisionNumber - left.revisionNumber),
    [setup?.candidates],
  );
  const selectedCandidateValues = candidates.filter((candidate) => selectedCandidates.has(candidate.revisionId));
  const selectedRegionValues = (setup?.document.regions ?? []).filter((region) => selectedRegions.has(region.regionId));
  const canStart = selectedCandidateValues.length >= 2
    && selectedCandidateValues.length <= MAX_SHORTCUT_CANDIDATES
    && selectedRegionValues.length > 0
    && timelineConfirmed
    && !busy;

  const toggle = (values: Set<string>, value: string, checked: boolean) => {
    const next = new Set(values);
    if (checked) next.add(value); else next.delete(value);
    return next;
  };

  const beginEdit = (region: ProjectRegion) => setDraft({
    regionId: region.regionId,
    name: region.name,
    start: formatTimestamp(region.startSeconds),
    end: region.endSeconds === null ? "" : formatTimestamp(region.endSeconds),
  });

  const saveRegion = async () => {
    const startSeconds = parseTimestamp(draft.start);
    const endSeconds = parseTimestamp(draft.end);
    if (!draft.name.trim() || startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      setError("Enter a region name and valid start/end timestamps with the end after the start.");
      return;
    }
    setBusy(true);
    setError(null);
    const identity = { clientId: client.clientId, projectId: project.projectId };
    try {
      const saved = draft.regionId
        ? await updateComparisonRegion({ ...identity, regionId: draft.regionId, name: draft.name.trim(), startSeconds, endSeconds })
        : await addComparisonRegion({ ...identity, name: draft.name.trim(), startSeconds, endSeconds });
      setSetup((current) => current ? {
        ...current,
        document: {
          ...current.document,
          regions: draft.regionId
            ? current.document.regions.map((region) => region.regionId === saved.regionId ? saved : region)
            : [...current.document.regions, saved],
        },
      } : current);
      setSelectedRegions((current) => new Set(current).add(saved.regionId));
      setDraft(emptyDraft);
    } catch (reason) {
      setError(errorMessage(reason, "The comparison region could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const removeRegion = async (region: ProjectRegion) => {
    if (!window.confirm(`Delete ${region.name}? Completed comparison history will keep its saved snapshot.`)) return;
    setBusy(true);
    setError(null);
    try {
      const document = await deleteComparisonRegion({
        clientId: client.clientId,
        projectId: project.projectId,
        regionId: region.regionId,
      });
      setSetup((current) => current ? { ...current, document } : current);
      setSelectedRegions((current) => toggle(current, region.regionId, false));
      if (draft.regionId === region.regionId) setDraft(emptyDraft);
    } catch (reason) {
      setError(errorMessage(reason, "The comparison region could not be deleted."));
    } finally {
      setBusy(false);
    }
  };

  if (!setup && !error) return <section className="comparison-loading" aria-live="polite">Checking revision eligibility and project regions…</section>;
  if (!setup) return <section className="comparison-loading error" role="alert">{error}<button type="button" className="secondary" onClick={onCancel}>Back to Revision History</button></section>;

  return <section className="comparison-setup" aria-labelledby="comparison-setup-title">
    <header className="comparison-screen-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-setup-title">New Comparison</h2><p>{project.projectName}</p></div>
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
    </header>
    {error && <div className="inline-notice error" role="alert">{error}</div>}
    <div className="comparison-setup-grid">
      <section className="panel" aria-labelledby="comparison-candidates-title">
        <h3 id="comparison-candidates-title">1. Select revisions</h3>
        <p>Choose 2–26 normal revisions. Variants and revisions without a playable primary file are unavailable.</p>
        <div className="comparison-choice-list">
          {candidates.map((candidate) => <label key={candidate.revisionId} className={!candidate.eligible ? "unavailable" : ""}>
            <input type="checkbox" checked={selectedCandidates.has(candidate.revisionId)} disabled={!candidate.eligible} onChange={(event) => setSelectedCandidates((current) => toggle(current, candidate.revisionId, event.target.checked))} />
            <span><strong>Revision {String(candidate.revisionNumber).padStart(2, "0")}</strong>{candidate.reason && <small>{candidate.reason}</small>}</span>
          </label>)}
        </div>
      </section>
      <section className="panel" aria-labelledby="comparison-regions-title">
        <h3 id="comparison-regions-title">2. Select and manage regions</h3>
        <div className="comparison-choice-list">
          {setup.document.regions.map((region) => <div key={region.regionId} className="comparison-region-row">
            <label>
              <input type="checkbox" checked={selectedRegions.has(region.regionId)} disabled={region.builtIn} onChange={(event) => setSelectedRegions((current) => toggle(current, region.regionId, event.target.checked))} />
              <span><strong>{region.name}</strong><small>{formatTimestamp(region.startSeconds)} – {region.endSeconds === null ? "End" : formatTimestamp(region.endSeconds)}</small></span>
            </label>
            {!region.builtIn && <span className="comparison-region-actions"><button type="button" className="text-button" onClick={() => beginEdit(region)}>Edit</button><button type="button" className="text-button danger" onClick={() => void removeRegion(region)}>Delete</button></span>}
          </div>)}
        </div>
        <div className="comparison-region-editor">
          <h4>{draft.regionId ? "Edit region" : "Add region"}</h4>
          <label>Name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Start<input aria-label="Region start" placeholder="0:00" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End<input aria-label="Region end" placeholder="0:30" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label>
          <button type="button" className="secondary" disabled={busy} onClick={() => void saveRegion()}>{draft.regionId ? "Save Region" : "Add Region"}</button>
          {draft.regionId && <button type="button" className="text-button" onClick={() => setDraft(emptyDraft)}>Cancel edit</button>}
        </div>
      </section>
    </div>
    <section className="panel comparison-session-options" aria-labelledby="comparison-options-title">
      <h3 id="comparison-options-title">3. Session options</h3>
      <label className="comparison-toggle"><input type="checkbox" checked={loudnessMatch} onChange={(event) => setLoudnessMatch(event.target.checked)} /><span><strong>Loudness Match</strong><small>On by default; this choice is frozen when the session starts.</small></span></label>
      <label className="comparison-toggle"><input type="checkbox" checked={timelineConfirmed} onChange={(event) => setTimelineConfirmed(event.target.checked)} /><span><strong>Compatible project timeline</strong><small>I confirm the selected revisions use the same song structure and the selected timestamps describe equivalent material.</small></span></label>
    </section>
    <footer className="comparison-setup-footer"><span>{selectedCandidateValues.length} candidates · {selectedRegionValues.length} regions</span><button type="button" disabled={!canStart} onClick={() => onStart(freezeComparisonSession(selectedCandidateValues, selectedRegionValues, loudnessMatch))}>Start Comparison</button></footer>
  </section>;
}
