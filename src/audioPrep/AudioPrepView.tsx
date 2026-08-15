import type { ClientSummary, ProjectSummary } from "../types";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { AudioPrepBrowser } from "./AudioPrepBrowser";

export function AudioPrepView({
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
  return <>
    <ProjectNavigationBar active="audioPrep" onSelect={onSelectView} />
    <div className="client-files-summary-row">
      <section className="panel client-files-original-delivery" aria-labelledby="audio-prep-heading">
        <div className="client-files-original-delivery-main">
          <div className="client-files-original-delivery-copy">
            <div className="client-files-original-delivery-title">
              <h2 id="audio-prep-heading">Audio Prep</h2>
              <span className="client-files-read-only">Working files</span>
            </div>
            <p>Prepare working copies for mixing while Original Delivery remains unchanged.</p>
          </div>
        </div>
        <p className="intake-format client-files-format">Rename file stems inline. Technical repair and conversion actions will appear when Automation support is available.</p>
      </section>

      <section className="panel client-files-quick-actions" aria-labelledby="audio-prep-actions-heading">
        <h2 id="audio-prep-actions-heading">Quick Actions</h2>
        <div className="action-stack">
          <button type="button" className="secondary" onClick={() => onSelectView("intake")}>Go to Client Files</button>
          <button type="button" disabled title="Requires Automation Audio Prep repair support">Fix / Convert</button>
        </div>
      </section>
    </div>

    <section className="panel client-files-browser-panel" aria-label="Audio Prep file browser">
      <AudioPrepBrowser clientId={client.clientId} projectId={project.projectId} />
    </section>
  </>;
}
