import type { ProjectSummary } from "../types";

interface ProjectBreadcrumbsProps {
  project: ProjectSummary;
  screen?: string;
  onProjects: () => void;
  onOverview?: () => void;
}

const separatorStyle = { marginInline: "0.25em" };

export function ProjectBreadcrumbs({ project, screen, onProjects, onOverview }: ProjectBreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ gap: 0 }}>
      <button type="button" onClick={onProjects}>Projects</button>
      <span aria-hidden="true" style={separatorStyle}>/</span>
      {screen ? (
        <>
          <button type="button" onClick={onOverview}>{project.projectName}</button>
          <span aria-hidden="true" style={separatorStyle}>/</span>
          <span aria-current="page">{screen}</span>
        </>
      ) : (
        <span aria-current="page">{project.projectName}</span>
      )}
    </nav>
  );
}
