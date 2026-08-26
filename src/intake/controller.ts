import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { IntakeReportState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import { addWorkspaceRefreshListener } from "../app/workspaceRefreshEvents";
import type { IntakeOperationResult, IntakeRequest } from "../types";
import type { IntakeValidationProgress, IntakeWorkflowState } from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseIntakeWorkflowOptions {
  validationAvailable: boolean;
  clientId: string | null;
  projectId: string | null;
  onOpen?: () => void;
}

export function useIntakeWorkflow({
  validationAvailable,
  clientId,
  projectId,
  onOpen,
}: UseIntakeWorkflowOptions) {
  const [reportState, setReportState] = useState<IntakeReportState>({ status: "idle" });
  const [state, setState] = useState<IntakeWorkflowState>({ status: "closed" });
  const [progress, setProgress] = useState<IntakeValidationProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reportRequestSequence = useRef(0);
  const validationInFlightKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void listen<IntakeValidationProgress>("intake-validation-progress", ({ payload }) => {
      if (
        !cancelled &&
        payload.clientId === clientId &&
        payload.projectId === projectId
      ) {
        setProgress(payload);
      }
    }).then((removeListener) => {
      if (cancelled) removeListener();
      else unlisten = removeListener;
    }).catch(() => {
      // Older/non-Tauri test hosts may not expose the event channel. Validation itself still works.
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [clientId, projectId]);

  const currentRequest = (): IntakeRequest | null =>
    clientId && projectId ? { clientId, projectId } : null;

  const loadReport = useCallback(async (request: IntakeRequest, showLoading = true) => {
    const sequence = ++reportRequestSequence.current;
    if (showLoading) setReportState({ status: "loading" });
    try {
      const result = await invoke<IntakeOperationResult>("get_intake_report", { request });
      if (reportRequestSequence.current === sequence) {
        setReportState({ status: "ready", value: result });
      }
    } catch (error: unknown) {
      if (reportRequestSequence.current === sequence) {
        setReportState({
          status: "error",
          message: safeError(error, "The intake report could not be read."),
        });
      }
    }
  }, []);

  const refreshClientFiles = useCallback(async (
    request: IntakeRequest,
    announce: boolean,
    preserveCurrentReport = false,
  ) => {
    const validationKey = `${request.clientId}\u0000${request.projectId}`;
    if (validationInFlightKey.current === validationKey) return;
    validationInFlightKey.current = validationKey;

    const sequence = ++reportRequestSequence.current;
    setActionError(null);
    setProgress(null);
    if (announce) setNotice(null);
    if (!preserveCurrentReport) setReportState({ status: "loading" });
    setState({ status: "preflighting" });
    await yieldToBrowserPaint();
    try {
      const result = await invoke<IntakeOperationResult>("refresh_client_files_validation", { request });
      if (reportRequestSequence.current !== sequence) return;
      if (
        result.ok &&
        result.report &&
        (result.code === "validated" || result.code === "blockingFindings")
      ) {
        setReportState({ status: "ready", value: result });
        setState({ status: "closed" });
        if (announce) {
          setNotice(
            result.report.blockingErrors > 0
              ? "Client Files were rechecked with blocking findings."
              : "Client Files validation is up to date.",
          );
        }
        return;
      }

      setState({ status: "closed" });
      if (result.code === "rejected") {
        void loadReport(request, preserveCurrentReport ? false : true);
        if (announce) setActionError(result.message);
        return;
      }

      setActionError(result.message);
      void loadReport(request, preserveCurrentReport ? false : true);
    } catch (error) {
      if (reportRequestSequence.current !== sequence) return;
      setState({ status: "closed" });
      setActionError(safeError(error, "Project file validation could not be refreshed."));
      void loadReport(request, preserveCurrentReport ? false : true);
    } finally {
      setProgress(null);
      if (validationInFlightKey.current === validationKey) {
        validationInFlightKey.current = null;
      }
    }
  }, [loadReport]);

  useEffect(() => {
    if (!clientId || !projectId) {
      reportRequestSequence.current += 1;
      setReportState({ status: "idle" });
      setProgress(null);
      return;
    }

    const request: IntakeRequest = { clientId, projectId };
    void loadReport(request);
    return () => {
      reportRequestSequence.current += 1;
    };
  }, [clientId, projectId, loadReport]);

  useEffect(() => {
    if (!clientId || !projectId) return;
    const request: IntakeRequest = { clientId, projectId };
    return addWorkspaceRefreshListener(() => {
      void loadReport(request, false);
    });
  }, [clientId, projectId, loadReport]);

  const reload = () => {
    const request = currentRequest();
    if (request) void loadReport(request);
  };

  const refreshStructured = () => {
    const request = currentRequest();
    if (!request || !validationAvailable) return;
    void refreshClientFiles(request, false, true);
  };

  const open = () => {
    const request = currentRequest();
    if (!request) return;
    onOpen?.();
    setState({ status: "closed" });
    setActionError(null);
    setNotice(null);
    setProgress(null);
    if (reportState.status === "idle") {
      void loadReport(request);
    }
  };

  const recheck = () => {
    const request = currentRequest();
    if (!request || !validationAvailable) return;
    void refreshClientFiles(request, true, true);
  };

  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
    setProgress(null);
  };

  const clear = () => {
    reportRequestSequence.current += 1;
    reset();
    setReportState({ status: "idle" });
  };

  const preflight = async () => {
    const request = currentRequest();
    if (!request || !validationAvailable) return;
    setActionError(null);
    setNotice(null);
    setProgress(null);
    setState({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<IntakeOperationResult>("preflight_intake_validation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.report &&
          (result.code === "ready" || result.code === "blockingFindings")
        ) {
          setState({ status: "confirming", preview: result.report });
        } else {
          setState({ status: "closed" });
          setActionError(result.message);
        }
      })
      .catch((error: unknown) => {
        setState({ status: "closed" });
        setActionError(safeError(error, "The intake preview could not be completed."));
      });
  };

  const confirm = async () => {
    const request = currentRequest();
    if (state.status !== "confirming" || !request) return;
    const preview = state.preview;
    setProgress(null);
    setState({ status: "running", preview });
    await yieldToBrowserPaint();
    invoke<IntakeOperationResult>("run_intake_validation", { request })
      .then((result) => {
        if (result.code === "uncertain") {
          setState({ status: "uncertain", message: result.message });
          return;
        }
        if (
          !result.ok ||
          !result.report ||
          (result.code !== "validated" && result.code !== "blockingFindings")
        ) {
          setState({ status: "closed" });
          setActionError(result.message);
          return;
        }
        if (
          result.report.clientId !== request.clientId ||
          result.report.projectId !== request.projectId
        ) {
          setState({
            status: "uncertain",
            message: "The intake report was updated, but its project identity could not be verified. Do not retry automatically.",
          });
          return;
        }
        reportRequestSequence.current += 1;
        setReportState({ status: "ready", value: result });
        setState({ status: "closed" });
        setNotice(
          result.report.blockingErrors > 0
            ? "The intake report was updated with blocking findings."
            : "The intake report was updated and verified.",
        );
      })
      .catch((error: unknown) => {
        setState({
          status: "uncertain",
          message: safeError(
            error,
            "The intake-validation result could not be confirmed. The report may have been updated; do not retry automatically.",
          ),
        });
      })
      .finally(() => setProgress(null));
  };

  const closeDialog = () => {
    if (state.status === "running") return;
    setState({ status: "closed" });
    setProgress(null);
    reload();
  };

  return {
    state,
    progress,
    reportState,
    actionError,
    notice,
    open,
    reset,
    clear,
    reload,
    refreshStructured,
    recheck,
    preflight,
    confirm,
    closeDialog,
  };
}