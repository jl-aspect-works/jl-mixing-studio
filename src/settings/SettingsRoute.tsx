import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";
import { copy as productCopy } from "../resources/copy";
import type { AppPreferences } from "../AppWorkflowModels";
import type { WorkspaceConfiguration } from "./models";

interface SettingsRouteProps {
  preferences: AppPreferences;
  onChange: (value: AppPreferences) => void;
  workspace: ResourceState<WorkspaceSnapshot>;
  workspaceConfiguration: ResourceState<WorkspaceConfiguration>;
  version: ResourceState<VersionCheck>;
  onWorkspaceChanged: (snapshot: WorkspaceSnapshot) => void;
  onRefresh: () => void;
}

type WorkspaceAction = "idle" | "validating" | "saving" | "opening";

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
  onRefresh,
}: SettingsRouteProps) {
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [candidatePath, setCandidatePath] = useState("");
  const [validatedCandidate, setValidatedCandidate] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceAction, setWorkspaceAction] = useState<WorkspaceAction>("idle");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("Not checked yet");

  useEffect(() => {
    if (workspaceConfiguration.status === "ready" && !editingWorkspace) {
      setCandidatePath(workspaceConfiguration.value.workspacePath);
    }
  }, [workspaceConfiguration, editingWorkspace]);

  useEffect(() => {
    if (workspace.status === "ready" || workspace.status === "error") {
      setLastChecked(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }
  }, [workspace]);

  const update = (value: AppPreferences) => {
    localStorage.setItem("jl-mixing-studio.preferences", JSON.stringify(value));
    onChange(value);
  };

  const beginWorkspaceChange = () => {
    setCandidatePath(
      workspaceConfiguration.status === "ready"
        ? workspaceConfiguration.value.workspacePath
        : workspace.status === "ready"
          ? workspace.value.workspacePath
          : "",
    );
    setValidatedCandidate(null);
    setWorkspaceError(null);
    setWorkspaceNotice(null);
    setEditingWorkspace(true);
  };

  const cancelWorkspaceChange = () => {
    setEditingWorkspace(false);
    setValidatedCandidate(null);
    setWorkspaceError(null);
  };

  const validateCandidate = async () => {
    setWorkspaceAction("validating");
    setWorkspaceError(null);
    setWorkspaceNotice(null);
    setValidatedCandidate(null);
    try {
      const candidate = await invoke<WorkspaceSnapshot>("validate_workspace_root", { path: candidatePath });
      setCandidatePath(candidate.workspacePath);
      setValidatedCandidate(candidate);
    } catch (error: unknown) {
      setWorkspaceError(errorMessage(error, "The workspace could not be validated."));
    } finally {
      setWorkspaceAction("idle");
    }
  };

  const useValidatedWorkspace = async () => {
    if (!validatedCandidate) return;
    setWorkspaceAction("saving");
    setWorkspaceError(null);
    try {
      const snapshot = await invoke<WorkspaceSnapshot>("set_workspace_root", {
        path: validatedCandidate.workspacePath,
      });
      onWorkspaceChanged(snapshot);
      setWorkspaceNotice("Workspace changed. Studio will use this path for all project and Automation operations on this computer.");
      setEditingWorkspace(false);
      setValidatedCandidate(null);
    } catch (error: unknown) {
      setWorkspaceError(errorMessage(error, "The workspace configuration could not be saved."));
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

  const currentPath = workspaceConfiguration.status === "ready"
    ? workspaceConfiguration.value.workspacePath
    : workspace.status === "ready"
      ? workspace.value.workspacePath
      : "Unavailable";
  const connected = workspace.status === "ready"
    && workspace.value.status !== "unavailable"
    && workspace.value.status !== "invalid";
  const canOpen = connected && workspaceAction === "idle";

  return (
    <section className="planned-route" aria-labelledby="settings-heading">
      <div className="panel-heading">
        <div>
          <p className="kicker">Settings &gt; Workspace</p>
          <h2 id="settings-heading">Workspace</h2>
          <p className="health-detail">Choose once where JL Mixing projects live on this computer. Local disks, NAS shares, and OS-mounted cloud folders are supported as ordinary filesystem paths.</p>
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
              <button type="button" onClick={beginWorkspaceChange} disabled={workspaceAction !== "idle"}>Change…</button>
              <button type="button" className="secondary" onClick={openWorkspace} disabled={!canOpen} aria-busy={workspaceAction === "opening"}>Open Workspace Folder</button>
              <button type="button" className="secondary" onClick={onRefresh} disabled={workspaceAction !== "idle"}>Refresh Status</button>
            </div>
          </div>

          {editingWorkspace && (
            <div className="planned-message compact">
              <strong>Change workspace</strong>
              <p>Enter or paste the absolute path to an existing JL Mixing workspace. Studio validates the folder before saving it and will not switch away from the current workspace when validation fails.</p>
              <label className="field">
                <span>Workspace path</span>
                <input
                  type="text"
                  value={candidatePath}
                  onChange={(event) => { setCandidatePath(event.target.value); setValidatedCandidate(null); }}
                  placeholder={navigator.platform.toLowerCase().includes("win") ? "D:\\Mixes" : "/Volumes/Studio/Mixes"}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <div className="directory-actions">
                <button type="button" onClick={validateCandidate} disabled={!candidatePath.trim() || workspaceAction !== "idle"} aria-busy={workspaceAction === "validating"}>Validate Workspace</button>
                <button type="button" className="secondary" onClick={cancelWorkspaceChange} disabled={workspaceAction !== "idle"}>Cancel</button>
              </div>
              {validatedCandidate && (
                <div className="folder-control" role="status">
                  <strong>Valid JL Mixing workspace</strong>
                  <code>{validatedCandidate.workspacePath}</code>
                  <small>{validatedCandidate.counts.clients} clients · {validatedCandidate.counts.projects} projects · status {validatedCandidate.status}</small>
                  <div className="directory-actions">
                    <button type="button" onClick={useValidatedWorkspace} disabled={workspaceAction !== "idle"} aria-busy={workspaceAction === "saving"}>Use This Workspace</button>
                  </div>
                </div>
              )}
            </div>
          )}
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

        <section className="panel">
          <h3>Configuration boundary</h3>
          <p className="health-detail">The workspace path is a machine-local Studio preference. It is not written into shared project metadata and changing it does not move, copy, or migrate projects.</p>
          <p className="health-detail">Workspace validation checks JL Mixing structure and metadata discovery. Individual write operations continue to enforce their own canonical-path, containment, and safe-write rules.</p>
        </section>
      </div>
    </section>
  );
}
