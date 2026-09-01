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

export function ListeningSettingsActivity() {
  const revision = useLatestListeningPublishEvent("revision-listening-publish-results");
  const delivered = useLatestListeningPublishEvent("delivered-listening-publish-results");
  const [republishing, setRepublishing] = useState(false);
  const [republishError, setRepublishError] = useState<string | null>(null);

  const republish = async () => {
    if (!delivered) return;
    setRepublishing(true);
    setRepublishError(null);
    try {
      await invoke("republish_delivered_listening", {
        request: { clientId: delivered.clientId, projectId: delivered.projectId },
      });
    } catch (error: unknown) {
      setRepublishError(errorMessage(error));
    } finally {
      setRepublishing(false);
    }
  };

  return <section className="listening-settings-activity" aria-labelledby="listening-activity-heading">
    <div className="panel-heading">
      <div>
        <p className="kicker">Observability</p>
        <h2 id="listening-activity-heading">Recent Listening Activity</h2>
        <p className="health-detail">Latest Revision and Delivered Listening results from this Studio session.</p>
      </div>
      {delivered && <button type="button" className="secondary" onClick={() => void republish()} disabled={republishing}>
        <ActionIcon name="refresh" />{republishing ? "Republishing…" : "Republish Delivered Listening"}
      </button>}
    </div>
    {republishError && <div className="inline-notice error" role="alert">{republishError}</div>}
    <div className="listening-class-grid">
      <ListeningPublishStatus
        title="Revision Listening"
        event={revision}
        emptyMessage="No Revision Listening publish result has been recorded in this session yet."
      />
      <ListeningPublishStatus
        title="Delivered Listening"
        event={delivered}
        emptyMessage="No Delivered Listening publish result has been recorded in this session yet."
      />
    </div>
  </section>;
}
