import type { ProjectSummary } from "../types";
import { copy as productCopy } from "../resources/copy";

const label = (revision: number | null) => revision === null ? productCopy.common.notSet : `${productCopy.projects.revisionPrefix} ${revision}`;

export function ProjectOverviewSummary({ project }: { project: ProjectSummary }) {
  return <section className="detail-summary project-revisions" aria-label={productCopy.projects.revisionStateLabel}><article><span>{productCopy.projects.current}</span><strong>{label(project.currentRevision)}</strong></article><article><span>{productCopy.projects.approved}</span><strong>{label(project.approvedRevision)}</strong></article><article><span>{productCopy.projects.delivered}</span><strong>{label(project.deliveredRevision)}</strong></article></section>;
}
