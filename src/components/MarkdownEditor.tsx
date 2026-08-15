import { useRef, useState } from "react";
import "./MarkdownEditor.css";

interface MarkdownEditorProps {
  value: string;
  ariaLabel: string;
  disabled?: boolean;
  minRows?: number;
  onChange: (value: string) => void;
}

type InlinePart = { text: string; bold?: boolean; italic?: boolean };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("**")) parts.push({ text: token.slice(2, -2), bold: true });
    else parts.push({ text: token.slice(1, -1), italic: true });
    last = index + token.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInline(text).map((part, index) => {
    let content: React.ReactNode = part.text;
    if (part.bold) content = <strong>{content}</strong>;
    if (part.italic) content = <em>{content}</em>;
    return <span key={`${index}-${part.text}`}>{content}</span>;
  })}</>;
}

function MarkdownPreview({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{list.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}</ul>);
    list = [];
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    if (!line.trim()) {
      blocks.push(<div className="markdown-preview-spacer" key={`space-${index}`} />);
    } else if (line.startsWith("### ")) {
      blocks.push(<h4 key={index}><InlineMarkdown text={line.slice(4)} /></h4>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h3 key={index}><InlineMarkdown text={line.slice(3)} /></h3>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h2 key={index}><InlineMarkdown text={line.slice(2)} /></h2>);
    } else {
      blocks.push(<p key={index}><InlineMarkdown text={line} /></p>);
    }
  });
  flushList();
  return <div className="markdown-preview">{blocks.length ? blocks : <p className="markdown-preview-empty">Nothing to preview.</p>}</div>;
}

export function MarkdownEditor({ value, ariaLabel, disabled = false, minRows = 8, onChange }: MarkdownEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const wrapSelection = (marker: "**" | "*") => {
    const element = textarea.current;
    if (!element || disabled) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = `${marker}${selected || "text"}${marker}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      const innerStart = start + marker.length;
      element.setSelectionRange(innerStart, innerStart + (selected || "text").length);
    });
  };

  return <div className="markdown-editor">
    <div className="markdown-editor-toolbar" role="toolbar" aria-label={`${ariaLabel} formatting`}>
      <div className="markdown-format-actions">
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => wrapSelection("**")} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => wrapSelection("*")} aria-label="Italic"><em>I</em></button>
      </div>
      <div className="markdown-mode-actions" aria-label="Editor mode">
        <button type="button" className={mode === "edit" ? "active" : "secondary"} onClick={() => setMode("edit")} aria-pressed={mode === "edit"}>Edit</button>
        <button type="button" className={mode === "preview" ? "active" : "secondary"} onClick={() => setMode("preview")} aria-pressed={mode === "preview"}>Preview</button>
      </div>
    </div>
    {mode === "edit" ? <textarea
      ref={textarea}
      aria-label={ariaLabel}
      rows={minRows}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    /> : <MarkdownPreview value={value} />}
  </div>;
}
