import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActionIcon } from "../components/ActionIcon";
import { ListeningPublishStatus } from "./ListeningPublishStatus";
import {
  useLatestListeningPublishEvent,
  type ListeningPublishResult,
} from "./listeningPublishEvents";

type ListeningPublishClass = "revisionListening" | "deliveredListening";

interface ListeningDestinationConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  publishClass: ListeningPublishClass;
  requiredExtension: string;
}

interface ListeningConfiguration {
  destinations: ListeningDestinationConfiguration[];
}

interface EmptyState {
  title: string;
  message: string;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Delivered Listening could not be republished.";
}

function emptyState(
  configuration: ListeningConfiguration | null,
  configurationError: string | null,
  publishClass: ListeningPublishClass,
  title: string,
): EmptyState {
  if (configurationError) {
    return {
      title: "Configuration unavailable",
      message: "Studio could not read Listening configuration. Review Settings > Listening before publishing.",
    };
  }
  if (!configuration) {
    return {
      title: "Checking configuration",
      message: "Studio is checking whether Listening is configured for this publish class.",
    };
  }
  const enabled = configuration.destinations.filter((destination) =>
    destination.enabled && destination.publishClass === publishClass);
  if (enabled.length === 0) {
    return {
      title: "Not configured",
      message: `Enable at least one ${title} destination in Settings > Listening to publish copies for this workflow.`,
    };
  }
  return {
    title: "No activity this session",
    message: `${title} is configured. The latest publish result for this project will appear here after a publish runs in this Studio session.`,
  };
}

function republishSummary(results: ListeningPublishResult[]): { kind: "success" | "warning"; message: string } {
  if (results.length === 0) {
    return { kind: "warning", message: "No enabled Delivered Listening destinations were available to republish." };
  }
  const published = results.filter((result) => result.status === "published").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const parts = [
    published > 0 ? `${published} published` : null,
    skipped > 0 ? `${skipped} skipped` : null,
    failed > 0 ? `${failed} failed` : null,
  ].filter((part): part is string => part !== null);
  return {
    kind: failed > 0 || skipped > 0 ? "warning" : "success",
    message: `Delivered Listening republish complete: ${parts.join(", ")}.`,
  };
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
  const [configuration, setConfiguration] = useState<ListeningConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [republishing, setRepublishing] = useState(false);
  const [republishError, setRepublishError] = useState<string | null>(null);
  const [republishNotice, setRepublishNotice] = useState<{ kind: "success" | "warning"; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    void invoke<ListeningConfiguration>("get_listening_configuration")
      .then((value) => {
        if (!active) return;
        setConfiguration(value);
        setConfigurationError(null);
      })
      .catch(() => {
        if (!active) return;
        setConfigurationError("Listening configuration could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  const destinationNames = Object.fromEntries(
    (configuration?.destinations ?? []).map((destination) => [destination.id, destination.name]),
  );
  const deliveredDestinations = (configuration?.destinations ?? []).filter((destination) =>
    destination.enabled && destination.publishClass === "deliveredListening");

  const republish = async () => {
    setRepublishing(true);
    setRepublishError(null);
    setRepublishNotice(null);
    try {
      const results = await invoke<ListeningPublishResult[]>("republish_delivered_listening", { request: { clientId, projectId } });
      setRepublishNotice(republishSummary(results));
    } catch (error: unknown) {
      setRepublishError(errorMessage(error));
    } finally {
      setRepublishing(false);
    }
  };

  if (mode === "revisions") {
    const empty = emptyState(configuration, configurationError, "revisionListening", "Revision Listening");
    return <ListeningPublishStatus
      title="Revision Listening"
      event={revision}
      emptyTitle={empty.title}
      emptyMessage={empty.message}
      destinationNames={destinationNames}
    />;
  }

  const empty = deliveredRevision === null && deliveredDestinations.length > 0
    ? {
        title: "Waiting for first delivery",
        message: "Delivered Listening is configured and will publish after the first successful delivery package build.",
      }
    : emptyState(configuration, configurationError, "deliveredListening", "Delivered Listening");

  return <>
    <ListeningPublishStatus
      title="Delivered Listening"
      event={delivered}
      emptyTitle={empty.title}
      emptyMessage={empty.message}
      destinationNames={destinationNames}
      actions={deliveredRevision !== null && deliveredDestinations.length > 0
        ? <button type="button" className="secondary" onClick={() => void republish()} disabled={republishing} aria-busy={republishing}>
            <ActionIcon name="refresh" />{republishing ? "Republishing…" : "Republish Delivered Listening"}
          </button>
        : undefined}
    />
    {republishNotice && <div className={`inline-notice ${republishNotice.kind}`} role="status">{republishNotice.message}</div>}
    {republishError && <div className="inline-notice error" role="alert">{republishError}</div>}
  </>;
}
