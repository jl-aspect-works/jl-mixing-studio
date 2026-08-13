import { projectNavigationItems } from "./ProjectNavigation";
import type { ProjectShellView } from "./ProjectView";

export function ProjectNavigationBar({ active, onSelect }: { active: ProjectShellView; onSelect: (view: ProjectShellView) => void }) {
  return (
    <nav className="workflow-tabs" aria-label="Project navigation">
      {projectNavigationItems.map(([view, label]) => active === view ? <span key={view} aria-current="page">{label}</span> : <button key={view} type="button" onClick={() => onSelect(view)}>{label}</button>)}
    </nav>
  );
}
