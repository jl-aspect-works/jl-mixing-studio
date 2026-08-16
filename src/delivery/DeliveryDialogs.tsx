import type { DeliveryWorkflowState } from "./models";
import "./DeliveryDialogs.css";

export function DeliveryOptionsDialog({
  approvedRevision,
  showCleanOption,
  cleanFirst,
  onCleanFirstChange,
  onBuild,
  onClose,
}: {
  approvedRevision: number;
  showCleanOption: boolean;
  cleanFirst: boolean;
  onCleanFirstChange: (cleanFirst: boolean) => void;
  onBuild: () => void;
  onClose: () => void;
}) {
  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-options-title">
      <p className="kicker">Delivery package</p>
      <h2 id="delivery-options-title">Build Package</h2>
      <p className="dialog-intro">Create a delivery package from <strong>Approved Revision {String(approvedRevision).padStart(2, "0")}</strong>.</p>
      <p className="dialog-intro">Delivery Notes are included automatically.</p>
      {showCleanOption && <label className="setting-row delivery-clean-option">
        <span>
          <strong>Clean delivery first</strong>
          <small>Remove existing generated ZIPs before creating the new package.</small>
        </span>
        <input
          type="checkbox"
          checked={cleanFirst}
          onChange={(event) => onCleanFirstChange(event.target.checked)}
        />
      </label>}
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        <button type="button" onClick={onBuild}>Build Package</button>
      </div>
    </section>
  </div>;
}

export function DeliveryDialog({
  state,
  approvedRevision,
  onClose,
}: {
  state: Exclude<DeliveryWorkflowState, { status: "closed" } | { status: "options" }>;
  approvedRevision: number;
  onClose: () => void;
}) {
  const pending = state.status === "preflighting" || state.status === "creating";
  const revision = state.status === "creating" ? state.preview.approvedRevision : approvedRevision;
  const progressText = state.status === "preflighting"
    ? "Preparing and validating the approved revision…"
    : state.status === "creating" && state.cleanFirst
      ? "Cleaning generated ZIPs, then creating and verifying the new package…"
      : "Creating and verifying the new package…";

  return <div className="dialog-backdrop">
    <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-dialog-title">
      <p className="kicker">Delivery package</p>
      {state.status === "uncertain" ? <>
        <h2 id="delivery-dialog-title">Package Needs Verification</h2>
        <div className="form-error" role="alert">{state.message}</div>
        <p className="dialog-intro">Refresh Delivery and verify the package state before trying again.</p>
        <div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div>
      </> : <>
        <h2 id="delivery-dialog-title">Building Package…</h2>
        <p className="dialog-intro">Building package from <strong>Approved Revision {String(revision).padStart(2, "0")}</strong>…</p>
        <div className="delivery-build-progress" role="status" aria-live="polite">
          <div className="delivery-build-progress-track" aria-hidden="true"><span /></div>
          <span className="delivery-build-progress-text">{progressText}</span>
        </div>
        <p className="dialog-intro">Delivery Notes are included automatically.</p>
        {pending && <div className="dialog-actions"><button type="button" className="secondary" disabled>Building…</button></div>}
      </>}
    </section>
  </div>;
}
