export const WORKSPACE_REFRESHED_EVENT = "jl-mixing:workspace-refreshed";

export const notifyWorkspaceRefreshed = () => {
  window.dispatchEvent(new Event(WORKSPACE_REFRESHED_EVENT));
};

export const addWorkspaceRefreshListener = (listener: () => void) => {
  window.addEventListener(WORKSPACE_REFRESHED_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_REFRESHED_EVENT, listener);
};
