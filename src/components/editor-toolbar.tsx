"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { RTE_FONTS } from "@/lib/rte-fonts";

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
  // not be touched — editor.can()/isActive() throw on a torn-down view.
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
  const hasIndent = typeof (editor.commands as Record<string, unknown>).indent === "function";
  const hasFont = typeof (editor.commands as Record<string, unknown>).setFontFamily === "function";
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string) || "";

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
    </div>
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
