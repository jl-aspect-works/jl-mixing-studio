import { projectNavigationItems } from "./ProjectNavigation";
import type { ProjectView } from "./ProjectView";

export function ProjectNavigationBar({ active, onSelect }: { active: ProjectView; onSelect: (view: ProjectView) => void }) {
  return (
    <nav className="workflow-tabs" aria-label="Project navigation">
      {projectNavigationItems.map(([view, label]) => active === view ? <span key={view} aria-current="page">{label}</span> : <button key={view} type="button" onClick={() => onSelect(view)}>{label}</button>)}
    </nav>
  );
}
