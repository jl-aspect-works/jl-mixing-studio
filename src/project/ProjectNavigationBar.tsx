import type { ReactNode } from "react";
import { projectNavigationItems } from "./ProjectNavigation";
import type { ProjectShellView } from "./ProjectView";

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
          ? <span key={view} aria-current="page">{label}</span>
          : <button key={view} type="button" onClick={() => onSelect(view)}>{label}</button>)}
      </nav>
      {actions && <div className="workflow-tabs-actions">{actions}</div>}
    </div>
  );
}
