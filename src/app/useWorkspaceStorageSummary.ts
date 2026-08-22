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
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath || !available) {
      requestSequence.current += 1;
      inFlight.current = null;
      setState({ status: "idle", value: null, message: null });
      return;
    }

    if (inFlight.current) return inFlight.current;

    const sequence = ++requestSequence.current;
    setState((current) => ({ status: "loading", value: current.value, message: null }));
    inFlight.current = (async () => {
      try {
        const value = await invoke<WorkspaceStorageSummary>("summarize_workspace_storage");
        if (requestSequence.current !== sequence) return;
        setState({ status: "ready", value, message: null });
      } catch (error) {
        if (requestSequence.current !== sequence) return;
        setState((current) => ({ status: "error", value: current.value, message: errorMessage(error) }));
      } finally {
        if (requestSequence.current === sequence) inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [available, workspacePath]);

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
      inFlight.current = null;
    };
  }, [refresh]);

  useEffect(() => addWorkspaceRefreshListener((refreshStorage) => {
    if (refreshStorage) void refresh();
  }), [refresh]);

  return { state, refresh };
}
