import { MarkdownEditor } from "./MarkdownEditor";
import "./MarkdownDocumentEditor.css";

interface MarkdownDocumentEditorProps {
  headingId: string;
  title: string;
  kicker?: string;
  value: string;
  savedValue: string;
  maxBytes: number;
  ariaLabel: string;
  loading?: boolean;
  saving?: boolean;
  disabled?: boolean;
  error?: string | null;
  loadingLabel?: string;
  saveLabel?: string;
  minRows?: number;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function MarkdownDocumentEditor({
  headingId,
  title,
  kicker,
  value,
  savedValue,
  maxBytes,
  ariaLabel,
  loading = false,
  saving = false,
  disabled = false,
  error = null,
  loadingLabel = "Loading…",
  saveLabel = "Save Notes",
  minRows,
  onChange,
  onSave,
}: MarkdownDocumentEditorProps) {
  const byteCount = new TextEncoder().encode(value).length;
  const saveDisabled = loading || saving || disabled || value === savedValue || byteCount > maxBytes;

  return <>
    <div className="markdown-document-heading">
      <div>
        {kicker && <p className="kicker">{kicker}</p>}
        <h2 id={headingId}>{title}</h2>
      </div>
      <div className="markdown-document-heading-actions">
        <span>{loading ? loadingLabel : `${byteCount.toLocaleString()} / ${maxBytes.toLocaleString()} bytes`}</span>
        <button
          type="button"
          disabled={saveDisabled}
          aria-busy={saving}
          onClick={onSave}
        >{saving ? "Saving…" : saveLabel}</button>
      </div>
    </div>
    {error && <div className="inline-notice error" role="alert">{error}</div>}
    {loading ? <p className="markdown-document-loading">{loadingLabel}</p> : <MarkdownEditor
      ariaLabel={ariaLabel}
      minRows={minRows}
      disabled={disabled || saving}
      value={value}
      onChange={onChange}
    />}
  </>;
}
