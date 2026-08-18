import { useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { StudioCreationRequest, StudioOperationResult, WorkspaceSnapshot } from "../types";
import { safeError } from "../AppShellViews";
import { emptyStudioForm, type StudioFormValues, type StudioWorkflowState } from "./models";

function yieldToBrowserPaint(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function workspaceRootUnder(parent: string): string {
  const trimmed = parent.trim().replace(/[\\/]+$/, "");
  const separator = trimmed.includes("\\") && !trimmed.includes("/") ? "\\" : "/";
  return `${trimmed}${separator}Mixes`;
}

export function useStudioWorkflow({
  studioCreationAvailable,
  onWorkspaceRefreshed,
}: {
  studioCreationAvailable: boolean;
  onWorkspaceRefreshed: (workspace: WorkspaceSnapshot) => void;
}) {
  const [studioWorkflow, setStudioWorkflow] = useState<StudioWorkflowState>({ status: "closed" });
  const [studioForm, setStudioForm] = useState<StudioFormValues>(emptyStudioForm);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  const openStudioWorkflow = (workspaceRoot = "") => {
    if (!studioCreationAvailable) return;
    setStudioNotice(null);
    setStudioForm({ ...emptyStudioForm, workspaceRoot });
    setStudioWorkflow({ status: "editing" });
  };

  const closeStudioWorkflow = () => {
    if (studioWorkflow.status === "preflighting" || studioWorkflow.status === "creating") return;
    setStudioWorkflow({ status: "closed" });
  };

  const chooseWorkspaceLocation = async () => {
    if (studioWorkflow.status !== "editing") return;
    try {
      const selected = await invoke<string | null>("choose_workspace_folder");
      if (!selected) return;
      setStudioForm((current) => ({ ...current, workspaceRoot: workspaceRootUnder(selected) }));
      setStudioWorkflow({ status: "editing" });
    } catch (error: unknown) {
      setStudioWorkflow({ status: "editing", error: safeError(error, "The workspace location could not be selected.") });
    }
  };

  const createStudio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (studioWorkflow.status !== "editing") return;
    const request: StudioCreationRequest = {
      workspaceRoot: studioForm.workspaceRoot.trim(),
      studioName: studioForm.studioName.trim(),
      mixEngineer: studioForm.mixEngineer.trim() || null,
      sampleRate: Number(studioForm.sampleRate),
      bitDepth: Number(studioForm.bitDepth),
      fileFormat: studioForm.fileFormat,
    };
    if (!request.workspaceRoot) {
      setStudioWorkflow({ status: "editing", error: "Choose where to create the workspace." });
      return;
    }
    if (!request.studioName) {
      setStudioWorkflow({ status: "editing", error: "Studio name is required." });
      return;
    }

    setStudioWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();

    try {
      const preflight = await invoke<StudioOperationResult>("preflight_studio_creation", { request });
      if (!preflight.ok || preflight.code !== "ready" || !preflight.studio) {
        setStudioWorkflow({ status: "editing", error: preflight.message });
        return;
      }

      setStudioWorkflow({ status: "creating", request, preview: preflight.studio });
      await yieldToBrowserPaint();
      const result = await invoke<StudioOperationResult>("create_studio", { request });
      if (!result.ok || result.code !== "created") {
        if (result.code === "uncertain") {
          setStudioWorkflow({ status: "uncertain", message: result.message });
        } else {
          setStudioWorkflow({ status: "editing", error: result.message });
        }
        return;
      }

      const refreshed = await invoke<WorkspaceSnapshot>("set_workspace_root", { path: request.workspaceRoot });
      onWorkspaceRefreshed(refreshed);
      if (!refreshed.studio || refreshed.studio.studioName !== preflight.studio.studioName) {
        setStudioWorkflow({
          status: "uncertain",
          message: "Creation succeeded, but the configured workspace did not match the requested studio. Do not retry automatically.",
        });
        return;
      }
      setStudioNotice(`${refreshed.studio.studioName} was created and verified.`);
      setStudioWorkflow({ status: "closed" });
    } catch (error: unknown) {
      setStudioWorkflow({
        status: "uncertain",
        message: safeError(error, "The workspace operation could not be confirmed. Do not retry automatically."),
      });
    }
  };

  return {
    studioWorkflow,
    setStudioWorkflow,
    studioForm,
    setStudioForm,
    studioNotice,
    openStudioWorkflow,
    closeStudioWorkflow,
    chooseWorkspaceLocation,
    createStudio,
  };
}
