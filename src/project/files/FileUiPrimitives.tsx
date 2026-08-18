import type { ReactNode } from "react";
import { ActionIcon, type ActionIconName } from "../../components/ActionIcon";
import "./FileUiPrimitives.css";

export type RowAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ActionIconName;
};

const inferRowActionIcon = (label: string): ActionIconName | null => {
  const normalized = label.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  if (normalized.includes("cancel") || normalized === "close") return "close";
  if (normalized.includes("reveal") || normalized.includes("folder")) return "folder";
  if (normalized.includes("open")) return "folder";
  if (normalized.includes("rename") || normalized.includes("edit")) return "edit";
  if (normalized.includes("copy")) return "copy";
  if (normalized.includes("refresh") || normalized.includes("recheck")) return "refresh";
  if (normalized.includes("play")) return "play";
  if (normalized.includes("download") || normalized.includes("export")) return "download";
  if (normalized.includes("import") || normalized.includes("add")) return "add";
  return null;
};

export function RowActionMenu({ label, actions, extraContent }: { label: string; actions: RowAction[]; extraContent?: ReactNode }) {
  if (actions.length === 0 && !extraContent) return null;
  return <details className="shared-row-action-menu">
    <summary aria-label={label} title="More actions">⋮</summary>
    <div className="shared-row-action-popover" role="menu">
      {actions.map((action) => {
        const icon = action.icon ?? inferRowActionIcon(action.label);
        return <button
          key={action.label}
          type="button"
          role="menuitem"
          className={action.destructive ? "destructive" : undefined}
          disabled={action.disabled}
          onClick={(event) => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            action.onSelect();
          }}
        >{icon && <ActionIcon name={icon} />}{action.label}</button>;
      })}
      {extraContent}
    </div>
  </details>;
}

export type FileControlIconKind = "search" | "show" | "health" | "sort";

function FileControlIcon({ kind }: { kind: FileControlIconKind }) {
  if (kind === "search") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  if (kind === "show") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
  if (kind === "health") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3" /></svg>;
}

export type FileViewControl = {
  icon: FileControlIconKind;
  label: string;
  control: ReactNode;
};

export function FileViewControls({ label, controls, className = "" }: { label: string; controls: FileViewControl[]; className?: string }) {
  return <div className={`shared-file-view-controls ${className}`.trim()} aria-label={label}>
    {controls.map((item) => <label key={item.label} className="shared-file-view-control" title={item.label}>
      <span className="shared-file-view-control-icon"><FileControlIcon kind={item.icon} /></span>
      {item.control}
    </label>)}
  </div>;
}

export function ManagedFolderToolbar({
  path,
  canNavigateUp,
  loading,
  onUp,
  onRefresh,
  onOpenFolder,
  refreshLabel = "Refresh",
}: {
  path: string;
  canNavigateUp: boolean;
  loading: boolean;
  onUp: () => void;
  onRefresh: () => void;
  onOpenFolder?: () => void;
  refreshLabel?: string;
}) {
  return <div className="shared-managed-folder-toolbar">
    <code>{path || "Project root"}</code>
    <div className="directory-actions">
      {onOpenFolder && <button type="button" className="secondary" onClick={onOpenFolder}><ActionIcon name="folder" />Open Folder</button>}
      <button type="button" className="secondary" disabled={!canNavigateUp || loading} onClick={onUp}><ActionIcon name="up" />Up</button>
      <button type="button" className="secondary" disabled={loading} onClick={onRefresh}><ActionIcon name="refresh" />{loading ? "Refreshing…" : refreshLabel}</button>
    </div>
  </div>;
}

export type FileStatusKind = "valid" | "attention" | "error" | "info" | "pending" | "none";

const defaultStatusSymbol: Record<FileStatusKind, string> = {
  valid: "✓",
  attention: "!",
  error: "×",
  info: "i",
  pending: "·",
  none: "",
};

export function FileStatusIcon({ kind, label, symbol }: { kind: FileStatusKind; label: string; symbol?: string }) {
  return <span className={`shared-file-status-icon shared-file-status-${kind}`} aria-label={label} title={label}>{symbol ?? defaultStatusSymbol[kind]}</span>;
}

export function FileStatusLegend({ label, items, className = "" }: { label: string; items: Array<{ kind: FileStatusKind; label: string; symbol?: string }>; className?: string }) {
  return <div className={`shared-file-status-legend ${className}`.trim()} aria-label={label}>
    {items.map((item) => <span key={`${item.kind}-${item.label}`}><FileStatusIcon kind={item.kind} label={item.label} symbol={item.symbol} />{item.label}</span>)}
  </div>;
}
