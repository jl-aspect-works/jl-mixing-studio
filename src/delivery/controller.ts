import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ResourceState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type {
  DeliveryCreationPreview,
  DeliveryCreationRequest,
  DeliveryNotesDocument,
  DeliveryNotesUpdateRequest,
  DeliveryOperationResult,
  ProjectSummary,
  WorkspaceSnapshot,
} from "../types";
import type { DeliveryStatusResult } from "./statusModels";
import { sameDeliveryPlan, type DeliveryWorkflowState } from "./models";

const DELIVERY_NOTES_MAX_BYTES = 65_536;
const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseDeliveryWorkflowOptions {
  creationAvailable: boolean;
  clientId: string | null;
  project: ProjectSummary | null;
  setWorkspace: (state: ResourceState<WorkspaceSnapshot>) => void;
}

export function useDeliveryWorkflow({
  creationAvailable,
  clientId,
  project,
  setWorkspace,
}: UseDeliveryWorkflowOptions) {
  const [state, setState] = useState<DeliveryWorkflowState>({ status: "closed" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [savedDeliveryNote, setSavedDeliveryNote] = useState("");
  const [deliveryNoteLoading, setDeliveryNoteLoading] = useState(false);
  const [deliveryNoteError, setDeliveryNoteError] = useState<string | null>(null);
  const [deliveryNoteMaxBytes, setDeliveryNoteMaxBytes] = useState(DELIVERY_NOTES_MAX_BYTES);

  const loadDeliveryNote = (noteClientId: string, projectId: string) => {
    setDeliveryNoteLoading(true);
    setDeliveryNoteError(null);
    void invoke<DeliveryNotesDocument>("get_delivery_notes", {
      request: { clientId: noteClientId, projectId },
    })
      .then((document) => {
        setDeliveryNote(document.content);
        setSavedDeliveryNote(document.content);
        setDeliveryNoteMaxBytes(document.maxBytes);
      })
      .catch((error: unknown) => {
        setDeliveryNoteError(safeError(error, "Delivery Notes could not be read."));
      })
      .finally(() => setDeliveryNoteLoading(false));
  };

  const open = () => {
    if (!clientId || !project || !creationAvailable) return;
    const request: DeliveryCreationRequest = {
      clientId,
      projectId: project.projectId,
      replacementMode: project.delivery ? "overwrite" : "default",
      createZip: true,
      confirmedDeletions: [],
    };
    setNotice(null);
    setActionError(null);
    setDeliveryNote("");
    setSavedDeliveryNote("");
    setDeliveryNoteMaxBytes(DELIVERY_NOTES_MAX_BYTES);
    setState({ status: "options", request, cleanFirst: false });
    loadDeliveryNote(clientId, project.projectId);
  };

  const close = () => {
    if (state.status === "preflighting" || state.status === "creating") return;
    setState({ status: "closed" });
    setDeliveryNoteError(null);
  };

  const setCleanFirst = (cleanFirst: boolean) => {
    if (state.status !== "options") return;
    setState({ ...state, cleanFirst });
  };

  const setDeliveryNoteDraft = (value: string) => {
    if (state.status !== "options") return;
    setDeliveryNote(value);
    setDeliveryNoteError(null);
  };

  const saveDeliveryNote = async (request: DeliveryCreationRequest): Promise<boolean> => {
    if (deliveryNote === savedDeliveryNote) return true;
    const byteLength = new TextEncoder().encode(deliveryNote).length;
    if (byteLength > deliveryNoteMaxBytes) {
      setDeliveryNoteError(`Delivery Notes must not exceed ${deliveryNoteMaxBytes.toLocaleString()} bytes.`);
      return false;
    }
    const notesRequest: DeliveryNotesUpdateRequest = {
      clientId: request.clientId,
      projectId: request.projectId,
      content: deliveryNote,
    };
    try {
      const document = await invoke<DeliveryNotesDocument>("update_delivery_notes", {
        request: notesRequest,
      });
      setDeliveryNote(document.content);
      setSavedDeliveryNote(document.content);
      setDeliveryNoteMaxBytes(document.maxBytes);
      return document.content === deliveryNote;
    } catch (error: unknown) {
      setDeliveryNoteError(safeError(error, "Delivery Notes could not be saved before building the package."));
      return false;
    }
  };

  const finishBuild = async (
    request: DeliveryCreationRequest,
    preview: DeliveryCreationPreview,
    cleanFirst: boolean,
  ) => {
    setState({ status: "creating", request, preview, cleanFirst });
    await yieldToBrowserPaint();

    if (cleanFirst) {
      let deletedAny = false;
      try {
        const statusResult = await invoke<DeliveryStatusResult>("get_delivery_status", {
          request: { clientId: request.clientId, projectId: request.projectId },
        });
        if (!statusResult.ok || !statusResult.delivery) {
          setState({ status: "closed" });
          setActionError(statusResult.message || "The existing delivery packages could not be inspected safely.");
          return;
        }

        for (const pkg of statusResult.delivery.packages) {
          const deleteResult = await invoke<DeliveryStatusResult>("delete_delivery_package", {
            request: {
              clientId: request.clientId,
              projectId: request.projectId,
              zipName: pkg.name,
            },
          });
          if (!deleteResult.ok || !deleteResult.delivery) {
            if (deletedAny) {
              setState({
                status: "uncertain",
                message: deleteResult.message || "Some existing generated ZIPs were removed, but package cleanup did not finish. Refresh Delivery and verify the package list before trying again.",
              });
            } else {
              setState({ status: "closed" });
              setActionError(deleteResult.message || "Existing generated ZIPs could not be removed safely.");
            }
            return;
          }
          deletedAny = true;
        }
      } catch (error: unknown) {
        if (deletedAny) {
          setState({
            status: "uncertain",
            message: safeError(error, "Some existing generated ZIPs may have been removed, but package cleanup could not be confirmed. Refresh Delivery and verify the package list before trying again."),
          });
        } else {
          setState({ status: "closed" });
          setActionError(safeError(error, "Existing generated ZIPs could not be removed safely."));
        }
        return;
      }
    }

    try {
      const result = await invoke<DeliveryOperationResult>("create_delivery", { request });
      if (!result.ok || result.code !== "created" || !result.delivery) {
        if (result.code === "uncertain") {
          setState({ status: "uncertain", message: result.message });
        } else {
          setState({ status: "closed" });
          setActionError(result.message);
        }
        return;
      }
      if (
        !sameDeliveryPlan(preview, result.delivery) ||
        result.delivery.deliveredRevision !== preview.approvedRevision
      ) {
        setState({
          status: "uncertain",
          message:
            "The delivery package was built, but it did not match the approved revision Studio preflighted. Refresh Delivery and verify the result before trying again.",
        });
        return;
      }

      try {
        const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
        setWorkspace({ status: "ready", value: refreshed });
        const client = refreshed.clients.find((item) => item.clientId === request.clientId);
        const refreshedProject = client?.projects.find((item) => item.projectId === request.projectId);
        if (
          !refreshedProject?.delivery ||
          refreshedProject.deliveredRevision !== preview.approvedRevision
        ) {
          setState({
            status: "uncertain",
            message:
              "The delivery package was built, but the refreshed delivery details did not match the approved revision. Refresh Delivery and verify the result before trying again.",
          });
          return;
        }
        setNotice(
          `Package built from Revision ${refreshedProject.deliveredRevision} with ${refreshedProject.delivery.files.length} verified delivered ${refreshedProject.delivery.files.length === 1 ? "file" : "files"}.`,
        );
        setState({ status: "closed" });
      } catch (error: unknown) {
        setState({
          status: "uncertain",
          message: safeError(
            error,
            "The delivery package was built, but Studio could not refresh the project. Refresh Delivery and verify the result before trying again.",
          ),
        });
      }
    } catch (error: unknown) {
      setState({
        status: "uncertain",
        message: safeError(
          error,
          "The package-build result could not be confirmed. The operation may have completed; refresh Delivery and verify the result before trying again.",
        ),
      });
    }
  };

  const preflight = async () => {
    if (state.status !== "options" || !project || deliveryNoteLoading) return;
    const request: DeliveryCreationRequest = {
      ...state.request,
      replacementMode: project.delivery ? "overwrite" : "default",
      createZip: true,
      confirmedDeletions: [],
    };
    const { cleanFirst } = state;
    setDeliveryNoteError(null);
    setState({ status: "preflighting", request, cleanFirst });
    await yieldToBrowserPaint();

    try {
      const result = await invoke<DeliveryOperationResult>("preflight_delivery_creation", { request });
      if (
        result.ok &&
        result.code === "ready" &&
        result.delivery &&
        result.delivery.clientId === request.clientId &&
        result.delivery.projectId === request.projectId &&
        result.delivery.projectName === project.projectName &&
        result.delivery.currentRevision === project.currentRevision &&
        result.delivery.approvedRevision === project.approvedRevision &&
        result.delivery.deliveryMethod === project.deliveryMethod &&
        result.delivery.replacementMode === request.replacementMode &&
        result.delivery.createZip === true &&
        result.delivery.selected.length > 0
      ) {
        const notesSaved = await saveDeliveryNote(request);
        if (!notesSaved) {
          setState({ status: "options", request, cleanFirst });
          return;
        }
        await finishBuild(request, result.delivery, cleanFirst);
      } else {
        setState({ status: "closed" });
        setActionError(
          result.ok
            ? "The package preview no longer matches the approved revision. Refresh the project and build the package again."
            : result.message,
        );
      }
    } catch (error: unknown) {
      setState({ status: "closed" });
      setActionError(safeError(error, "The delivery package could not be prepared."));
    }
  };

  return {
    state,
    setState,
    actionError,
    setActionError,
    notice,
    setNotice,
    deliveryNote,
    deliveryNoteLoading,
    deliveryNoteError,
    deliveryNoteMaxBytes,
    open,
    close,
    setCleanFirst,
    setDeliveryNoteDraft,
    preflight,
  };
}
