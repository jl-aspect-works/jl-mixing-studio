import type { WorkspaceSnapshot } from "../types";

const STORAGE_KEY = "jl-mixing-studio.workspace-snapshot.v1";

interface CachedWorkspaceSnapshot {
  workspacePath: string;
  snapshot: WorkspaceSnapshot;
}

export const loadCachedWorkspaceSnapshot = (workspacePath: string): WorkspaceSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedWorkspaceSnapshot;
    if (!cached || cached.workspacePath !== workspacePath || !cached.snapshot) return null;
    if (cached.snapshot.workspacePath !== workspacePath) return null;
    return cached.snapshot;
  } catch {
    return null;
  }
};

export const storeCachedWorkspaceSnapshot = (snapshot: WorkspaceSnapshot) => {
  try {
    const cached: CachedWorkspaceSnapshot = {
      workspacePath: snapshot.workspacePath,
      snapshot,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // The cache is opportunistic. Workspace discovery remains authoritative.
  }
};
