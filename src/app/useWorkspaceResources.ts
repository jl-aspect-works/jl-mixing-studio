import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { WorkspaceConfiguration } from "../settings/models";
import { safeError, type ResourceState } from "../AppViews";
import { notifyWorkspaceRefreshed } from "./workspaceRefreshEvents";

const yieldToBrowserPaint = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

export function useWorkspaceResources() {
  const [workspace, setWorkspace] = useState<ResourceState<WorkspaceSnapshot>>({ status: "loading" });
  const [workspaceConfiguration, setWorkspaceConfiguration] = useState<ResourceState<WorkspaceConfiguration>>({ status: "loading" });
  const [version, setVersion] = useState<ResourceState<VersionCheck>>({ status: "loading" });
  const [refreshingWorkspace, setRefreshingWorkspace] = useState(false);
  const [refreshingResources, setRefreshingResources] = useState(false);
  const [workspaceRefreshError, setWorkspaceRefreshError] = useState<string | null>(null);
  const workspaceRequestId = useRef(0);
  const configurationRequestId = useRef(0);
  const versionRequestId = useRef(0);
  const workspaceInFlight = useRef<Promise<void> | null>(null);
  const refreshStorageAfterCurrentWorkspaceRequest = useRef(false);

  const reloadWorkspaceConfiguration = useCallback(async () => {
    const currentRequest = ++configurationRequestId.current;
    try {
      const value = await invoke<WorkspaceConfiguration>("get_workspace_configuration");
      if (configurationRequestId.current === currentRequest) setWorkspaceConfiguration({ status: "ready", value });
    } catch (error: unknown) {
      if (configurationRequestId.current === currentRequest) {
        setWorkspaceConfiguration({ status: "error", message: safeError(error, "Workspace configuration could not be loaded.") });
      }
    }
  }, []);

  const refreshVersion = useCallback(async () => {
    const currentRequest = ++versionRequestId.current;
    try {
      const value = await invoke<VersionCheck>("get_jl_mixing_version");
      if (versionRequestId.current === currentRequest) setVersion({ status: "ready", value });
    } catch (error: unknown) {
      if (versionRequestId.current === currentRequest) {
        setVersion({ status: "error", message: safeError(error, "JL Mixing Automation could not be checked.") });
      }
    }
  }, []);

  const refreshWorkspace = useCallback(async (blocking = true) => {
    if (blocking) setRefreshingWorkspace(true);
    setWorkspaceRefreshError(null);
    refreshStorageAfterCurrentWorkspaceRequest.current ||= blocking;

    if (!workspaceInFlight.current) {
      const currentRequest = ++workspaceRequestId.current;
      const request = (async () => {
        await yieldToBrowserPaint();
        try {
          const value = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          if (workspaceRequestId.current === currentRequest) {
            setWorkspace({ status: "ready", value });
            notifyWorkspaceRefreshed(refreshStorageAfterCurrentWorkspaceRequest.current);
          }
        } catch (error: unknown) {
          if (workspaceRequestId.current === currentRequest) {
            const message = safeError(error, "Workspace discovery could not be completed.");
            setWorkspaceRefreshError(message);
            setWorkspace((current) => current.status === "ready" ? current : { status: "error", message });
          }
        } finally {
          if (workspaceInFlight.current === request) {
            workspaceInFlight.current = null;
            refreshStorageAfterCurrentWorkspaceRequest.current = false;
          }
        }
      })();
      workspaceInFlight.current = request;
    }

    try {
      await workspaceInFlight.current;
    } finally {
      if (blocking) setRefreshingWorkspace(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshingResources(true);
    try {
      await Promise.all([
        refreshWorkspace(),
        reloadWorkspaceConfiguration(),
        refreshVersion(),
      ]);
    } finally {
      setRefreshingResources(false);
    }
  }, [refreshWorkspace, reloadWorkspaceConfiguration, refreshVersion]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const handleFocus = () => { void refreshWorkspace(false); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshWorkspace]);

  const loading = workspace.status === "loading"
    || workspaceConfiguration.status === "loading"
    || version.status === "loading"
    || refreshingWorkspace
    || refreshingResources;

  return {
    workspace,
    setWorkspace,
    workspaceConfiguration,
    version,
    refresh,
    refreshWorkspace,
    reloadWorkspaceConfiguration,
    workspaceRefreshError,
    loading,
  };
}
