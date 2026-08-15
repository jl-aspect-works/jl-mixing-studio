import { useRef, useState, type ReactNode } from "react";
import "./MarkdownEditor.css";

interface MarkdownEditorProps {
  value: string;
  ariaLabel: string;
  disabled?: boolean;
  minRows?: number;
  onChange: (value: string) => void;
}

type InlinePart = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(<u>[^<]+<\/u>|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("<u>")) parts.push({ text: token.slice(3, -4), underline: true });
    else if (token.startsWith("**")) parts.push({ text: token.slice(2, -2), bold: true });
    else parts.push({ text: token.slice(1, -1), italic: true });
    last = index + token.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInline(text).map((part, index) => {
    let content: ReactNode = part.text;
    if (part.bold) content = <strong>{content}</strong>;
    if (part.italic) content = <em>{content}</em>;
    if (part.underline) content = <u>{content}</u>;
    return <span key={`${index}-${part.text}`}>{content}</span>;
  })}</>;
}

function MarkdownPreview({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let unorderedList: string[] = [];
  let orderedList: string[] = [];

  const flushLists = () => {
    if (unorderedList.length) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{unorderedList.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}</ul>);
      unorderedList = [];
    }
    if (orderedList.length) {
      blocks.push(<ol key={`ol-${blocks.length}`}>{orderedList.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}</ol>);
      orderedList = [];
    }
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (orderedList.length) flushLists();
      unorderedList.push(bullet[1]);
      return;
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (unorderedList.length) flushLists();
      orderedList.push(numbered[1]);
      return;
    }
    flushLists();
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
  flushLists();
  return <div className="markdown-preview">{blocks.length ? blocks : <p className="markdown-preview-empty">Nothing to preview.</p>}</div>;
}

export function MarkdownEditor({ value, ariaLabel, disabled = false, minRows = 8, onChange }: MarkdownEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const restoreSelection = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const element = textarea.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(start, end);
    });
  };

  const wrapSelection = (open: string, close = open, placeholder = "text") => {
    const element = textarea.current;
    if (!element || disabled) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const replacement = `${open}${selected}${close}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    restoreSelection(start + open.length, start + open.length + selected.length);
  };

  const prefixSelectedLines = (prefixForIndex: (index: number) => string, placeholder = "item") => {
    const element = textarea.current;
    if (!element || disabled) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const original = value.slice(lineStart, lineEnd) || placeholder;
    const lines = original.split("\n");
    const replacement = lines.map((line, index) => `${prefixForIndex(index)}${line || placeholder}`).join("\n");
    onChange(`${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`);
    restoreSelection(lineStart, lineStart + replacement.length);
  };

  const heading = (level: 1 | 2) => {
    const prefix = level === 1 ? "# " : "## ";
    const element = textarea.current;
    if (!element || disabled) return;
    const start = element.selectionStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndCandidate = value.indexOf("\n", start);
    const lineEnd = lineEndCandidate === -1 ? value.length : lineEndCandidate;
    const line = value.slice(lineStart, lineEnd).replace(/^#{1,6}\s+/, "") || "Heading";
    const replacement = `${prefix}${line}`;
    onChange(`${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`);
    restoreSelection(lineStart + prefix.length, lineStart + replacement.length);
  };

  return <div className="markdown-editor">
    <div className="markdown-editor-toolbar" role="toolbar" aria-label={`${ariaLabel} formatting`}>
      <div className="markdown-format-actions">
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => wrapSelection("**")} aria-label="Bold" title="Bold"><strong>B</strong></button>
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => wrapSelection("*")} aria-label="Italic" title="Italic"><em>I</em></button>
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => wrapSelection("<u>", "</u>")} aria-label="Underline" title="Underline"><u>U</u></button>
        <span className="markdown-toolbar-divider" aria-hidden="true" />
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => heading(1)} aria-label="Heading 1" title="Heading 1">H1</button>
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => heading(2)} aria-label="Heading 2" title="Heading 2">H2</button>
        <span className="markdown-toolbar-divider" aria-hidden="true" />
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => prefixSelectedLines(() => "- ")} aria-label="Bulleted list" title="Bulleted list">• List</button>
        <button type="button" className="secondary" disabled={disabled || mode === "preview"} onClick={() => prefixSelectedLines((index) => `${index + 1}. `)} aria-label="Numbered list" title="Numbered list">1. List</button>
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
