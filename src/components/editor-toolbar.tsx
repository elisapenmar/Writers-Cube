"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { RTE_FONTS } from "@/lib/rte-fonts";
import { uploadRteImage } from "@/server/uploads";

const COLOR_SWATCHES = ["#111111", "#b91c1c", "#1d4ed8", "#15803d", "#b45309", "#7c3aed"];

/**
 * Formatting toolbar bound to a TipTap editor. Re-renders on every editor
 * transaction so the active-state highlights stay in sync.
 */
export function EditorToolbar({
  editor,
  className = "",
}: {
  editor: Editor | null;
  className?: string;
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
  // not be touched, editor.can()/isActive() throw on a torn-down view.
  if (!editor || editor.isDestroyed) return null;
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
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string) || "";
  const currentColor = (editor.getAttributes("textStyle").color as string) || "#111111";
  const inTable = editor.isActive("table");

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
      className={`flex flex-nowrap items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <Btn label={<UndoIcon />} title="Undo (⌘Z)" active={false} disabled={!can("undo")} onClick={() => chain().undo().run()} />
      <Btn label={<RedoIcon />} title="Redo (⌘⇧Z)" active={false} disabled={!can("redo")} onClick={() => chain().redo().run()} />
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
      <Btn label="B" title="Bold (⌘B)" active={editor.isActive("bold")} bold onClick={() => chain().toggleBold().run()} />
      <Btn label="I" title="Italic (⌘I)" active={editor.isActive("italic")} italic onClick={() => chain().toggleItalic().run()} />
      <Btn label="U" title="Underline (⌘U)" active={editor.isActive("underline")} underline onClick={() => chain().toggleUnderline().run()} />
      <Btn label="S" title="Strikethrough" active={editor.isActive("strike")} strike onClick={() => chain().toggleStrike().run()} />
      <Divider />
      <Btn label="H1" title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()} />
      <Btn label="H2" title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <Btn label="H3" title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <Divider />
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
