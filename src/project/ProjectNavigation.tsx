import type { ProjectView } from "../AppShellViews";

export const projectNavigationItems: ReadonlyArray<[ProjectView, string]> = [
  ["overview", "Overview"],
  ["intake", "Client Files"],
  ["audioPrep", "Audio Prep"],
  ["references", "References"],
  ["revisions", "Revisions"],
  ["delivery", "Delivery"],
  ["files", "Files"],
];

export function ProjectNavigation({ active, onSelect }: { active: ProjectView; onSelect: (view: ProjectView) => void }) {
  return (
    <nav className="workflow-tabs" aria-label="Project navigation">
      {projectNavigationItems.map(([view, label]) =>
        active === view ? (
          <span key={view} aria-current="page">{label}</span>
        ) : (
          <button key={view} type="button" onClick={() => onSelect(view)}>{label}</button>
        ),
      )}
    </nav>
  );
}
