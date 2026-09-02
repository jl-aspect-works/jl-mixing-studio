import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";
import { ActionIcon } from "../components/ActionIcon";
import { copy as productCopy } from "../resources/copy";
import type { AppPreferences } from "../AppWorkflowModels";
import { ListeningSettingsPanel } from "./ListeningSettingsPanel";
import type { WorkspaceConfiguration } from "./models";

interface SettingsRouteProps {
  preferences: AppPreferences;
  onChange: (value: AppPreferences) => void;
  workspace: ResourceState<WorkspaceSnapshot>;
  workspaceConfiguration: ResourceState<WorkspaceConfiguration>;
  version: ResourceState<VersionCheck>;
  onWorkspaceChanged: (snapshot: WorkspaceSnapshot) => void;
  onCreateWorkspace: () => void;
  onRefresh: () => void;
}

type WorkspaceAction = "idle" | "changing" | "opening";
type SettingsTab = "workspace" | "listening";

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function workspaceStatusLabel(workspace: ResourceState<WorkspaceSnapshot>): string {
  if (workspace.status === "loading") return "Checking…";
  if (workspace.status === "error") return "Unavailable";
  switch (workspace.value.status) {
    case "healthy": return "Connected";
    case "empty": return "Connected — no projects yet";
    case "partial": return "Connected — needs attention";
    case "unavailable": return "Workspace unavailable";
    case "invalid": return "Invalid workspace";
  }
}

