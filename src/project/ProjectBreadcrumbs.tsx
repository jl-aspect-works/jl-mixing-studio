import type { ProjectSummary } from "../types";

interface ProjectBreadcrumbsProps {
  project: ProjectSummary;
  screen?: string;
  onProjects: () => void;
  onOverview?: () => void;
}

export function ProjectBreadcrumbs({ project, screen, onProjects, onOverview }: ProjectBreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <button type="button" className="breadcrumb-button" onClick={onProjects}>Projects</button>
      <span className="breadcrumb-separator" aria-hidden="true">/</span>
      {screen ? (
        <>
          <button type="button" className="breadcrumb-button" onClick={onOverview}>{project.projectName}</button>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <span aria-current="page">{screen}</span>
        </>
      ) : (
        <span aria-current="page">{project.projectName}</span>
      )}
    </nav>
  );
}
