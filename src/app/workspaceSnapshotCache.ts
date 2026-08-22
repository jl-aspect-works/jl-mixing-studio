import type { WorkspaceConfiguration } from "../settings/models";
import type { WorkspaceSnapshot } from "../types";

const SNAPSHOT_STORAGE_KEY = "jl-mixing-studio.workspace-snapshot.v1";
const CONFIGURATION_STORAGE_KEY = "jl-mixing-studio.workspace-configuration.v1";

interface CachedWorkspaceSnapshot {
  workspacePath: string;
  snapshot: WorkspaceSnapshot;
}

export const loadCachedWorkspaceConfiguration = (): WorkspaceConfiguration | null => {
  try {
    const raw = window.localStorage.getItem(CONFIGURATION_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as WorkspaceConfiguration;
    if (!cached || typeof cached.workspacePath !== "string" || typeof cached.configured !== "boolean") return null;
    return cached;
  } catch {
    return null;
  }
};

export const storeCachedWorkspaceConfiguration = (configuration: WorkspaceConfiguration) => {
  try {
    window.localStorage.setItem(CONFIGURATION_STORAGE_KEY, JSON.stringify(configuration));
  } catch {
    // The cache is opportunistic. Tauri configuration remains authoritative.
  }
};

export const loadCachedWorkspaceSnapshot = (workspacePath: string): WorkspaceSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedWorkspaceSnapshot;
    if (!cached || cached.workspacePath !== workspacePath || !cached.snapshot) return null;
    if (cached.snapshot.workspacePath !== workspacePath) return null;
    return cached.snapshot;
  } catch {
    return null;
  }
};

export const loadBootstrapWorkspaceSnapshot = (): WorkspaceSnapshot | null => {
  const configuration = loadCachedWorkspaceConfiguration();
  return configuration ? loadCachedWorkspaceSnapshot(configuration.workspacePath) : null;
};

export const storeCachedWorkspaceSnapshot = (snapshot: WorkspaceSnapshot) => {
  try {
    const cached: CachedWorkspaceSnapshot = {
      workspacePath: snapshot.workspacePath,
      snapshot,
    };
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // The cache is opportunistic. Workspace discovery remains authoritative.
  }
};
