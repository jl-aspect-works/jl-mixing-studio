import { useState } from "react";
import type { ClientSummary, ProjectSummary } from "../types";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { AudioPreviewPlayer } from "../project/files/AudioPreviewPlayer";
import {
  addProjectReference,
  deleteProjectReference,
  formatProjectFileModified,
  formatProjectFileSize,
  openProjectFile,
  projectFilePaths,
  revealProjectFile,
  type ProjectFileEntry,
} from "../project/files/projectFileService";
import { useProjectFiles } from "../project/files/useProjectFiles";
import "./ReferencesView.css";

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The reference action could not be completed.";

export function ReferencesView({
  client,
  project,
  onSelectView,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  onProjects: () => void;
  onOverview: () => void;
  onSelectView: (view: ProjectShellView) => void;
}) {
  const { state, refresh } = useProjectFiles({
    clientId: client.clientId,
    projectId: project.projectId,
    relativePath: projectFilePaths.references,
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const entries = (state.listing?.entries ?? []).filter(
    (entry) => entry.entryType === "file" && entry.isAudio,
  );

  const addReference = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await addProjectReference({ clientId: client.clientId, projectId: project.projectId });
      if (result) await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteReference = async (entry: ProjectFileEntry) => {
    if (!window.confirm(`Delete the project reference “${entry.displayName}”?\n\nThe external source file will not be affected.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteProjectReference({
        clientId: client.clientId,
        projectId: project.projectId,
        relativePath: entry.relativePath,
      });
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const fileAction = async (action: "open" | "reveal", entry: ProjectFileEntry) => {
    setActionError(null);
    try {
      const request = { clientId: client.clientId, projectId: project.projectId, relativePath: entry.relativePath };
      await (action === "open" ? openProjectFile(request) : revealProjectFile(request));
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  return <>
    <ProjectNavigationBar active="references" onSelect={onSelectView} />
    <div className="references-header-row">
      <section className="panel references-intro" aria-labelledby="references-heading">
        <div>
          <h2 id="references-heading">References</h2>
          <p>Reference mixes for this project, used to guide tonal balance, dynamics, instrument character, and the overall mix direction.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void addReference()}>
          {busy ? "Working…" : "Add Reference"}
        </button>
      </section>
    </div>

    {actionError && <div className="inline-notice error" role="alert">{actionError}</div>}
    {state.status === "error" && <div className="inline-notice error" role="alert">{state.message}</div>}

    <section className="panel references-panel" aria-label="Project references">
      <div className="references-toolbar">
        <div>
          <strong>{entries.length} {entries.length === 1 ? "reference" : "references"}</strong>
          <span>Copied into {projectFilePaths.references}</span>
        </div>
        <button type="button" className="secondary" disabled={busy || state.status === "loading"} onClick={() => void refresh()}>Refresh</button>
      </div>

      <div className="references-table-wrap">
        <table className="references-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Size</th>
              <th>Added / Modified</th>
              <th>Preview</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => <tr key={entry.id}>
              <td>
                <div className="references-file-name">{entry.displayName}</div>
                <div className="references-file-type">{entry.extension?.toUpperCase() ?? "Audio"}</div>
              </td>
              <td>{formatProjectFileSize(entry.sizeBytes)}</td>
              <td>{formatProjectFileModified(entry.modifiedEpochMs)}</td>
              <td className="references-preview-cell">
                {entry.playable
                  ? <AudioPreviewPlayer clientId={client.clientId} projectId={project.projectId} entry={entry} />
                  : <span className="references-muted">Preview unavailable</span>}
              </td>
              <td>
                <div className="references-actions">
                  <button type="button" className="secondary" onClick={() => void fileAction("open", entry)}>Open</button>
                  <button type="button" className="secondary" onClick={() => void fileAction("reveal", entry)}>Reveal</button>
                  <button type="button" className="references-delete" disabled={busy} onClick={() => void deleteReference(entry)}>Delete</button>
                </div>
              </td>
            </tr>)}
            {!entries.length && state.status !== "loading" && <tr>
              <td colSpan={5} className="references-empty">No reference tracks have been added.</td>
            </tr>}
            {!entries.length && state.status === "loading" && <tr>
              <td colSpan={5} className="references-empty">Loading references…</td>
            </tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
