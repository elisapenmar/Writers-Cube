"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

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
  const can = (fn: "undo" | "redo") => {
    try {
      return editor.can()[fn]();
    } catch {
      return false;
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-0.5 ${className}`}
    >
      <Btn label="↶" title="Undo (⌘Z)" active={false} disabled={!can("undo")} onClick={() => chain().undo().run()} />
      <Btn label="↷" title="Redo (⌘⇧Z)" active={false} disabled={!can("redo")} onClick={() => chain().redo().run()} />
      <Divider />
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
    </div>
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
  label: string;
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
      className={`min-w-7 h-7 px-1.5 rounded text-sm grid place-items-center disabled:opacity-45 ${
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
  return <span className="w-px h-5 bg-[var(--wc-stone)] mx-1" />;
}
