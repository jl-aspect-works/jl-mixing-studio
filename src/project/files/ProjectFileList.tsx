import type { ReactNode } from "react";
import { ActionIcon } from "../../components/ActionIcon";
import { RowActionMenu } from "./FileUiPrimitives";
import type { ProjectFileEntry, ProjectFileListing } from "./projectFileService";
import { formatProjectFileModified, formatProjectFileSize } from "./projectFileService";

export function ProjectFileList({
  listing,
  emptyMessage = "No files in this folder.",
  actionsDisabled = false,
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
  actionsDisabled?: boolean;
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
            const actions = [
              entry.entryType === "file" && entry.permissions.canOpen && onOpen ? { label: "Open", onSelect: () => onOpen(entry), disabled: actionsDisabled } : null,
              entry.permissions.canReveal && onReveal ? { label: "Reveal", onSelect: () => onReveal(entry), disabled: actionsDisabled } : null,
              entry.permissions.canRename && onRename ? { label: "Rename", onSelect: () => onRename(entry), disabled: actionsDisabled } : null,
              entry.permissions.canDelete && onDelete ? { label: "Delete", onSelect: () => onDelete(entry), disabled: actionsDisabled, destructive: true } : null,
            ].filter((action): action is NonNullable<typeof action> => action !== null);
            return (
              <tr key={entry.id}>
                <td>
                  {entry.entryType === "directory" && onOpenDirectory ? (
                    <button type="button" className="table-link" disabled={actionsDisabled} onClick={() => onOpenDirectory(entry)}>
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
                      ? <button type="button" className="secondary" disabled={actionsDisabled} onClick={() => onPreview(entry)}><ActionIcon name="play" />Preview</button>
                      : <span className="project-file-muted">—</span>}
                </td>
                <td>{entry.entryType === "file" ? entry.extension?.toUpperCase() || "File" : entry.entryType}</td>
                <td>{formatProjectFileSize(entry.sizeBytes)}</td>
                <td>{formatProjectFileModified(entry.modifiedEpochMs)}</td>
                <td className="project-file-actions-cell"><RowActionMenu label={`Actions for ${entry.displayName}`} actions={actions} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
