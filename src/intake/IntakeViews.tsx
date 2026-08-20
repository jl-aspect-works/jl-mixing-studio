import { useState } from "react";
import type { ClientSummary, IntakeReport, ProjectSummary } from "../types";
import type { IntakeReportState } from "../AppShellViews";
import { ActionIcon } from "../components/ActionIcon";
import { ProjectNavigationBar } from "../project/ProjectNavigationBar";
import type { ProjectShellView } from "../project/ProjectView";
import { openProjectFile, projectFilePaths } from "../project/files/projectFileService";
import { ClientFilesBrowser, type ClientFilesSelection, type IntakeValidationFile } from "./ClientFilesBrowser";
import { ManagedFileOperationDialog, type ManagedFileOperationMode } from "./ManagedFileOperationDialog";
import { sourceRelativePathFromOriginalDelivery } from "./managedClientFilesService";
import "./ClientFilesLayout.css";

export function IntakeReportContent({ report, compact = false }: { report: IntakeReport; compact?: boolean }) {
  const findingGroups = [["Critical errors", report.criticalErrors], ["Duplicate filenames", report.duplicateFilenames], ["Project-format mismatches", report.formatMismatches], ["Unsupported or non-audio files", report.unsupportedFiles], ["Skipped or unavailable checks", report.unavailableChecks]] as const;
  return <><section className="detail-summary intake-summary" aria-label="Intake summary"><article><span>Files</span><strong>{report.filesDiscovered}</strong></article><article><span>Blocking errors</span><strong>{report.blockingErrors}</strong></article><article><span>Warnings</span><strong>{report.warnings}</strong></article></section><p className="intake-format">Expected format: {report.expectedSampleRate / 1000} kHz / {report.expectedBitDepth}-bit · Enhanced inspection {report.enhancedInspectionAvailable ? "available" : "unavailable"}</p>{!compact && <><div className="intake-findings">{findingGroups.map(([label, findings]) => <section key={label} className="panel"><h3>{label}</h3>{findings.length > 0 ? <ul>{findings.map((finding) => <li key={finding}>{finding}</li>)}</ul> : <p>None.</p>}</section>)}</div><section className="panel intake-inventory" aria-labelledby="intake-inventory-heading"><div className="panel-heading"><div><p className="kicker">Source inventory</p><h2 id="intake-inventory-heading">{report.inventory.length} inspected {report.inventory.length === 1 ? "file" : "files"}</h2></div></div><div className="table-scroll"><table><thead><tr><th scope="col">File</th><th scope="col">Size</th><th scope="col">Technical details</th></tr></thead><tbody>{report.inventory.map((item) => <tr key={item.file}><td><code>{item.file}</code></td><td>{item.sizeBytes.toLocaleString()} bytes</td><td>{item.technicalDetails}</td></tr>)}{report.inventory.length === 0 && <tr><td colSpan={3}>No files discovered.</td></tr>}</tbody></table></div></section><section className="panel intake-recommendations"><p className="kicker">Preparation recommendations</p><ul>{report.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></section><p className="intake-source">Source: <code>{report.source}</code></p></>}</>;
}

function ValidationSummary({ report, files }: { report: IntakeReport; files: IntakeValidationFile[] }) {
  const structured = files.length > 0;
  const valid = files.filter((file) => file.status === "valid").length;
  const attention = files.filter((file) => file.status === "blocked" || file.status === "needs_attention").length;
  const duplicateFiles = files.filter((file) => (file.findings ?? []).some((finding) => finding.code === "EXACT_DUPLICATE")).length;
  const status = report.blockingErrors > 0 ? "Blocking findings" : report.warnings > 0 ? "Needs attention" : "Healthy";
  const articleStyle = { minHeight: 0, padding: "0 11px", border: 0, borderRadius: 0, background: "transparent", boxShadow: "none", display: "flex", alignItems: "baseline", gap: "5px" } as const;
  const strongStyle = { margin: 0, fontSize: ".92rem", lineHeight: 1, color: "#27354d" } as const;
  const labelStyle = { fontSize: ".68rem", fontWeight: 700, color: "#748096", whiteSpace: "nowrap" } as const;
  return <section className="client-files-summary" aria-label="Original Delivery file stats" style={{ display: "flex", alignItems: "center", gap: 0, margin: 0, padding: 0, border: 0, flexWrap: "nowrap" }}>
    <article style={{ ...articleStyle, paddingLeft: 0 }}><strong style={strongStyle}>{report.filesDiscovered}</strong><span style={labelStyle}>Files</span></article>
    {structured ? <>
      <article style={articleStyle}><strong style={strongStyle}>{valid}</strong><span style={labelStyle}>Valid</span></article>
      <article style={articleStyle}><strong style={strongStyle}>{attention}</strong><span style={labelStyle}>Needs attention</span></article>
      <article style={articleStyle}><strong style={strongStyle}>{duplicateFiles}</strong><span style={labelStyle}>Duplicates</span></article>
    </> : <>
      <article style={articleStyle}><strong style={strongStyle}>{status}</strong><span style={labelStyle}>Status</span></article>
      <article style={articleStyle}><strong style={strongStyle}>{report.blockingErrors}</strong><span style={labelStyle}>Blocking</span></article>
      <article style={articleStyle}><strong style={strongStyle}>{report.warnings}</strong><span style={labelStyle}>Warnings</span></article>
    </>}
  </section>;
}

export function IntakeView({ client, project, reportState, actionError, validationAvailable, validationHelp, loading, onRecheck, onRefresh, onSelectView }: { client: ClientSummary; project: ProjectSummary; reportState: IntakeReportState; actionError: string | null; validationAvailable: boolean; validationHelp: string; loading: boolean; onProjects: () => void; onOverview: () => void; onRecheck: () => void; onRefresh: () => void; onSelectView: (view: ProjectShellView) => void; }) {
  const [folderActionError, setFolderActionError] = useState<string | null>(null);
  const [managedMode, setManagedMode] = useState<ManagedFileOperationMode | null>(null);
  const [selectedFile, setSelectedFile] = useState<ClientFilesSelection | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [browserVersion, setBrowserVersion] = useState(0);
  const result = reportState.status === "ready" ? reportState.value : null;
  const report = result?.ok ? result.report : null;
  const validationFiles = result && "files" in result && Array.isArray(result.files) ? result.files as IntakeValidationFile[] : [];

  const openOriginalDeliveryFolder = async () => {
    setFolderActionError(null);
    try {
      await openProjectFile({ clientId: client.clientId, projectId: project.projectId, relativePath: projectFilePaths.originalDelivery });
    } catch (error) {
      setFolderActionError(error instanceof Error && error.message ? error.message : "Original Delivery could not be opened.");
    }
  };

  const managedCompleted = () => {
    setBrowserVersion((value) => value + 1);
    setSelectedFile(null);
    setSelectedPaths([]);
    onRefresh();
    if (validationAvailable) onRecheck();
  };

  const resetRelativePaths = selectedPaths.map(sourceRelativePathFromOriginalDelivery);

  return <>
    <ProjectNavigationBar active="intake" onSelect={onSelectView} />
    {actionError && <div className="notice error" role="alert">{actionError}</div>}
    {folderActionError && <div className="notice error" role="alert">{folderActionError}</div>}
    {reportState.status === "error" && <section className="notice error" role="alert"><strong>Validation details unavailable</strong><span>{reportState.message}</span></section>}
    {result && !result.ok && <section className="notice error" role="alert"><strong>Validation details unavailable</strong><span>{result.message}</span></section>}

    <div className="client-files-summary-row">
      <section className="panel client-files-original-delivery" aria-labelledby="original-delivery-heading">
        <div className="client-files-original-delivery-main">
          <div className="client-files-original-delivery-copy">
            <div className="client-files-original-delivery-title client-files-original-delivery-actions">
              <div className="client-files-original-delivery-label"><h2 id="original-delivery-heading">Original Delivery</h2><span className="client-files-read-only">Read only</span></div>
              <button type="button" onClick={() => setManagedMode("import")}><ActionIcon name="add" />Import Client Files…</button>
            </div>
            <p>The client’s supplied source material is preserved here unchanged. Managed Import is the controlled way to add or replace client-delivered files.</p>
          </div>
          {report && <ValidationSummary report={report} files={validationFiles} />}
        </div>
        {report ? <p className="intake-format client-files-format">Expected format: {report.expectedSampleRate / 1000} kHz / {report.expectedBitDepth}-bit · Enhanced inspection {report.enhancedInspectionAvailable ? "available" : "unavailable"}</p> : reportState.status === "loading" ? <div className="client-files-loading-inline" role="status" aria-label="Loading validation details"><span className="client-files-spinner" aria-hidden="true" /></div> : <section className="notice client-files-soft-notice"><strong>Validation details are not available yet.</strong><span>The supplied files remain available below. Recheck when Automation validation is available.</span></section>}
      </section>

      <section className="panel client-files-quick-actions" aria-labelledby="client-files-actions-heading">
        <h2 id="client-files-actions-heading">Quick Actions</h2>
        <div className="action-stack">
          <button type="button" className="secondary" onClick={onRecheck} disabled={!validationAvailable || loading}><ActionIcon name="refresh" />{loading ? "Rechecking…" : "Recheck"}</button>
          <button type="button" onClick={() => onSelectView("audioPrep")}>Go to Audio Prep</button>
          <button type="button" className="secondary" onClick={() => void openOriginalDeliveryFolder()}><ActionIcon name="folder" />Open Original Delivery Folder</button>
        </div>
        {!validationAvailable && <p className="action-help">{validationHelp}</p>}
      </section>
    </div>

    <section className="panel client-files-browser-panel" aria-label="Original Delivery file browser">
      {selectedPaths.length > 0 && <div className="client-files-selection-actions" role="status"><span><strong>{selectedPaths.length} {selectedPaths.length === 1 ? "file" : "files"} selected</strong><small>Select Client Files to restore their Original Delivery versions into Audio Prep.</small></span><button type="button" onClick={() => setManagedMode("audioPrepReset")}><ActionIcon name="copy" />Copy to Audio Prep…</button></div>}
      <ClientFilesBrowser
        key={browserVersion}
        clientId={client.clientId}
        projectId={project.projectId}
        validationFiles={validationFiles}
        selectedPath={selectedFile?.entry.relativePath ?? null}
        onSelectionChange={setSelectedFile}
        selectedPaths={selectedPaths}
        onSelectedPathsChange={setSelectedPaths}
      />
    </section>

    {report && <details className="panel intake-report-details"><summary>View intake report details</summary><IntakeReportContent report={report} /></details>}

    {managedMode && <ManagedFileOperationDialog
      clientId={client.clientId}
      projectId={project.projectId}
      mode={managedMode}
      relativePaths={managedMode === "audioPrepReset" ? resetRelativePaths : []}
      onClose={() => setManagedMode(null)}
      onCompleted={managedCompleted}
    />}
  </>;
}
