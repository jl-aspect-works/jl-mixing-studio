import { useMemo, useState } from "react";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import {
  deleteAudioPrepFile,
  deleteRevisionFile,
  projectFilePaths,
  renameAudioPrepFile,
  renameRevisionFile,
  type ProjectFileEntry,
} from "./projectFileService";
import "./ProjectFilesWorkspace.css";

type TreeNode = {
  label: string;
  path: string;
  children?: TreeNode[];
};

const projectTree: TreeNode[] = [
  { label: "00_Admin", path: projectFilePaths.admin },
  {
    label: "01_Client_Files",
    path: "01_Client_Files",
    children: [
      { label: "Original_Delivery", path: projectFilePaths.originalDelivery },
      { label: "References", path: projectFilePaths.references },
      { label: "Documentation", path: projectFilePaths.clientDocumentation },
    ],
  },
  {
    label: "02_Audio_Preparation",
    path: projectFilePaths.audioPreparation,
    children: [
      { label: "Working_Audio", path: projectFilePaths.audioPreparationWorking },
      { label: "Rejected_Files", path: projectFilePaths.audioPreparationRejected },
    ],
  },
  { label: "03_DAW_Project", path: projectFilePaths.dawProject },
  { label: "04_Revisions", path: projectFilePaths.revisions },
  { label: "05_Final_Delivery", path: projectFilePaths.finalDelivery },
  { label: "06_Recall", path: projectFilePaths.recall },
];

const pathLabel = (path: string) => path || "Project root";

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

function TreeBranch({
  node,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Boolean(node.children?.length);
  const selected = selectedPath === node.path;

  return (
    <li>
      <div className={`project-files-tree-row${selected ? " selected" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="project-files-tree-toggle"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="project-files-tree-spacer" aria-hidden="true" />
        )}
        <button
          type="button"
          className="project-files-tree-node"
          aria-current={selected ? "page" : undefined}
          onClick={() => onSelect(node.path)}
        >
          <span aria-hidden="true">{hasChildren ? "▣" : "□"}</span>
          <span>{node.label}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children?.map((child) => (
            <TreeBranch key={child.path} node={child} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ProjectFilesWorkspace({ clientId, projectId }: { clientId: string; projectId: string }) {
  const [selectedPath, setSelectedPath] = useState("");
  const selectedLabel = useMemo(() => pathLabel(selectedPath), [selectedPath]);

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
      <aside className="project-files-tree" aria-label="Project folders">
        <div className="project-files-tree-heading">
          <span className="kicker">Project structure</span>
          <button
            type="button"
            className={`project-files-root${selectedPath === "" ? " selected" : ""}`}
            aria-current={selectedPath === "" ? "page" : undefined}
            onClick={() => setSelectedPath("")}
          >
            Project root
          </button>
        </div>
        <ul className="project-files-tree-list">
          {projectTree.map((node) => (
            <TreeBranch key={node.path} node={node} selectedPath={selectedPath} onSelect={setSelectedPath} />
          ))}
        </ul>
      </aside>

      <div className="project-files-content">
        <header className="project-files-content-heading">
          <div>
            <p className="kicker">Selected folder</p>
            <h2>{selectedLabel}</h2>
          </div>
          <p>{policyText(selectedPath)}</p>
        </header>
        <ProjectFileBrowser
          clientId={clientId}
          projectId={projectId}
          initialPath={selectedPath}
          rootPath=""
          emptyMessage="No files in this project folder."
          onRename={renameEntry}
          onDelete={deleteEntry}
        />
      </div>
    </section>
  );
}
