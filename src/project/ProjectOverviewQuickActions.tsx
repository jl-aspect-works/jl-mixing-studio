import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClientSummary, FolderResult, ProjectSummary, RevisionSummary } from "../types";
import { safeError } from "../AppShellViews";
import { ActionIcon } from "../components/ActionIcon";
import { copy as productCopy } from "../resources/copy";

export function ProjectOverviewQuickActions({ client, project, loading, revisionCreationAvailable, revisionApprovalAvailable, onNewRevision, onApproveRevision, onRevisions }: { client: ClientSummary; project: ProjectSummary; loading: boolean; revisionCreationAvailable: boolean; revisionApprovalAvailable: boolean; onNewRevision: () => void; onApproveRevision: (revision: RevisionSummary) => void; onRevisions: () => void }) {
  const [folderMessage, setFolderMessage] = useState<string | null>(null);
  const currentRevision = project.revisions.find((revision) => revision.number === project.currentRevision) ?? null;
  const canApproveCurrent = Boolean(currentRevision) && project.approvedRevision !== project.currentRevision && revisionApprovalAvailable && !loading;
  const openProjectFolder = () => {
    const request = { location: "project" as const, clientId: client.clientId, projectId: project.projectId };
    void invoke<FolderResult>("open_folder", { request })
      .then(() => setFolderMessage(productCopy.common.folderOpened))
      .catch((error: unknown) => setFolderMessage(safeError(error, productCopy.common.folderOpenFailed)));
  };

  return (
    <section className="overview-card overview-actions-card" aria-labelledby="overview-actions-heading">
      <h2 id="overview-actions-heading">Quick Actions</h2>
      <div className="overview-action-stack">
        <button type="button" aria-label="New revision" onClick={onNewRevision} disabled={!revisionCreationAvailable || loading}><ActionIcon name="add" />Create New Revision</button>
        <button type="button" className="secondary" onClick={() => currentRevision && onApproveRevision(currentRevision)} disabled={!canApproveCurrent}><ActionIcon name="check" />Approve Current Revision</button>
        <button type="button" className="secondary" onClick={onRevisions}>View Revisions</button>
        <button type="button" className="secondary" onClick={openProjectFolder}><ActionIcon name="folder" />Open Project Folder</button>
        {folderMessage && <small role="status" className="overview-folder-message">{folderMessage}</small>}
      </div>
    </section>
  );
}
