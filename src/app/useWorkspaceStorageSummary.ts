import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { addWorkspaceRefreshListener } from "./workspaceRefreshEvents";

export type WorkspaceStorageSummary = {
  fileCount: number;
  sizeBytes: number;
  failedPaths: string[];
};

export type WorkspaceStorageState =
  | { status: "idle"; value: null; message: null }
  | { status: "loading"; value: WorkspaceStorageSummary | null; message: null }
  | { status: "ready"; value: WorkspaceStorageSummary; message: null }
  | { status: "error"; value: WorkspaceStorageSummary | null; message: string };

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "Workspace storage usage could not be calculated.";

export function useWorkspaceStorageSummary({
  workspacePath,
  available,
}: {
  workspacePath: string | null;
  available: boolean;
}) {
  const [state, setState] = useState<WorkspaceStorageState>({ status: "idle", value: null, message: null });
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!workspacePath || !available) {
      requestSequence.current += 1;
      setState({ status: "idle", value: null, message: null });
      return;
    }

    const sequence = ++requestSequence.current;
    setState((current) => ({ status: "loading", value: current.value, message: null }));
    try {
      const value = await invoke<WorkspaceStorageSummary>("summarize_workspace_storage");
      if (requestSequence.current !== sequence) return;
      setState({ status: "ready", value, message: null });
    } catch (error) {
      if (requestSequence.current !== sequence) return;
      setState((current) => ({ status: "error", value: current.value, message: errorMessage(error) }));
    }
  }, [available, workspacePath]);

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  useEffect(() => addWorkspaceRefreshListener(() => { void refresh(); }), [refresh]);

  return { state, refresh };
}
