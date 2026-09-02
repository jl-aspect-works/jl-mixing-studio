import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    title: "No publishable copy yet",
    message: `${title} is configured. Studio will publish automatically when a matching source becomes available.`,
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
  const deliveredDestinationKey = deliveredDestinations
    .map((destination) => destination.id)
    .sort()
    .join("\u0000");

  useEffect(() => {
    if (mode !== "delivery" || deliveredRevision === null || !deliveredDestinationKey) return;
    void invoke<ListeningPublishResult[]>("republish_delivered_listening", {
      request: { clientId, projectId },
    }).catch(() => undefined);
  }, [clientId, deliveredDestinationKey, deliveredRevision, mode, projectId]);

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
        message: "Delivered Listening is configured and will publish automatically after the first successful delivery build.",
      }
    : emptyState(configuration, configurationError, "deliveredListening", "Delivered Listening");

  return <ListeningPublishStatus
    title="Delivered Listening"
    event={delivered}
    emptyTitle={empty.title}
    emptyMessage={empty.message}
    destinationNames={destinationNames}
  />;
}
