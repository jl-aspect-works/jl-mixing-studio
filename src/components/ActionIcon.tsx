import type { ReactNode } from "react";
import "./ActionIcon.css";

export type ActionIconName =
  | "add"
  | "archive"
  | "back"
  | "check"
  | "close"
  | "copy"
  | "delete"
  | "edit"
  | "filter"
  | "folder"
  | "import"
  | "open"
  | "pause"
  | "play"
  | "refresh"
  | "retry"
  | "save"
  | "search"
  | "undo"
  | "up"
  | "upload"
  | "download";

const iconPaths: Record<ActionIconName, ReactNode> = {
  add: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  archive: <><path d="M4 7h16v13H4z"/><path d="M3 4h18v3H3z"/><path d="M9 11h6"/></>,
  back: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  delete: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  filter: <><path d="M4 5h16"/><path d="M7 12h10"/><path d="M10 19h4"/></>,
  folder: <><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 6V4h7l2 2"/></>,
  import: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
  open: <><path d="M5 19 19 5"/><path d="M10 5h9v9"/></>,
  pause: <><path d="M8 5v14"/><path d="M16 5v14"/></>,
  play: <path d="m8 5 11 7-11 7Z"/>,
  refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 8.5A8 8 0 0 0 5 7"/><path d="M5.5 15.5A8 8 0 0 0 19 17"/></>,
  retry: <><path d="M20 7v5h-5"/><path d="M20 12a8 8 0 1 0-2.3 5.7"/></>,
  save: <><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  undo: <><path d="M9 8 5 12l4 4"/><path d="M5 12h8a6 6 0 0 1 6 6"/></>,
  up: <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
  upload: <><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/></>,
  download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
};

export function ActionIcon({ name }: { name: ActionIconName }) {
  return (
    <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {iconPaths[name]}
    </svg>
  );
}
