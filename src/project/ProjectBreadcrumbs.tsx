import type { ProjectSummary } from "../types";

interface ProjectBreadcrumbsProps {
  project: ProjectSummary;
  screen?: string;
  onProjects: () => void;
  onOverview?: () => void;
}

export function ProjectBreadcrumbs({ project, screen, onProjects, onOverview }: ProjectBreadcrumbsProps) {
  return (
    <nav
      className="breadcrumbs"
      aria-label="Breadcrumb"
      style={{ width: "100%", maxWidth: "100%", marginLeft: 0, justifyContent: "flex-end", overflow: "hidden" }}
    >
      <span
        className="breadcrumb-trail"
        style={{ display: "inline-flex", alignItems: "center", flexWrap: "nowrap", marginLeft: "auto", maxWidth: "100%" }}
      >
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
      </span>
    </nav>
  );
}
