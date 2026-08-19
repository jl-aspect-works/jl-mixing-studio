import type { ReactNode } from "react";
import { projectNavigationItems } from "./ProjectNavigation";
import type { ProjectShellView } from "./ProjectView";
import "./ProjectUiPolish.css";

const projectNavigationIconPaths: Partial<Record<ProjectShellView, ReactNode>> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  intake: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="m9 13 2 2 4-4"/></>,
  audioPrep: <><path d="M4 8h16"/><path d="M4 16h16"/><circle cx="9" cy="8" r="2"/><circle cx="15" cy="16" r="2"/></>,
  references: <><path d="M6 4h12v16l-6-4-6 4z"/><path d="M9 8h6"/></>,
  revisions: <><path d="m12 3 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></>,
  delivery: <><path d="M5 7h14v13H5z"/><path d="m5 7 7-4 7 4"/><path d="M12 3v11"/><path d="m9 11 3 3 3-3"/></>,
  files: <><path d="M3 7h7l2 2h9v11H3z"/><path d="M3 7V4h7l2 3"/></>,
};

function ProjectNavigationIcon({ view }: { view: ProjectShellView }) {
  return <svg className="project-navigation-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{projectNavigationIconPaths[view]}</svg>;
}

export function ProjectNavigationBar({
  active,
  onSelect,
  actions,
}: {
  active: ProjectShellView;
  onSelect: (view: ProjectShellView) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="workflow-tabs-row">
      <nav className="workflow-tabs" aria-label="Project navigation">
        {projectNavigationItems.map(([view, label]) => active === view
          ? <span key={view} aria-current="page"><ProjectNavigationIcon view={view} />{label}</span>
          : <button key={view} type="button" onClick={() => onSelect(view)}><ProjectNavigationIcon view={view} />{label}</button>)}
      </nav>
      {actions && <div className="workflow-tabs-actions">{actions}</div>}
    </div>
  );
}