export function SettingsRoute({
  preferences,
  onChange,
  workspace,
  workspaceConfiguration,
  version,
  onWorkspaceChanged,
  onCreateWorkspace,
  onRefresh,
}: SettingsRouteProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("workspace");
  const [workspaceAction, setWorkspaceAction] = useState<WorkspaceAction>("idle");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("Not checked yet");
  const [studioVersion, setStudioVersion] = useState<string | null>(null);

  useEffect(() => {
    if (workspace.status === "ready" || workspace.status === "error") {
      setLastChecked(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }
  }, [workspace]);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((value) => { if (active) setStudioVersion(value); })
      .catch(() => { if (active) setStudioVersion("Unavailable"); });
    return () => { active = false; };
  }, []);

  const update = (value: AppPreferences) => {
    localStorage.setItem("jl-mixing-studio.preferences", JSON.stringify(value));
    onChange(value);
  };

  const changeWorkspace = async () => {
    setWorkspaceAction("changing");
    setWorkspaceError(null);
    setWorkspaceNotice(null);
    try {
      const selected = await invoke<string | null>("choose_workspace_folder");
      if (!selected) return;
      const candidate = await invoke<WorkspaceSnapshot>("validate_workspace_root", { path: selected });
      const snapshot = await invoke<WorkspaceSnapshot>("set_workspace_root", { path: candidate.workspacePath });
      onWorkspaceChanged(snapshot);
      setWorkspaceNotice(`Workspace changed to ${snapshot.workspacePath}.`);
    } catch (error: unknown) {
      setWorkspaceError(errorMessage(error, "The selected workspace could not be validated or activated."));
    } finally {
      setWorkspaceAction("idle");
    }
  };

  const openWorkspace = async () => {
    setWorkspaceAction("opening");
    setWorkspaceError(null);
    try {
      await invoke("open_folder", {
        request: { location: "workspace", clientId: null, projectId: null },
      });
    } catch (error: unknown) {
      setWorkspaceError(errorMessage(error, "The workspace folder could not be opened."));
    } finally {
      setWorkspaceAction("idle");
    }
  };

  const selectRelativeTab = (direction: -1 | 1) => {
    const tabs: SettingsTab[] = ["workspace", "listening"];
    const index = tabs.indexOf(activeTab);
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex]);
  };

  const currentPath = workspaceConfiguration.status === "ready"
    ? workspaceConfiguration.value.workspacePath
    : workspace.status === "ready"
      ? workspace.value.workspacePath
      : "Unavailable";
  const connected = workspace.status === "ready"
    && workspace.value.status !== "unavailable"
    && workspace.value.status !== "invalid";
  const canOpen = connected && workspaceAction === "idle";
  const automationVersion = version.status === "ready" && version.value.available
    ? version.value.version ?? "Unknown"
    : "Unavailable";

  return (
    <section className="planned-route" aria-labelledby="settings-heading">
      <div className="panel-heading">
        <div>
          <p className="kicker">Settings</p>
          <h2 id="settings-heading">Configuration</h2>
          <p className="health-detail">Configure this Studio installation and where it publishes listening copies.</p>
        </div>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button
          id="settings-workspace-tab"
          type="button"
          role="tab"
          className={`settings-tab${activeTab === "workspace" ? " active" : ""}`}
          aria-selected={activeTab === "workspace"}
          aria-controls="settings-workspace-panel"
          tabIndex={activeTab === "workspace" ? 0 : -1}
          onClick={() => setActiveTab("workspace")}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              selectRelativeTab(event.key === "ArrowRight" ? 1 : -1);
            }
          }}
        >
          Workspace
        </button>
        <button
          id="settings-listening-tab"
          type="button"
          role="tab"
          className={`settings-tab${activeTab === "listening" ? " active" : ""}`}
          aria-selected={activeTab === "listening"}
          aria-controls="settings-listening-panel"
          tabIndex={activeTab === "listening" ? 0 : -1}
          onClick={() => setActiveTab("listening")}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              selectRelativeTab(event.key === "ArrowRight" ? 1 : -1);
            }
          }}
        >
          Listening
        </button>
      </div>

      {activeTab === "workspace" && (
        <div
          id="settings-workspace-panel"
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby="settings-workspace-tab"
        >
          <div className="panel-heading">
            <div>
              <p className="kicker">Settings &gt; Workspace</p>
              <h2>Workspace</h2>
              <p className="health-detail">Choose where JL Mixing projects live on this computer. Local disks, NAS shares, and OS-mounted cloud folders are supported as ordinary filesystem paths.</p>
            </div>
          </div>

          {workspaceNotice && <section className="notice success" role="status"><strong>Workspace updated</strong><span>{workspaceNotice}</span></section>}
          {workspaceError && <section className="notice warning" role="alert"><strong>Workspace action failed</strong><span>{workspaceError}</span></section>}

          <div className="project-detail-grid">
            <section className="panel">
              <div className="panel-heading">
                <div><p className="kicker">Configured location</p><h3>{workspaceStatusLabel(workspace)}</h3></div>
                <span className="planned-pill">{workspaceConfiguration.status === "ready" && workspaceConfiguration.value.configured ? "Configured" : "Default"}</span>
              </div>
              <div className="folder-control">
                <code>{currentPath}</code>
                <small>{workspaceConfiguration.status === "ready" && workspaceConfiguration.value.configured
                  ? "Saved locally for this Studio installation. Other computers may use a different path to the same shared workspace."
                  : "No explicit workspace has been saved yet; Studio is using the default ~/Music/Mixes location."}</small>
                <div className="directory-actions">
                  <button type="button" onClick={() => void changeWorkspace()} disabled={workspaceAction !== "idle"} aria-busy={workspaceAction === "changing"}><ActionIcon name="folder" />{workspaceAction === "changing" ? "Changing…" : "Change Workspace…"}</button>
                  <button type="button" className="secondary" onClick={onCreateWorkspace} disabled={workspaceAction !== "idle"}><ActionIcon name="add" />Create New Workspace…</button>
                  <button type="button" className="secondary" onClick={openWorkspace} disabled={!canOpen} aria-busy={workspaceAction === "opening"}><ActionIcon name="folder" />Open Workspace Folder</button>
                  <button type="button" className="secondary" onClick={onRefresh} disabled={workspaceAction !== "idle"}><ActionIcon name="refresh" />Refresh Status</button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="kicker">Health</p><h3>Workspace status</h3></div></div>
              <dl className="health-list">
                <div><dt>Connection</dt><dd><span className={`status-dot${connected ? " good" : ""}`} />{workspaceStatusLabel(workspace)}</dd></div>
                <div><dt>Last checked</dt><dd>{lastChecked}</dd></div>
                <div><dt>Workspace folder</dt><dd>{connected ? "Reachable" : "Unavailable"}</dd></div>
                <div><dt>Project data</dt><dd>{workspace.status === "ready" ? (workspace.value.status === "partial" ? "Accessible with issues" : connected ? "Accessible" : "Unavailable") : "Not checked"}</dd></div>
                <div><dt>Clients</dt><dd>{workspace.status === "ready" ? workspace.value.counts.clients : "—"}</dd></div>
                <div><dt>Projects</dt><dd>{workspace.status === "ready" ? workspace.value.counts.projects : "—"}</dd></div>
                <div><dt>Automation</dt><dd>{version.status === "ready" ? (version.value.supported ? "Compatible" : version.value.available ? "Incompatible" : "Unavailable") : "Not checked"}</dd></div>
              </dl>
              <p className="health-detail">If a shared or synchronized workspace disconnects, Studio keeps this configured path and reports it unavailable. Refresh after reconnecting; Studio does not silently fall back to another workspace.</p>
              {version.status === "ready" && <p className="health-detail">{version.value.message}</p>}
            </section>

            <section className="panel">
              <h3>{productCopy.settings.appearance}</h3>
              <label className="setting-row"><span><strong>{productCopy.settings.compactLayout}</strong><small>{productCopy.settings.compactLayoutHelp}</small></span><input type="checkbox" checked={preferences.compactLayout} onChange={(event) => update({ ...preferences, compactLayout: event.target.checked })} /></label>
              <label className="setting-row"><span><strong>{productCopy.settings.reduceMotion}</strong><small>{productCopy.settings.reduceMotionHelp}</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update({ ...preferences, reduceMotion: event.target.checked })} /></label>
            </section>

            <section className="panel" aria-labelledby="settings-about-heading">
              <div className="panel-heading"><div><p className="kicker">About</p><h3 id="settings-about-heading">JL Mixing Studio</h3></div></div>
              <dl className="health-list">
                <div><dt>Studio version</dt><dd>{studioVersion ?? "Checking…"}</dd></div>
                <div><dt>Automation version</dt><dd>{automationVersion}</dd></div>
                <div><dt>Automation API</dt><dd>{version.status === "ready" && version.value.available ? "1.0" : "—"}</dd></div>
              </dl>
            </section>

            <section className="panel">
              <h3>Configuration boundary</h3>
              <p className="health-detail">The workspace path is a machine-local Studio preference. It is not written into shared project metadata and changing it does not move, copy, or migrate projects.</p>
              <p className="health-detail">Workspace validation happens automatically before Studio switches. Individual write operations continue to enforce their own canonical-path, containment, and safe-write rules.</p>
            </section>
          </div>
        </div>
      )}

      {activeTab === "listening" && (
        <div
          id="settings-listening-panel"
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby="settings-listening-tab"
        >
          <ListeningSettingsPanel />
        </div>
      )}
    </section>
  );
}
