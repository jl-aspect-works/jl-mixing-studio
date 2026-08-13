import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { WorkspaceConfiguration } from "../settings/models";
import { safeError, type ResourceState } from "../AppViews";

const yieldToBrowserPaint = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

export function useWorkspaceResources() {
  const [workspace, setWorkspace] = useState<ResourceState<WorkspaceSnapshot>>({ status: "loading" });
  const [workspaceConfiguration, setWorkspaceConfiguration] = useState<ResourceState<WorkspaceConfiguration>>({ status: "loading" });
  const [version, setVersion] = useState<ResourceState<VersionCheck>>({ status: "loading" });
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setWorkspace({ status: "loading" });
    setWorkspaceConfiguration({ status: "loading" });
    setVersion({ status: "loading" });
    await yieldToBrowserPaint();

    invoke<WorkspaceSnapshot>("discover_default_workspace").then((value) => {
      if (requestId.current === currentRequest) setWorkspace({ status: "ready", value });
    }).catch((error: unknown) => {
      if (requestId.current === currentRequest) setWorkspace({ status: "error", message: safeError(error, "Workspace discovery could not be completed.") });
    });

    invoke<WorkspaceConfiguration>("get_workspace_configuration").then((value) => {
      if (requestId.current === currentRequest) setWorkspaceConfiguration({ status: "ready", value });
    }).catch((error: unknown) => {
      if (requestId.current === currentRequest) setWorkspaceConfiguration({ status: "error", message: safeError(error, "Workspace configuration could not be loaded.") });
    });

    invoke<VersionCheck>("get_jl_mixing_version").then((value) => {
      if (requestId.current === currentRequest) setVersion({ status: "ready", value });
    }).catch((error: unknown) => {
      if (requestId.current === currentRequest) setVersion({ status: "error", message: safeError(error, "JL Mixing Automation could not be checked.") });
    });
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const loading = workspace.status === "loading" || workspaceConfiguration.status === "loading" || version.status === "loading";
  return { workspace, setWorkspace, workspaceConfiguration, setWorkspaceConfiguration, version, refresh, loading };
}
