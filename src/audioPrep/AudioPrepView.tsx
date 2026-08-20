import { useState } from "react";
import type { IntakeReportState } from "../AppShellViews";
import { ActionIcon } from "../components/ActionIcon";
import type { ClientSummary, IntakeOperationResult, ProjectSummary } from "../types";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { openManagedProjectFolder } from "../project/files/projectFileService";
import { AudioPrepBrowser, type AudioPrepValidationFile } from "./AudioPrepBrowser";

type AudioPrepIntakeResult = IntakeOperationResult & {
  audioPrepAvailable?: boolean;
  audioPrepFiles?: AudioPrepValidationFile[];
};

const folderErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "The Audio Prep folder could not be opened.";

export function AudioPrepView({
  client,
  project,
  reportState,
  onValidationRefresh,
  onSelectView,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  reportState: IntakeReportState;
  onValidationRefresh: () => void;
  onProjects: () => void;
  onOverview: () => void;
  onSelectView: (view: ProjectShellView) => void;
}) {
  const result = reportState.status === "ready" ? reportState.value as AudioPrepIntakeResult : null;
  const validationAvailable = result?.audioPrepAvailable === true;
  const validationFiles = Array.isArray(result?.audioPrepFiles) ? result.audioPrepFiles : [];
  const expectedSampleRate = result?.report?.expectedSampleRate ?? project.sampleRate;
  const expectedBitDepth = result?.report?.expectedBitDepth ?? project.bitDepth;
  const enhancedInspectionAvailable = result?.report?.enhancedInspectionAvailable === true;
  const [folderError, setFolderError] = useState<string | null>(null);

  const openAudioPrepFolder = async () => {
    setFolderError(null);
    try {
      await openManagedProjectFolder({ clientId: client.clientId, projectId: project.projectId }, "audioPrep");
    } catch (error) {
      setFolderError(folderErrorMessage(error));
    }
  };

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
        <p className="intake-format client-files-format">Expected format: {expectedSampleRate / 1000} kHz / {expectedBitDepth}-bit · Enhanced inspection {enhancedInspectionAvailable ? "available" : "unavailable"}</p>
      </section>

      <section className="panel client-files-quick-actions" aria-labelledby="audio-prep-actions-heading">
        <h2 id="audio-prep-actions-heading">Quick Actions</h2>
        <div className="action-stack">
          <button type="button" className="secondary" onClick={() => onSelectView("intake")}>Go to Client Files</button>
          <button type="button" className="secondary" onClick={() => void openAudioPrepFolder()}><ActionIcon name="folder" />Open Audio Prep Folder</button>
        </div>
      </section>
    </div>

    {folderError && <div className="inline-notice error" role="alert">{folderError}</div>}

    <section className="panel client-files-browser-panel" aria-label="Audio Prep file browser">
      <AudioPrepBrowser clientId={client.clientId} projectId={project.projectId} validationAvailable={validationAvailable} validationFiles={validationFiles} onValidationRefresh={onValidationRefresh} />
    </section>
  </>;
}