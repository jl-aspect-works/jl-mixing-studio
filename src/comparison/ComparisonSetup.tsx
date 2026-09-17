import { ComparisonLoading } from "./ComparisonLoading";
import { measureComparison } from "./performance";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionIcon } from "../components/ActionIcon";
import type { ClientSummary, ProjectSummary } from "../types";
import {
  addComparisonRegion,
  analyzeComparisonLoudness,
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

const sameDraft = (left: RegionDraft, right: RegionDraft) =>
  left.regionId === right.regionId
  && left.name === right.name
  && left.start === right.start
  && left.end === right.end;

const upsertRegion = (regions: readonly ProjectRegion[], saved: ProjectRegion) =>
  regions.some((region) => region.regionId === saved.regionId)
    ? regions.map((region) => region.regionId === saved.regionId ? saved : region)
    : [...regions, saved];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : typeof error === "string" ? error : fallback;

const nextRegionName = (regions: readonly ProjectRegion[]) => {
  const customCount = regions.filter((region) => !region.builtIn).length + 1;
  return `Region ${String(customCount).padStart(2, "0")}`;
};

const isRegionPreviewTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest(".comparison-region-preview"));

export function ComparisonSetup({
  client,
  project,
  onCancel,
  onStart,
  onShowResults,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  onCancel: () => void;
  onStart: (session: FrozenComparisonSession) => void;
  onShowResults: () => void;
}) {
  const [setup, setSetup] = useState<ComparisonSetupData | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set(["full-song"]));
  const [loudnessMatch, setLoudnessMatch] = useState(true);
  const [draft, setDraft] = useState<RegionDraft>(emptyDraft);
  const [editRequest, setEditRequest] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ProjectRegion | null>(null);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateDraftBounds = useCallback((start: string, end: string) => {
    setDraft((current) => ({ ...current, start, end }));
  }, []);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      measureComparison("setup", () => getComparisonSetup({ clientId: client.clientId, projectId: project.projectId }))
        .then((value) => { if (!cancelled) setSetup(value); })
        .catch((reason) => { if (!cancelled) setError(errorMessage(reason, "Comparison setup could not be loaded.")); });
    });
    return () => { cancelled = true; };
  }, [client.clientId, project.projectId]);

  const candidates = useMemo(
    () => [...(setup?.candidates ?? [])].sort((left, right) => right.revisionNumber - left.revisionNumber),
    [setup?.candidates],
  );
  const revisionDescriptions = useMemo(
    () => new Map(project.revisions.map((revision) => [revision.revisionId, revision.description])),
    [project.revisions],
  );
  const eligibleCandidateIds = useMemo(
    () => candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.revisionId),
    [candidates],
  );
  const allEligibleCandidatesSelected = eligibleCandidateIds.length > 0
    && eligibleCandidateIds.every((revisionId) => selectedCandidates.has(revisionId));
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
  const allRegionsSelected = regions.length > 0
    && regions.every((region) => selectedRegions.has(region.regionId));
  const selectedRegionValues = regions.filter((region) => selectedRegions.has(region.regionId));
  const canStart = selectedCandidateValues.length >= 2
    && selectedCandidateValues.length <= MAX_SHORTCUT_CANDIDATES
    && selectedCandidateValues.every((candidate) => candidate.relativePath)
    && selectedRegionValues.length > 0
    && !busy;
  const parsedDraftStart = parseTimestamp(draft.start);
  const parsedDraftEnd = parseTimestamp(draft.end);
  const canSaveRegion = parsedDraftStart !== null && parsedDraftEnd !== null && parsedDraftEnd > parsedDraftStart && !busy;

  const toggle = (values: Set<string>, value: string, checked: boolean) => {
    const next = new Set(values);
    if (checked) next.add(value); else next.delete(value);
    return next;
  };
  const toggleAll = (values: Set<string>, targetValues: readonly string[], checked: boolean) => {
    const next = new Set(values);
    targetValues.forEach((value) => { if (checked) next.add(value); else next.delete(value); });
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
    const submittedDraft = draft;
    const startSeconds = parseTimestamp(submittedDraft.start);
    const endSeconds = parseTimestamp(submittedDraft.end);
    const name = submittedDraft.name.trim() || nextRegionName(regions);
    if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      setError("Enter a region name and valid start/end timestamps with the end after the start.");
      return;
    }
    const continuationDraft = submittedDraft.regionId
      ? emptyDraft()
      : { regionId: null, name: "", start: formatTimestamp(endSeconds), end: formatTimestamp(endSeconds) };
    setBusy(true);
    setError(null);
    setNotice(null);
    setDraft(continuationDraft);
    const identity = { clientId: client.clientId, projectId: project.projectId };
    try {
      const saved = submittedDraft.regionId
        ? await updateComparisonRegion({ ...identity, regionId: submittedDraft.regionId, name, startSeconds, endSeconds })
        : await addComparisonRegion({ ...identity, name, startSeconds, endSeconds });
      setSetup((current) => current ? {
        ...current,
        document: { ...current.document, regions: upsertRegion(current.document.regions, saved) },
      } : current);
      setSelectedRegions((current) => new Set(current).add(saved.regionId));
      setNotice(submittedDraft.regionId ? "Region updated." : "Region added.");
    } catch (reason) {
      setDraft((current) => sameDraft(current, continuationDraft) ? submittedDraft : current);
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
      setSetup((current) => current ? { ...current, document } : current);
      setSelectedRegions((current) => toggle(current, region.regionId, false));
      if (draft.regionId === region.regionId) setDraft(emptyDraft());
      setPendingDelete(null);
    } catch (reason) {
      setError(errorMessage(reason, "The comparison region could not be deleted."));
    } finally {
      setBusy(false);
    }
  };

  const startComparison = async () => {
    if (!canStart) return;
    setStarting(true);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!loudnessMatch) {
        onStart(freezeComparisonSession(selectedCandidateValues, selectedRegionValues, false));
        return;
      }
      const analyzed = await measureComparison("loudness", () => analyzeComparisonLoudness({
        clientId: client.clientId,
        projectId: project.projectId,
        candidates: selectedCandidateValues.map((candidate) => ({
          revisionId: candidate.revisionId,
          revisionNumber: candidate.revisionNumber,
          relativePath: candidate.relativePath!,
        })),
      }), selectedCandidateValues.length);
      const byRevision = new Map(analyzed.candidates.map((candidate) => [candidate.revisionId, candidate]));
      const matchedCandidates = selectedCandidateValues.map((candidate) => {
        const match = byRevision.get(candidate.revisionId);
        if (!match) throw new Error(`Revision ${String(candidate.revisionNumber).padStart(2, "0")} could not be loudness matched.`);
        return { ...candidate, integratedLufs: match.integratedLufs, appliedGainDb: match.appliedGainDb };
      });
      onStart(freezeComparisonSession(matchedCandidates, selectedRegionValues, true));
    } catch (reason) {
      setError(`${errorMessage(reason, "Loudness Match could not be completed.")} Exclude the affected revision or turn Loudness Match Off for this session.`);
    } finally {
      setStarting(false);
      setBusy(false);
    }
  };

  if (starting && !error) return <ComparisonLoading text="Starting comparison: analyzing loudness for selected candidates…" />;

  if (!setup && !error) return <ComparisonLoading text="Loading New Comparison: checking revisions and project regions…" />;
  if (!setup) return <section className="comparison-loading error" role="alert">{error}<button type="button" className="secondary" onClick={onCancel}><ActionIcon name="back" />Back to Revision History</button></section>;

  return <section className="comparison-setup" aria-labelledby="comparison-setup-title">
    <header className="comparison-screen-header">
      <div><p className="eyebrow">Blind Revision Comparison</p><h2 id="comparison-setup-title">New Comparison</h2><p>{project.projectName}</p></div>
      <div className="comparison-session-facts"><button type="button" className="secondary" onClick={onShowResults} disabled={!setup.document.completedSessions.length}><ActionIcon name="search" />Comparison Results</button><button type="button" className="secondary" onClick={onCancel}><ActionIcon name="close" />Cancel</button></div>
    </header>
    {error && <div className="inline-notice error" role="alert">{error}</div>}
    {notice && <div className="inline-notice success" role="status">{notice}</div>}
    <div className="comparison-setup-grid">
      <section className="panel" aria-labelledby="comparison-candidates-title">
        <h3 id="comparison-candidates-title">1. Select revisions</h3>
        <div className="comparison-choice-list">
          <label className="comparison-select-all-row"><input type="checkbox" checked={allEligibleCandidatesSelected} disabled={!eligibleCandidateIds.length} onChange={(event) => setSelectedCandidates((current) => toggleAll(current, eligibleCandidateIds, event.target.checked))} /><span><strong>Select all revisions</strong></span></label>
          {candidates.map((candidate) => <label key={candidate.revisionId} className={!candidate.eligible ? "unavailable" : ""}>
            <input type="checkbox" checked={selectedCandidates.has(candidate.revisionId)} disabled={!candidate.eligible} onChange={(event) => setSelectedCandidates((current) => toggle(current, candidate.revisionId, event.target.checked))} />
            <span className="comparison-revision-label"><strong>Revision {String(candidate.revisionNumber).padStart(2, "0")}</strong>{revisionDescriptions.get(candidate.revisionId) && <small>{revisionDescriptions.get(candidate.revisionId)}</small>}{candidate.reason && <small>{candidate.reason}</small>}</span>
          </label>)}
        </div>
      </section>
      <section className="panel comparison-session-options" aria-labelledby="comparison-options-title">
        <h3 id="comparison-options-title">2. Session options</h3>
        <label className="comparison-toggle"><input type="checkbox" checked={loudnessMatch} onChange={(event) => setLoudnessMatch(event.target.checked)} /><span><strong>Loudness Match</strong><small>Matches the loudness of the revisions being compared.</small></span></label>
      </section>
    </div>
    <section className="panel comparison-regions-panel" aria-labelledby="comparison-regions-title" onKeyDown={(event) => {
      if (event.key !== "Enter" || event.repeat || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || pendingDelete || !canSaveRegion || !isRegionPreviewTarget(event.target)) return;
      event.preventDefault();
      void saveRegion();
    }}>
        <h3 id="comparison-regions-title">3. Select and manage regions</h3>
        <p>Select one or more regions to evaluate. Full Song is selected by default but is optional.</p>
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
          <label>Name<input value={draft.name} placeholder={nextRegionName(regions)} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Start<input required aria-label="Region start" placeholder="0:00" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End<input required aria-label="Region end" placeholder="0:30" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label>
          <button type="submit" className="secondary" disabled={!canSaveRegion}><ActionIcon name={draft.regionId ? "save" : "add"} />{draft.regionId ? "Save Region" : "Add Region"}</button>
          {draft.regionId && <button type="button" className="text-button" onClick={() => setDraft(emptyDraft())}><ActionIcon name="close" />Cancel edit</button>}
        </form>
        <div className="comparison-choice-list" role="group" aria-label="Available regions">
          <label className="comparison-region-row comparison-select-all-row"><input type="checkbox" checked={allRegionsSelected} disabled={!regions.length} onChange={(event) => setSelectedRegions((current) => toggleAll(current, regions.map((region) => region.regionId), event.target.checked))} /><span><strong>Select all regions</strong></span></label>
          {regions.map((region) => <div key={region.regionId} className={`comparison-region-row${draft.regionId === region.regionId ? " editing" : ""}${region.builtIn ? " built-in" : ""}`} role={region.builtIn ? undefined : "button"} tabIndex={region.builtIn ? undefined : 0} onClick={() => beginEdit(region)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); beginEdit(region); } }}>
            <label>
              <input type="checkbox" checked={selectedRegions.has(region.regionId)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedRegions((current) => toggle(current, region.regionId, event.target.checked))} />
              <span><strong>{region.name}</strong><small>{formatTimestamp(region.startSeconds)} – {region.endSeconds === null ? "End" : formatTimestamp(region.endSeconds)}</small></span>
            </label>
            {!region.builtIn && <span className="comparison-region-actions"><button type="button" className="text-button danger icon-only comparison-region-delete" aria-label={`Delete ${region.name}`} title={`Delete ${region.name}`} onClick={(event) => { event.stopPropagation(); setPendingDelete(region); }}><ActionIcon name="delete" /></button></span>}
          </div>)}
        </div>
        {pendingDelete && <div className="inline-notice warning comparison-delete-confirmation" role="alertdialog" aria-label={`Delete ${pendingDelete.name}`}><span>Delete <strong>{pendingDelete.name}</strong>? Completed comparison history will keep its saved snapshot.</span><span><button type="button" className="secondary" onClick={() => setPendingDelete(null)}><ActionIcon name="close" />Keep Region</button><button type="button" className="danger" disabled={busy} onClick={() => void removeRegion(pendingDelete)}><ActionIcon name="delete" />Delete Region</button></span></div>}
    </section>
    <footer className="comparison-setup-footer"><span>{selectedCandidateValues.length} candidates · {selectedRegionValues.length} regions</span><button type="button" disabled={!canStart} onClick={() => void startComparison()}><ActionIcon name="play" />{busy && loudnessMatch ? "Analyzing Loudness…" : "Start Comparison"}</button></footer>
  </section>;
}
