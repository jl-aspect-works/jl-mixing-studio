export const WORKSPACE_REFRESHED_EVENT = "jl-mixing:workspace-refreshed";

type WorkspaceRefreshDetail = {
  refreshStorage: boolean;
};

export const notifyWorkspaceRefreshed = (refreshStorage = true) => {
  window.dispatchEvent(new CustomEvent<WorkspaceRefreshDetail>(WORKSPACE_REFRESHED_EVENT, {
    detail: { refreshStorage },
  }));
};

export const addWorkspaceRefreshListener = (listener: (refreshStorage: boolean) => void) => {
  const handleRefresh = (event: Event) => {
    const detail = (event as CustomEvent<WorkspaceRefreshDetail>).detail;
    listener(detail?.refreshStorage ?? true);
  };
  window.addEventListener(WORKSPACE_REFRESHED_EVENT, handleRefresh);
  return () => window.removeEventListener(WORKSPACE_REFRESHED_EVENT, handleRefresh);
};
