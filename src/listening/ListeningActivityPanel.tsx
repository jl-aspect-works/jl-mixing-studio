import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActionIcon } from "../components/ActionIcon";
import { safeError } from "../AppShellViews";
import {
  ListeningPublishStatus,
  type ListeningPublishEvent,
  type ListeningPublishResult,
  useListeningPublishEvent,
} from "./ListeningPublishStatus";

export function ListeningActivityPanel({
  clientId,
  projectId,
  deliveredRevision,
  mode,
}: {
  clientId: string;
  projectId: string;
  deliveredRevision: number | null;
  mode: "revisions" | "delivery";
}) {
  const revision = useListeningPublishEvent("revision-listening-publish-results", clientId, projectId);
  const delivered = useListeningPublishEvent("delivered-listening-publish-results", clientId, projectId);
  const [republishing, setRepublishing] = useState(false);
  const [republishError, setRepublishError] = useState<string | null>(null);

  const republish = async () => {
    setRepublishing(true);
    setRepublishError(null);
    try {
      const results = await invoke<ListeningPublishResult[]>("republish_delivered_listening", {
        request: { clientId, projectId },
      });
      const revisionNumber = deliveredRevision ?? delivered.event?.revision ?? 0;
      const event: ListeningPublishEvent = {
        clientId,
        projectId,
        revision: revisionNumber,
        results,
      };
      delivered.setEvent(event);
    } catch (error: unknown) {
      setRepublishError(safeError(error, "Delivered Listening could not be republished."));
    } finally {
      setRepublishing(false);
    }
  };

  if (mode === "revisions") {
    return <ListeningPublishStatus
      title="Revision Listening"
      event={revision.event}
      emptyMessage="Waiting for a stable primary mix. Automatic publishes will appear here without interrupting your workflow."
    />;
  }

  return <>
    <ListeningPublishStatus
      title="Delivered Listening"
      event={delivered.event}
      emptyMessage={deliveredRevision === null
        ? "Delivered Listening becomes available after the first successful delivery package build."
        : "No Delivered Listening publish result has been recorded on this screen yet."}
      actions={deliveredRevision !== null
        ? <button type="button" className="secondary" onClick={() => void republish()} disabled={republishing}>
            <ActionIcon name="refresh" />{republishing ? "Republishing…" : "Republish Delivered Listening"}
          </button>
        : undefined}
    />
    {republishError && <div className="inline-notice error" role="alert">{republishError}</div>}
  </>;
}
