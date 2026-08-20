import { invoke } from "@tauri-apps/api/core";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import {
  deleteAudioPrepFile,
  deleteRevisionFile,
  openProjectFile,
  projectFilePaths,
  renameAudioPrepFile,
  renameRevisionFile,
  type ProjectFileEntry,
} from "./projectFileService";
import "./ProjectFilesWorkspace.css";

const filenameStem = (entry: ProjectFileEntry) => {
  if (!entry.extension) return entry.displayName;
  const suffix = `.${entry.extension}`;
  return entry.displayName.toLowerCase().endsWith(suffix.toLowerCase())
    ? entry.displayName.slice(0, -suffix.length)
    : entry.displayName;
};

const policyText = (path: string) => {
  if (path.startsWith(projectFilePaths.originalDelivery)) {
    return "Original Delivery is read-only. Files may be inspected, opened, revealed, and previewed where supported.";
  }
  if (path.startsWith(projectFilePaths.finalDelivery)) {
    return "Final Delivery is managed by the Delivery workflow. Use Delivery for changes that affect deliverables or package state.";
  }
  if (path.startsWith(projectFilePaths.references)) {
    return "Reference files are project-owned. Use References for add/delete workflow operations.";
  }
  if (path.startsWith(projectFilePaths.audioPreparation)) {
    return "Audio Preparation is a working area. Rename/delete are available only when the validated file service marks a file safe to modify.";
  }
  if (path.startsWith(projectFilePaths.revisions)) {
    return "Revision files are managed project assets. Supported rename/delete operations use the revision-aware managed file service.";
  }
  return "Browse the managed JL project structure. File actions remain constrained to this project.";
};

export function ProjectFilesWorkspace({ clientId, projectId }: { clientId: string; projectId: string }) {
  const openFolder = async (relativePath: string) => {
    if (!relativePath) {
      await invoke("open_folder", { request: { location: "project", clientId, projectId } });
      return;
    }
    await openProjectFile({ clientId, projectId, relativePath });
  };

  const renameEntry = async (entry: ProjectFileEntry) => {
    const currentStem = filenameStem(entry);
    const nextStem = window.prompt(`Rename ${entry.displayName}`, currentStem)?.trim();
    if (!nextStem || nextStem === currentStem) return;

    const request = { clientId, projectId, relativePath: entry.relativePath };
    if (entry.area === "audioPreparation") {
      await renameAudioPrepFile(request, nextStem);
      return;
    }
    if (entry.area === "revisions") {
      await renameRevisionFile(request, nextStem);
      return;
    }
    throw new Error("Rename is not available for this managed project area.");
  };

  const deleteEntry = async (entry: ProjectFileEntry) => {
    if (!window.confirm(`Delete ${entry.displayName}? This action cannot be undone.`)) return;

    const request = { clientId, projectId, relativePath: entry.relativePath };
    if (entry.area === "audioPreparation") {
      await deleteAudioPrepFile(request);
      return;
    }
    if (entry.area === "revisions") {
      await deleteRevisionFile(request);
      return;
    }
    throw new Error("Delete is not available for this managed project area.");
  };

  return (
    <section className="project-files-workspace" aria-label="Project file workspace">
      <header className="project-files-heading">
        <div>
          <p className="kicker">Files</p>
          <h2>Project files</h2>
        </div>
        <p>Browse within this project. Navigation and file actions remain constrained to the managed project root.</p>
      </header>

      <ProjectFileBrowser
        clientId={clientId}
        projectId={projectId}
        initialPath=""
        rootPath=""
        emptyMessage="No files in this project folder."
        enhancedNavigation
        breadcrumbRootLabel="Project root"
        pathDescription={policyText}
        onOpenFolder={openFolder}
        onRename={renameEntry}
        onDelete={deleteEntry}
      />
    </section>
  );
}
