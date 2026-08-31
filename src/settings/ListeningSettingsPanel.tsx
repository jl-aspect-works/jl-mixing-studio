import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActionIcon } from "../components/ActionIcon";

type ListeningPublishClass = "revisionListening" | "deliveredListening";
type ListeningMetadataPolicy = "off" | "fillMissing" | "replace";
type ListeningArtworkPolicy = "off" | "preserveExisting" | "replaceWithStudioArtwork";

interface ListeningDestination {
  id: string;
  enabled: boolean;
  publishClass: ListeningPublishClass;
  path: string;
  requiredExtension: string;
  metadataPolicy: ListeningMetadataPolicy;
  artworkPolicy: ListeningArtworkPolicy;
}

interface ListeningConfiguration {
  version: number;
  destinations: ListeningDestination[];
}

interface ListeningClassDefinition {
  publishClass: ListeningPublishClass;
  title: string;
  description: string;
  addLabel: string;
}

const CLASS_DEFINITIONS: ListeningClassDefinition[] = [
  {
    publishClass: "revisionListening",
    title: "Revision Listening",
    description: "Automatically publishes a stable bounce from the current revision so it is ready to listen without a separate delivery step.",
    addLabel: "Add Revision destination",
  },
  {
    publishClass: "deliveredListening",
    title: "Delivered Listening",
    description: "Publishes the artifact used by a successful delivery package build and supports manual republishing when recovery is needed.",
    addLabel: "Add Delivered destination",
  },
];

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function nextDestinationId(publishClass: ListeningPublishClass, destinations: ListeningDestination[]): string {
  const prefix = publishClass === "revisionListening" ? "revision-listening" : "delivered-listening";
  const existing = new Set(destinations.map((destination) => destination.id));
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${prefix}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${prefix}-${Date.now()}`;
}

function newDestination(publishClass: ListeningPublishClass, destinations: ListeningDestination[]): ListeningDestination {
  return {
    id: nextDestinationId(publishClass, destinations),
    enabled: false,
    publishClass,
    path: "",
    requiredExtension: "mp3",
    metadataPolicy: "replace",
    artworkPolicy: "replaceWithStudioArtwork",
  };
}

function policyLabel(value: ListeningMetadataPolicy | ListeningArtworkPolicy): string {
  switch (value) {
    case "fillMissing": return "Fill Missing";
    case "preserveExisting": return "Preserve Existing";
    case "replaceWithStudioArtwork": return "Replace with Studio Artwork";
    case "replace": return "Replace";
    case "off": return "Off";
  }
}

export function ListeningSettingsPanel() {
  const [configuration, setConfiguration] = useState<ListeningConfiguration | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    void invoke<ListeningConfiguration>("get_listening_configuration")
      .then((value) => {
        if (!active) return;
        setConfiguration(value);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(errorMessage(error, "Listening settings could not be loaded."));
      });
    return () => { active = false; };
  }, []);

  const destinationCounts = useMemo(() => {
    const counts: Record<ListeningPublishClass, number> = { revisionListening: 0, deliveredListening: 0 };
    configuration?.destinations.forEach((destination) => { counts[destination.publishClass] += 1; });
    return counts;
  }, [configuration]);

  const replaceDestination = (id: string, update: Partial<ListeningDestination>) => {
    if (!configuration) return;
    setConfiguration({
      ...configuration,
      destinations: configuration.destinations.map((destination) => destination.id === id
        ? { ...destination, ...update }
        : destination),
    });
    setDirty(true);
    setNotice(null);
    setSaveError(null);
  };

  const addDestination = (publishClass: ListeningPublishClass) => {
    if (!configuration) return;
    setConfiguration({
      ...configuration,
      destinations: [...configuration.destinations, newDestination(publishClass, configuration.destinations)],
    });
    setDirty(true);
    setNotice(null);
  };

  const removeDestination = (id: string) => {
    if (!configuration) return;
    setConfiguration({
      ...configuration,
      destinations: configuration.destinations.filter((destination) => destination.id !== id),
    });
    setDirty(true);
    setNotice(null);
  };

  const chooseFolder = async (id: string) => {
    try {
      const selected = await invoke<string | null>("choose_workspace_folder");
      if (selected) replaceDestination(id, { path: selected });
    } catch (error: unknown) {
      setSaveError(errorMessage(error, "The destination folder picker could not be opened."));
    }
  };

  const save = async () => {
    if (!configuration) return;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const saved = await invoke<ListeningConfiguration>("save_listening_configuration", { configuration });
      setConfiguration(saved);
      setDirty(false);
      setNotice("Listening destinations saved.");
    } catch (error: unknown) {
      setSaveError(errorMessage(error, "Listening settings could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="listening-settings" aria-labelledby="listening-settings-heading">
      <div className="panel-heading listening-settings-heading">
        <div>
          <p className="kicker">Settings &gt; Listening</p>
          <h2 id="listening-settings-heading">Listening</h2>
          <p className="health-detail">Publish listening copies to local, NAS, or mounted/synced folders. Studio copies the required format only; it never transcodes the source.</p>
        </div>
        <button type="button" onClick={() => void save()} disabled={!configuration || !dirty || saving} aria-busy={saving}>
          <ActionIcon name="save" />{saving ? "Saving…" : "Save Listening Settings"}
        </button>
      </div>

      {loadError && <section className="notice warning" role="alert"><strong>Listening settings unavailable</strong><span>{loadError}</span></section>}
      {saveError && <section className="notice warning" role="alert"><strong>Listening settings not saved</strong><span>{saveError}</span></section>}
      {notice && <section className="notice success" role="status"><strong>Listening updated</strong><span>{notice}</span></section>}

      {!configuration && !loadError && <section className="panel"><p className="health-detail">Loading Listening settings…</p></section>}

      {configuration && (
        <div className="listening-class-grid">
          {CLASS_DEFINITIONS.map((definition) => {
            const destinations = configuration.destinations.filter((destination) => destination.publishClass === definition.publishClass);
            return (
              <section className="panel listening-class-card" key={definition.publishClass}>
                <div className="panel-heading">
                  <div>
                    <p className="kicker">{destinationCounts[definition.publishClass]} destination{destinationCounts[definition.publishClass] === 1 ? "" : "s"}</p>
                    <h3>{definition.title}</h3>
                    <p className="health-detail">{definition.description}</p>
                  </div>
                </div>

                {destinations.length === 0 && (
                  <div className="listening-empty-state">
                    <strong>Not configured</strong>
                    <span>Add a destination when you want Studio to publish {definition.title.toLowerCase()} copies.</span>
                  </div>
                )}

                <div className="listening-destination-list">
                  {destinations.map((destination) => (
                    <article className="listening-destination" key={destination.id}>
                      <div className="listening-destination-header">
                        <label className="setting-row listening-enable-row">
                          <span><strong>{destination.requiredExtension.toUpperCase()} destination</strong><small>{destination.enabled ? "Enabled" : "Disabled"}</small></span>
                          <input type="checkbox" checked={destination.enabled} onChange={(event) => replaceDestination(destination.id, { enabled: event.target.checked })} />
                        </label>
                        <button type="button" className="secondary listening-remove" onClick={() => removeDestination(destination.id)}>Remove</button>
                      </div>

                      <label className="listening-field listening-path-field">
                        <span>Destination folder</span>
                        <div className="listening-path-control">
                          <input type="text" value={destination.path} placeholder="Choose a folder…" onChange={(event) => replaceDestination(destination.id, { path: event.target.value })} />
                          <button type="button" className="secondary" onClick={() => void chooseFolder(destination.id)}><ActionIcon name="folder" />Choose…</button>
                        </div>
                      </label>

                      <div className="listening-policy-grid">
                        <label className="listening-field">
                          <span>Required format</span>
                          <select value={destination.requiredExtension} onChange={(event) => replaceDestination(destination.id, { requiredExtension: event.target.value })}>
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                            <option value="flac">FLAC</option>
                            <option value="m4a">M4A</option>
                          </select>
                        </label>
                        <label className="listening-field">
                          <span>Metadata</span>
                          <select value={destination.metadataPolicy} onChange={(event) => replaceDestination(destination.id, { metadataPolicy: event.target.value as ListeningMetadataPolicy })}>
                            {(["off", "fillMissing", "replace"] as ListeningMetadataPolicy[]).map((value) => <option value={value} key={value}>{policyLabel(value)}</option>)}
                          </select>
                        </label>
                        <label className="listening-field">
                          <span>Artwork</span>
                          <select value={destination.artworkPolicy} onChange={(event) => replaceDestination(destination.id, { artworkPolicy: event.target.value as ListeningArtworkPolicy })}>
                            {(["off", "preserveExisting", "replaceWithStudioArtwork"] as ListeningArtworkPolicy[]).map((value) => <option value={value} key={value}>{policyLabel(value)}</option>)}
                          </select>
                        </label>
                      </div>
                    </article>
                  ))}
                </div>

                <button type="button" className="secondary listening-add" onClick={() => addDestination(definition.publishClass)}><ActionIcon name="add" />{definition.addLabel}</button>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
