import { type FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ResourceState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type {
  ClientCreationRequest,
  ClientOperationResult,
  WorkspaceSnapshot,
} from "../types";
import {
  clientIdPattern,
  deriveClientId,
  emptyClientForm,
  type ClientFormValues,
  type ClientWorkflowState,
} from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseClientWorkflowOptions {
  creationAvailable: boolean;
  setWorkspace: (state: ResourceState<WorkspaceSnapshot>) => void;
  setNotice: (notice: string | null) => void;
  onOpen?: () => void;
}

export function useClientWorkflow({
  creationAvailable,
  setWorkspace,
  setNotice,
  onOpen,
}: UseClientWorkflowOptions) {
  const [state, setState] = useState<ClientWorkflowState>({ status: "closed" });
  const [form, setForm] = useState<ClientFormValues>(emptyClientForm);

  const open = () => {
    if (!creationAvailable) return;
    setNotice(null);
    onOpen?.();
    setForm(emptyClientForm);
    setState({ status: "editing" });
  };

  const close = () => {
    if (state.status === "preflighting" || state.status === "creating") return;
    setState({ status: "closed" });
  };

  const back = () => setState({ status: "editing" });

  const preflight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "editing") return;

    const clientName = form.clientName.trim();
    const request: ClientCreationRequest = {
      clientId: deriveClientId(clientName),
      clientName,
      defaultArtist: form.defaultArtist.trim() || null,
    };
    if (!request.clientName) {
      setState({ status: "editing", error: "Display name is required." });
      return;
    }
    if (!clientIdPattern.test(request.clientId)) {
      setState({
        status: "editing",
        error: "Display name does not produce a usable Client ID.",
      });
      return;
    }

    setState({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<ClientOperationResult>("preflight_client_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.client) {
          setState({ status: "confirming", request, preview: result.client });
        } else {
          setState({ status: "editing", error: result.message });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "editing",
          error: safeError(error, "The client details could not be reviewed."),
        });
      });
  };

  const confirm = async () => {
    if (state.status !== "confirming") return;
    const { request, preview } = state;
    setState({ status: "creating", request, preview });
    await yieldToBrowserPaint();

    invoke<ClientOperationResult>("create_client", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created") {
          setState({ status: "editing", error: result.message });
          return;
        }

        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const discovered = refreshed.clients.some(
            (client) => client.clientId === request.clientId,
          );
          if (!discovered) {
            setState({
              status: "uncertain",
              message: "The client creation completed, but the new client was not found after refresh. The result is uncertain.",
            });
            return;
          }
          setNotice(`${request.clientName} was added to your studio.`);
          setState({ status: "closed" });
        } catch (error: unknown) {
          setState({
            status: "uncertain",
            message: safeError(
              error,
              "The client was created, but the studio could not be refreshed. The result is uncertain.",
            ),
          });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "editing",
          error: safeError(error, "Client creation could not be completed."),
        });
      });
  };

  return {
    state,
    setState,
    form,
    setForm,
    open,
    close,
    back,
    preflight,
    confirm,
  };
}
