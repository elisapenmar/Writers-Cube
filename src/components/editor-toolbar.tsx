"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { RTE_FONTS } from "@/lib/rte-fonts";
import { uploadRteImage } from "@/server/uploads";
import type { EditorView } from "@/store/editor-view-store";

const COLOR_SWATCHES = ["#111111", "#b91c1c", "#1d4ed8", "#15803d", "#b45309", "#7c3aed"];
const LINE_SPACINGS: { label: string; value: number }[] = [
  { label: "Single", value: 1 },
  { label: "1.15", value: 1.15 },
  { label: "1.5", value: 1.5 },
  { label: "2", value: 2 },
];

/**
 * Formatting toolbar bound to a TipTap editor. Re-renders on every editor
 * transaction so the active-state highlights stay in sync.
 */
export function EditorToolbar({
  editor,
  className = "",
  leadingBefore,
  leading,
  trailing,
  view,
}: {
  editor: Editor | null;
  className?: string;
  /** Actions placed before the undo/redo buttons (e.g. Page setup, Find). */
  leadingBefore?: React.ReactNode;
  /** Actions placed right after undo/redo (e.g. History, Focus). */
  leading?: React.ReactNode;
  /** Right-aligned trailing slot (e.g. the save indicator), folded into the same
   *  flex-wrap so the whole bar wraps as one set on narrow widths. */
  trailing?: React.ReactNode;
  /** Document view settings; when present, a line-spacing dropdown is shown. */
  view?: EditorView;
}) {
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const update = () => force((n) => n + 1);
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  // A destroyed editor (e.g. a block that just remounted after a split) must
  // not be touched, editor.can()/isActive() throw on a torn-down view. Still
  // render the trailing actions so they don't vanish before a block is focused.
  if (!editor || editor.isDestroyed) {
    return leadingBefore || leading || trailing ? (
      <div className={`flex flex-wrap items-center gap-0.5 ${className}`}>
        {leadingBefore && <div className="flex items-center gap-2 shrink-0">{leadingBefore}</div>}
        {leading && <div className="flex items-center gap-2 shrink-0">{leading}</div>}
        {trailing && <div className="ml-auto flex items-center gap-2 shrink-0">{trailing}</div>}
      </div>
    ) : null;
  }
  const chain = () => editor.chain().focus();
  const can = (fn: "undo" | "redo" | "indent" | "outdent") => {
    try {
      const c = editor.can() as unknown as Record<string, (() => boolean) | undefined>;
      return typeof c[fn] === "function" ? (c[fn] as () => boolean)() : false;
    } catch {
      return false;
    }
  };
  const cmds = editor.commands as Record<string, unknown>;
  const hasIndent = typeof cmds.indent === "function";
  const hasFont = typeof cmds.setFontFamily === "function";
  const hasColor = typeof cmds.setColor === "function";
  const hasTable = typeof cmds.insertTable === "function";
  const hasImage = typeof cmds.setImage === "function";
  const hasFootnote = typeof cmds.addFootnote === "function";
  const hasFontSize = typeof cmds.setFontSize === "function";
  const hasAlign = typeof cmds.setTextAlign === "function";
  const hasHighlight = typeof cmds.toggleHighlight === "function";
  const hasLink = typeof cmds.setLink === "function";
  const hasColumns = typeof cmds.setColumns === "function";
  const colCount = editor.isActive("columns")
    ? Number(editor.getAttributes("columns").count) || 2
    : 1;
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string) || "";
  const currentColor = (editor.getAttributes("textStyle").color as string) || "#111111";
  const currentSize = parseInt(
    (editor.getAttributes("textStyle").fontSize as string) || "",
    10,
  );
  const sizePx = Number.isFinite(currentSize) ? currentSize : 18;
  const inTable = editor.isActive("table");
  const hasHeading = typeof cmds.toggleHeading === "function";
  const headingLevel = editor.isActive("heading", { level: 1 })
    ? 1
    : editor.isActive("heading", { level: 2 })
      ? 2
      : editor.isActive("heading", { level: 3 })
        ? 3
        : 0;
  const align: "left" | "center" | "right" | "justify" = editor.isActive({ textAlign: "center" })
    ? "center"
    : editor.isActive({ textAlign: "right" })
      ? "right"
      : editor.isActive({ textAlign: "justify" })
        ? "justify"
        : "left";

  function stepFontSize(delta: number) {
    const next = Math.min(96, Math.max(8, sizePx + delta));
    chain().setFontSize(`${next}px`).run();
  }
  function editLink() {
    const prev = (editor!.getAttributes("link").href as string) || "";
    const url = window.prompt("Link URL (leave blank to remove):", prev);
    if (url === null) return;
    if (url.trim() === "") {
      chain().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    chain().extendMarkRange("link").setLink({ href }).run();
  }

  async function pickImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await uploadRteImage(fd);
      editor!.chain().focus().setImage({ src: url }).run();
    } catch {
      /* surfaced via a disabled state; keep it quiet */
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-0.5 ${className}`}
    >
      {leadingBefore && (
        <>
          <div className="flex items-center gap-2 shrink-0">{leadingBefore}</div>
          <Divider />
        </>
      )}
      <Btn label={<UndoIcon />} title="Undo (⌘Z)" active={false} disabled={!can("undo")} onClick={() => chain().undo().run()} />
      <Btn label={<RedoIcon />} title="Redo (⌘⇧Z)" active={false} disabled={!can("redo")} onClick={() => chain().redo().run()} />
      {leading && (
        <>
          <Divider />
          <div className="flex items-center gap-2 shrink-0">{leading}</div>
        </>
      )}
      <Divider />
      {hasFont && (
        <>
          <select
            value={currentFont}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const css = e.target.value;
              if (css) chain().setFontFamily(css).run();
              else chain().unsetFontFamily().run();
            }}
            title="Font"
            className="h-7 shrink-0 rounded border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 text-xs text-[var(--wc-ink)] focus:outline-none"
          >
            {RTE_FONTS.map((f) => (
              <option key={f.label} value={f.css}>
                {f.label}
              </option>
            ))}
          </select>
          <Divider />
        </>
      )}
      {hasFontSize && (
        <>
          <div className="flex shrink-0 items-center rounded border border-[var(--wc-border-strong)]">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => stepFontSize(-1)}
              title="Decrease font size"
              className="h-7 w-6 grid place-items-center text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
            >
              −
            </button>
            <span className="w-7 text-center text-xs tabular-nums text-[var(--wc-ink)]">{sizePx}</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => stepFontSize(1)}
              title="Increase font size"
              className="h-7 w-6 grid place-items-center text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
            >
              +
            </button>
          </div>
          <Divider />
        </>
      )}
      <Btn label="B" title="Bold (⌘B)" active={editor.isActive("bold")} bold onClick={() => chain().toggleBold().run()} />
      <Btn label="I" title="Italic (⌘I)" active={editor.isActive("italic")} italic onClick={() => chain().toggleItalic().run()} />
      <Btn label="U" title="Underline (⌘U)" active={editor.isActive("underline")} underline onClick={() => chain().toggleUnderline().run()} />
      <Btn label="S" title="Strikethrough" active={editor.isActive("strike")} strike onClick={() => chain().toggleStrike().run()} />
      <Divider />
      {hasHeading && (
        <>
          <select
            value={headingLevel}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const lvl = Number(e.target.value);
              if (lvl === 0) chain().setParagraph().run();
              else chain().toggleHeading({ level: lvl as 1 | 2 | 3 }).run();
            }}
            title="Paragraph style"
            className="h-7 shrink-0 rounded border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 text-xs text-[var(--wc-ink)] focus:outline-none"
          >
            <option value={0}>Paragraph</option>
            <option value={1}>Heading 1</option>
            <option value={2}>Heading 2</option>
            <option value={3}>Heading 3</option>
          </select>
          <Divider />
        </>
      )}
      <Btn label="•" title="Bullet list" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
      <Btn label="1." title="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
      <Btn label="❝" title="Blockquote" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
      {hasIndent && (
        <>
          <Divider />
          <Btn label={<OutdentIcon />} title="Decrease indent (⇧Tab)" active={false} disabled={!can("outdent")} onClick={() => chain().outdent().run()} />
          <Btn label={<IndentIcon />} title="Increase indent (Tab)" active={false} onClick={() => chain().indent().run()} />
        </>
      )}

      {hasAlign && (
        <>
          <Divider />
          <div className="relative group/align shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              title="Text alignment"
              className="h-7 px-1.5 rounded inline-flex items-center gap-0.5 text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
            >
              <AlignIcon kind={align} />
              <Caret />
            </button>
            <div className="absolute left-0 top-full z-50 hidden group-hover/align:flex gap-0.5 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-0.5 shadow-lg">
              {(["left", "center", "right", "justify"] as const).map((kind) => (
                <Btn
                  key={kind}
                  label={<AlignIcon kind={kind} />}
                  title={kind === "justify" ? "Justify" : `Align ${kind}`}
                  active={align === kind}
                  onClick={() => chain().setTextAlign(kind).run()}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {view && (
        <>
          <Divider />
          <LineSpacingMenu view={view} />
        </>
      )}

      {view?.pageFormat === "paged" && (
        <>
          <Divider />
          <select
            value={view.pageZoom}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => view.setPageZoom(Number(e.target.value))}
            title="Page zoom"
            className="h-7 shrink-0 rounded border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 text-xs text-[var(--wc-ink)] focus:outline-none"
          >
            {[0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
        </>
      )}

      {hasColumns && (
        <div className="relative group/cols shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            title="Columns (applied to the selected text)"
            className={`h-7 px-1.5 rounded inline-flex items-center gap-0.5 ${
              colCount > 1
                ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
                : "text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
            }`}
          >
            <ColumnsIcon />
            <Caret />
          </button>
          <div className="absolute left-0 top-full z-50 hidden group-hover/cols:flex gap-0.5 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-0.5 shadow-lg">
            {[1, 2, 3].map((n) => (
              <Btn
                key={n}
                label={`${n}`}
                title={n === 1 ? "No columns" : `${n} columns`}
                active={colCount === n}
                onClick={() => chain().setColumns(n).run()}
              />
            ))}
          </div>
        </div>
      )}

      {hasColor && (
        <>
          <Divider />
          <div className="relative group/color shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              title="Text color"
              className="min-w-7 h-7 px-1.5 rounded grid place-items-center text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
            >
              <span className="font-semibold leading-none" style={{ color: currentColor }}>A</span>
            </button>
            <div className="absolute left-0 top-full z-50 hidden group-hover/color:flex flex-col gap-1 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1.5 shadow-lg">
              <div className="flex gap-1">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chain().setColor(c).run()}
                    title={c}
                    className="h-5 w-5 rounded-full border border-[var(--wc-border)]"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => chain().setColor(e.target.value).run()}
                  className="h-6 w-8 cursor-pointer rounded border border-[var(--wc-border)] bg-transparent"
                  title="Custom color"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chain().unsetColor().run()}
                  className="rounded px-1.5 text-[11px] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {hasHighlight && (
        <Btn
          label={<span className="rounded-sm bg-[#fde68a] px-0.5 text-[var(--wc-ink)]">H</span>}
          title="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => chain().toggleHighlight().run()}
        />
      )}
      {hasLink && (
        <Btn
          label={<LinkIcon />}
          title="Insert / edit link"
          active={editor.isActive("link")}
          onClick={editLink}
        />
      )}
      {(hasHighlight || hasLink) && <Divider />}

      {hasImage && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickImage(f);
              e.target.value = "";
            }}
          />
          <Btn
            label="🖼"
            title="Insert image"
            active={false}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          />
        </>
      )}

      {hasFootnote && (
        <Btn
          label={<sup className="text-[10px]">fn</sup>}
          title="Insert footnote"
          active={false}
          onClick={() => chain().addFootnote().run()}
        />
      )}

      {hasTable && (
        <div className="relative group/table shrink-0">
          <Btn
            label="⊞"
            title="Table"
            active={inTable}
            onClick={() => {
              if (!inTable) chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }}
          />
          {inTable && (
            <div className="absolute left-0 top-full z-50 hidden group-hover/table:flex flex-col rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 text-xs shadow-lg w-40">
              <TMenu onClick={() => chain().addRowAfter().run()}>Add row</TMenu>
              <TMenu onClick={() => chain().addColumnAfter().run()}>Add column</TMenu>
              <TMenu onClick={() => chain().deleteRow().run()}>Delete row</TMenu>
              <TMenu onClick={() => chain().deleteColumn().run()}>Delete column</TMenu>
              <TMenu onClick={() => chain().toggleHeaderRow().run()}>Toggle header row</TMenu>
              <TMenu onClick={() => chain().deleteTable().run()}>Delete table</TMenu>
            </div>
          )}
        </div>
      )}

      {trailing && (
        <div className="ml-auto flex items-center gap-2 shrink-0">{trailing}</div>
      )}
    </div>
  );
}

function TMenu({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded px-2 py-1 text-left text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
    >
      {children}
    </button>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h1" />
    </svg>
  );
}
function AlignIcon({ kind }: { kind: "left" | "center" | "right" | "justify" }) {
  // Second line is shortened/positioned to hint at the alignment.
  const lines: Record<typeof kind, { y: number; x1: number; x2: number }[]> = {
    left: [
      { y: 6, x1: 3, x2: 21 },
      { y: 12, x1: 3, x2: 14 },
      { y: 18, x1: 3, x2: 18 },
    ],
    center: [
      { y: 6, x1: 3, x2: 21 },
      { y: 12, x1: 7, x2: 17 },
      { y: 18, x1: 5, x2: 19 },
    ],
    right: [
      { y: 6, x1: 3, x2: 21 },
      { y: 12, x1: 10, x2: 21 },
      { y: 18, x1: 6, x2: 21 },
    ],
    justify: [
      { y: 6, x1: 3, x2: 21 },
      { y: 12, x1: 3, x2: 21 },
      { y: 18, x1: 3, x2: 21 },
    ],
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {lines[kind].map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} />
      ))}
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function IndentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="21" y1="6" x2="9" y2="6" />
      <line x1="21" y1="12" x2="13" y2="12" />
      <line x1="21" y1="18" x2="9" y2="18" />
      <path d="M3 8l4 4-4 4" />
    </svg>
  );
}
function OutdentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="21" y1="6" x2="9" y2="6" />
      <line x1="21" y1="12" x2="13" y2="12" />
      <line x1="21" y1="18" x2="9" y2="18" />
      <path d="M7 8l-4 4 4 4" />
    </svg>
  );
}

function Btn({
  label,
  title,
  active,
  bold,
  italic,
  underline,
  strike,
  disabled,
  onClick,
}: {
  label: React.ReactNode;
  title: string;
  active: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`min-w-7 h-7 px-1.5 rounded text-sm grid place-items-center shrink-0 disabled:opacity-45 ${
        active ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]" : "text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
      }`}
      style={{
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : undefined,
        textDecoration: underline ? "underline" : strike ? "line-through" : undefined,
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-[var(--wc-stone)] mx-1 shrink-0" />;
}

function Caret() {
  return <span className="text-[8px] leading-none text-[var(--wc-faint)]">▼</span>;
}

function LineSpacingMenu({ view }: { view: EditorView }) {
  return (
    <div className="relative group/ls shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        title="Line spacing"
        className="h-7 px-1.5 rounded inline-flex items-center gap-0.5 text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
      >
        <LineSpacingIcon />
        <Caret />
      </button>
      <div className="absolute left-0 top-full z-50 hidden group-hover/ls:flex flex-col gap-1.5 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1.5 shadow-lg w-44">
        <div className="grid grid-cols-4 gap-1">
          {LINE_SPACINGS.map((sp) => (
            <button
              key={sp.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => view.setLineSpacing(sp.value)}
              className={`rounded px-1 py-1 text-xs ${
                view.lineSpacing === sp.value
                  ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
                  : "text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
              }`}
            >
              {sp.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[var(--wc-muted)]">
          Custom
          <input
            type="number"
            min={1}
            max={4}
            step={0.05}
            value={view.lineSpacing}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) view.setLineSpacing(Math.min(4, Math.max(1, n)));
            }}
            className="w-14 rounded border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 py-0.5 text-xs text-[var(--wc-ink)] focus:outline-none"
          />
          <span className="text-[var(--wc-faint)]">×</span>
        </label>
      </div>
    </div>
  );
}

function ColumnsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" />
    </svg>
  );
}

function LineSpacingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 4v16M4 4 2 6M4 4l2 2M4 20l-2-2M4 20l2-2" />
    </svg>
  );
}
