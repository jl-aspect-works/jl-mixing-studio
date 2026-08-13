import type { ProjectSummary } from "../types";
import { ProjectBreadcrumbs } from "./ProjectBreadcrumbs";
import { ProjectNavigationBar } from "./ProjectNavigationBar";
import type { ProjectShellView } from "./ProjectView";

const labels = { audioPrep: "Audio Prep", references: "References" } as const;

export function ProjectPlaceholderView({ active, project, onProjects, onOverview, onSelectView }: { active: "audioPrep" | "references"; project: ProjectSummary; onProjects: () => void; onOverview: () => void; onSelectView: (view: ProjectShellView) => void }) {
  const label = labels[active];
  return <><div className="detail-navigation-row"><ProjectBreadcrumbs project={project} screen={label} onProjects={onProjects} onOverview={onOverview} /></div><ProjectNavigationBar active={active} onSelect={onSelectView} /><section className="empty-state"><h2>{label}</h2><p>This Studio 2.0 workspace will be implemented in its dedicated feature issue.</p></section></>;
}
