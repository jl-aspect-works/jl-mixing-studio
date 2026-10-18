import { useEffect, useState } from "react";
import { addWorkspaceRefreshListener } from "../app/workspaceRefreshEvents";
import { getComparisonResults } from "../comparison/comparisonService";
import { cumulativeTopRevisionId } from "../comparison/results";
import type { ProjectSummary } from "../types";

type ProjectTop = { clientId: string; projectId: string; revisionId: string | null };

export function useOverviewTopRevision(clientId: string, project: ProjectSummary) {
  const { projectId, revisions } = project;
  const [top, setTop] = useState<ProjectTop | null>(null);

  useEffect(() => {
    let active = true;
    let requestSequence = 0;
    const load = async () => {
      const sequence = ++requestSequence;
      setTop(null);
      if (revisions.length === 0) return;
      try {
        const results = await getComparisonResults({ clientId, projectId });
        if (active && sequence === requestSequence) {
          setTop({ clientId, projectId, revisionId: cumulativeTopRevisionId(results.fullSongStandings) });
        }
      } catch {
        // TOP is optional metadata: preserve the ordinary card when unavailable.
        if (active && sequence === requestSequence) setTop(null);
      }
    };
    void load();
    const unsubscribe = addWorkspaceRefreshListener(() => { void load(); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [clientId, projectId, revisions]);

  // Hide the previous project's badge immediately, before the new effect runs.
  return top?.clientId === clientId && top.projectId === projectId ? top.revisionId : null;
}
