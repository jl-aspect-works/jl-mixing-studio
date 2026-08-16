import type { ReactNode } from "react";
import type { ProjectFileEntry, ProjectFileListing } from "./projectFileService";
import { formatProjectFileModified, formatProjectFileSize } from "./projectFileService";

export function ProjectFileList({
  listing,
  emptyMessage = "No files in this folder.",
  onOpenDirectory,
  onOpen,
  onPreview,
  renderPreview,
  onReveal,
  onRename,
  onDelete,
}: {
  listing: ProjectFileListing;
  emptyMessage?: string;
  onOpenDirectory?: (entry: ProjectFileEntry) => void;
  onOpen?: (entry: ProjectFileEntry) => void;
  onPreview?: (entry: ProjectFileEntry) => void;
  renderPreview?: (entry: ProjectFileEntry) => ReactNode;
  onReveal?: (entry: ProjectFileEntry) => void;
  onRename?: (entry: ProjectFileEntry) => void;
  onDelete?: (entry: ProjectFileEntry) => void;
}) {
  if (listing.entries.length === 0) {
    return <p className="project-file-empty">{emptyMessage}</p>;
  }

  return (
    <div className="table-scroll project-file-list">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Preview</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th aria-label="File actions" />
          </tr>
        </thead>
        <tbody>
          {listing.entries.map((entry) => {
            const hasActions = (entry.entryType === "file" && entry.permissions.canOpen && onOpen)
              || (entry.permissions.canReveal && onReveal)
              || (entry.permissions.canRename && onRename)
              || (entry.permissions.canDelete && onDelete);
            return (
              <tr key={entry.id}>
                <td>
                  {entry.entryType === "directory" && onOpenDirectory ? (
                    <button type="button" className="table-link" onClick={() => onOpenDirectory(entry)}>
                      {entry.displayName}
                    </button>
                  ) : (
                    <strong>{entry.displayName}</strong>
                  )}
                </td>
                <td className="project-file-preview-cell">
                  {entry.playable && renderPreview
                    ? renderPreview(entry)
                    : entry.playable && onPreview
                      ? <button type="button" className="secondary" onClick={() => onPreview(entry)}>Preview</button>
                      : <span className="project-file-muted">—</span>}
                </td>
                <td>{entry.entryType === "file" ? entry.extension?.toUpperCase() || "File" : entry.entryType}</td>
                <td>{formatProjectFileSize(entry.sizeBytes)}</td>
                <td>{formatProjectFileModified(entry.modifiedEpochMs)}</td>
                <td className="project-file-actions-cell">
                  {hasActions && (
                    <details className="project-file-row-menu">
                      <summary aria-label={`Actions for ${entry.displayName}`} title="More actions">⋮</summary>
                      <div className="project-file-row-menu-popover">
                        {entry.entryType === "file" && entry.permissions.canOpen && onOpen && (
                          <button type="button" onClick={() => onOpen(entry)}>Open</button>
                        )}
                        {entry.permissions.canReveal && onReveal && (
                          <button type="button" onClick={() => onReveal(entry)}>Reveal</button>
                        )}
                        {entry.permissions.canRename && onRename && (
                          <button type="button" onClick={() => onRename(entry)}>Rename</button>
                        )}
                        {entry.permissions.canDelete && onDelete && (
                          <button type="button" className="project-file-delete" onClick={() => onDelete(entry)}>Delete</button>
                        )}
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
