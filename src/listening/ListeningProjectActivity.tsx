import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActionIcon } from "../components/ActionIcon";
import { ListeningPublishStatus } from "./ListeningPublishStatus";
import { useLatestListeningPublishEvent } from "./listeningPublishEvents";

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Delivered Listening could not be republished.";
}

export function ListeningProjectActivity({
  clientId,
  projectId,
  mode,
  deliveredRevision,
}: {
  clientId: string;
  projectId: string;
  mode: "revisions" | "delivery";
  deliveredRevision: number | null;
}) {
  const latestRevision = useLatestListeningPublishEvent("revision-listening-publish-results");
  const latestDelivered = useLatestListeningPublishEvent("delivered-listening-publish-results");
  const revision = latestRevision?.clientId === clientId && latestRevision.projectId === projectId ? latestRevision : null;
  const delivered = latestDelivered?.clientId === clientId && latestDelivered.projectId === projectId ? latestDelivered : null;
  const [republishing, setRepublishing] = useState(false);
  const [republishError, setRepublishError] = useState<string | null>(null);

  const republish = async () => {
    setRepublishing(true);
    setRepublishError(null);
    try {
      await invoke("republish_delivered_listening", { request: { clientId, projectId } });
    } catch (error: unknown) {
      setRepublishError(errorMessage(error));
    } finally {
      setRepublishing(false);
    }
  };

  if (mode === "revisions") {
    return <ListeningPublishStatus
      title="Revision Listening"
      event={revision}
      emptyMessage="No Revision Listening publish result has been recorded for this project in this Studio session yet."
    />;
  }

  return <>
    <ListeningPublishStatus
      title="Delivered Listening"
      event={delivered}
      emptyMessage={deliveredRevision === null
        ? "Delivered Listening becomes available after the first successful delivery package build."
        : "No Delivered Listening publish result has been recorded for this project in this Studio session yet."}
      actions={deliveredRevision !== null
        ? <button type="button" className="secondary" onClick={() => void republish()} disabled={republishing}>
            <ActionIcon name="refresh" />{republishing ? "Republishing…" : "Republish Delivered Listening"}
          </button>
        : undefined}
    />
    {republishError && <div className="inline-notice error" role="alert">{republishError}</div>}
  </>;
}
