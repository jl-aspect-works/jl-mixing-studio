export interface RecentProjectReference {
  clientId: string;
  projectId: string;
  openedAt: string;
}

const RECENT_PROJECT_STORAGE_KEY = "jl-mixing-studio.recent-project.v1";

export function loadRecentProject(): RecentProjectReference | null {
  try {
    const raw = window.localStorage.getItem(RECENT_PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecentProjectReference>;
    if (
      typeof parsed.clientId !== "string" ||
      parsed.clientId.length === 0 ||
      typeof parsed.projectId !== "string" ||
      parsed.projectId.length === 0 ||
      typeof parsed.openedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.openedAt))
    ) {
      return null;
    }
    return {
      clientId: parsed.clientId,
      projectId: parsed.projectId,
      openedAt: parsed.openedAt,
    };
  } catch {
    return null;
  }
}

export function rememberRecentProject(clientId: string, projectId: string, openedAt = new Date()): void {
  try {
    window.localStorage.setItem(
      RECENT_PROJECT_STORAGE_KEY,
      JSON.stringify({ clientId, projectId, openedAt: openedAt.toISOString() } satisfies RecentProjectReference),
    );
  } catch {
    // Recent-project convenience state must never block project navigation.
  }
}
