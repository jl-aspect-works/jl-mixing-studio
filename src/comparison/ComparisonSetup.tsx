import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
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
import { RegionPreview } from "./RegionPreview";
import {
  formatTimestamp,
  freezeComparisonSession,
  MAX_SHORTCUT_CANDIDATES,
  parseTimestamp,
} from "./session";

const emptyDraft = (): RegionDraft => ({ regionId: null, name: "", start: "0:00", end: "0:30" });

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
  const [draft, setDraft] = useState<RegionDraft>(emptyDraft);
  const [editRequest, setEditRequest] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ProjectRegion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateDraftBounds = useCallback((start: string, end: string) => {
    setDraft((current) => ({ ...current, start, end }));
  }, []);
  const [notice, setNotice] = useState<string | null>(null);

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
  const regions = useMemo(
    () => [...(setup?.document.regions ?? [])].sort((left, right) => {
      const startOrder = left.startSeconds - right.startSeconds;
      if (startOrder) return startOrder;
      const leftWidth = left.endSeconds === null ? Number.POSITIVE_INFINITY : left.endSeconds - left.startSeconds;
      const rightWidth = right.endSeconds === null ? Number.POSITIVE_INFINITY : right.endSeconds - right.startSeconds;
      return rightWidth - leftWidth;
    }),
    [setup?.document.regions],
  );
  const selectedRegionValues = regions.filter((region) => selectedRegions.has(region.regionId));
  const canStart = selectedCandidateValues.length >= 2
    && selectedCandidateValues.length <= MAX_SHORTCUT_CANDIDATES
    && selectedRegionValues.length > 0
    && !busy;

  const toggle = (values: Set<string>, value: string, checked: boolean) => {
    const next = new Set(values);
    if (checked) next.add(value); else next.delete(value);
    return next;
  };

  const beginEdit = (region: ProjectRegion) => {
    if (region.builtIn) return;
    setDraft({
      regionId: region.regionId,
      name: region.name,
      start: formatTimestamp(region.startSeconds),
      end: region.endSeconds === null ? "" : formatTimestamp(region.endSeconds),
    });
    setEditRequest((current) => current + 1);
  };

  const saveRegion = async () => {
    const startSeconds = parseTimestamp(draft.start);
    const endSeconds = parseTimestamp(draft.end);
    if (!draft.name.trim() || startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      setError("Enter a region name and valid start/end timestamps with the end after the start.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const identity = { clientId: client.clientId, projectId: project.projectId };
    try {
      const saved = draft.regionId
        ? await updateComparisonRegion({ ...identity, regionId: draft.regionId, name: draft.name.trim(), startSeconds, endSeconds })
        : await addComparisonRegion({ ...identity, name: draft.name.trim(), startSeconds, endSeconds });
      const refreshed = await getComparisonSetup(identity);
      setSetup(refreshed);
      setSelectedRegions((current) => new Set(current).add(saved.regionId));
      setDraft(emptyDraft());
      setNotice(draft.regionId ? "Region updated." : "Region added.");
    } catch (reason) {
      setError(errorMessage(reason, "The comparison region could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const removeRegion = async (region: ProjectRegion) => {
    setBusy(true);
    setError(null);
    try {
      const document = await deleteComparisonRegion({
        clientId: client.clientId,
        projectId: project.projectId,
        regionId: region.regionId,
      });
      const refreshed = await getComparisonSetup({ clientId: client.clientId, projectId: project.projectId });
      setSetup({ ...refreshed, document });
      setSelectedRegions((current) => toggle(current, region.regionId, false));
      if (draft.regionId === region.regionId) setDraft(emptyDraft());
      setPendingDelete(null);
    } catch (reason) {
      setError(errorMessage(reason, "The comparison region could not be deleted."));
    } finally {
      setBusy(false);
    }
  };

  if (!setup && !error) return <section className="comparison-loading" aria-live="polite">Checking revision eligibility and project regions…</section>;
  if (!setup) return <section className="comparison-loading error" role="alert">{error}<button type="button" className="secondary" onClick={onCancel}><ActionIcon name="back" />Back to Revision History</button></section>;

  return <section className="comparison-setup" aria-labelledby="comparison-setup-title">
    <header className="comparison-screen-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-setup-title">New Comparison</h2><p>{project.projectName}</p></div>
      <button type="button" className="secondary" onClick={onCancel}><ActionIcon name="close" />Cancel</button>
    </header>
    {error && <div className="inline-notice error" role="alert">{error}</div>}
    {notice && <div className="inline-notice success" role="status">{notice}</div>}
    <div className="comparison-setup-grid">
      <section className="panel" aria-labelledby="comparison-candidates-title">
        <h3 id="comparison-candidates-title">1. Select revisions</h3>
        <p>Select 2 or more versions to compare. Variants and revisions without playable files are excluded from this list.</p>
        <p><strong>Make sure the selected revisions have the same song structure.</strong></p>
        <div className="comparison-choice-list">
          {candidates.map((candidate) => <label key={candidate.revisionId} className={!candidate.eligible ? "unavailable" : ""}>
            <input type="checkbox" checked={selectedCandidates.has(candidate.revisionId)} disabled={!candidate.eligible} onChange={(event) => setSelectedCandidates((current) => toggle(current, candidate.revisionId, event.target.checked))} />
            <span><strong>Revision {String(candidate.revisionNumber).padStart(2, "0")}</strong>{candidate.reason && <small>{candidate.reason}</small>}</span>
          </label>)}
        </div>
      </section>
      <section className="panel comparison-session-options" aria-labelledby="comparison-options-title">
        <h3 id="comparison-options-title">2. Session options</h3>
        <label className="comparison-toggle"><input type="checkbox" checked={loudnessMatch} onChange={(event) => setLoudnessMatch(event.target.checked)} /><span><strong>Loudness Match</strong><small>Matches the loudness of the revisions being compared.</small></span></label>
      </section>
    </div>
    <section className="panel comparison-regions-panel" aria-labelledby="comparison-regions-title">
        <h3 id="comparison-regions-title">3. Select and manage regions</h3>
        <RegionPreview
          clientId={client.clientId}
          projectId={project.projectId}
          candidates={candidates}
          start={draft.start}
          end={draft.end}
          editRequest={editRequest}
          onBoundsChange={updateDraftBounds}
        />
        <form className="comparison-region-editor" onSubmit={(event) => { event.preventDefault(); void saveRegion(); }}>
          <h4>{draft.regionId ? "Edit region" : "Add region"}</h4>
          <label>Name<input required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Start<input required aria-label="Region start" placeholder="0:00" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End<input required aria-label="Region end" placeholder="0:30" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label>
          <button type="submit" className="secondary" disabled={busy}><ActionIcon name={draft.regionId ? "save" : "add"} />{draft.regionId ? "Save Region" : "Add Region"}</button>
          {draft.regionId && <button type="button" className="text-button" onClick={() => setDraft(emptyDraft())}><ActionIcon name="close" />Cancel edit</button>}
        </form>
        <div className="comparison-choice-list" role="group" aria-label="Available regions">
          {regions.map((region) => <div key={region.regionId} className={`comparison-region-row${draft.regionId === region.regionId ? " editing" : ""}${region.builtIn ? " built-in" : ""}`} role={region.builtIn ? undefined : "button"} tabIndex={region.builtIn ? undefined : 0} onClick={() => beginEdit(region)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); beginEdit(region); } }}>
            <label>
              <input type="checkbox" checked={selectedRegions.has(region.regionId)} disabled={region.builtIn} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedRegions((current) => toggle(current, region.regionId, event.target.checked))} />
              <span><strong>{region.name}</strong><small>{formatTimestamp(region.startSeconds)} – {region.endSeconds === null ? "End" : formatTimestamp(region.endSeconds)}</small></span>
            </label>
            {!region.builtIn && <span className="comparison-region-actions"><button type="button" className="text-button danger icon-only comparison-region-delete" aria-label={`Delete ${region.name}`} title={`Delete ${region.name}`} onClick={(event) => { event.stopPropagation(); setPendingDelete(region); }}><ActionIcon name="delete" /></button></span>}
          </div>)}
        </div>
        {pendingDelete && <div className="inline-notice warning comparison-delete-confirmation" role="alertdialog" aria-label={`Delete ${pendingDelete.name}`}><span>Delete <strong>{pendingDelete.name}</strong>? Completed comparison history will keep its saved snapshot.</span><span><button type="button" className="secondary" onClick={() => setPendingDelete(null)}><ActionIcon name="close" />Keep Region</button><button type="button" className="danger" disabled={busy} onClick={() => void removeRegion(pendingDelete)}><ActionIcon name="delete" />Delete Region</button></span></div>}
    </section>
    <footer className="comparison-setup-footer"><span>{selectedCandidateValues.length} candidates · {selectedRegionValues.length} regions</span><button type="button" disabled={!canStart} onClick={() => onStart(freezeComparisonSession(selectedCandidateValues, selectedRegionValues, loudnessMatch))}><ActionIcon name="play" />Start Comparison</button></footer>
  </section>;
}
