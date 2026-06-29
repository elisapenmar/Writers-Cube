"use client";

import { useEffect, useState } from "react";
import { useActiveEditor } from "@/lib/editor-bridge";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

/**
 * Touch-friendly formatting bar for the mobile editor.
 *
 * It drives whatever editor is on screen through the editor bridge (the A∩B
 * contract: an editor variant registers its Tiptap instance). It never touches
 * `editor.tsx` internals; it only calls the same chainable commands the desktop
 * `editor-toolbar` already uses.
 *
 * Keyboard handling: the bar is fixed to the bottom and lifted by the live
 * keyboard inset so it rides just above the on-screen keyboard instead of being
 * hidden under it. Buttons use `onPointerDown` + preventDefault so tapping a
 * format does not blur the editor or collapse the text selection.
 *
 * Scope: only the formatting that makes sense by thumb. Hover-only desktop menus
 * (font family, columns, color picker, tables) are deliberately left to the
 * desktop toolbar; the "more" sheet exposes the next tier without hover.
 */
export function MobileEditorToolbar() {
  const editor = useActiveEditor();
  const inset = useKeyboardInset();
  const [, force] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  // Re-render on every editor transaction so active-state highlights track the
  // caret, mirroring the desktop toolbar's subscription.
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

  // Only show while an editor is mounted; otherwise the bottom tab bar shows.
  if (!editor || editor.isDestroyed) return null;

  const chain = () => editor.chain().focus();
  const isActive = (name: string, attrs?: Record<string, unknown>) => {
    try {
      return editor.isActive(name, attrs);
    } catch {
      return false;
    }
  };
  const cmds = editor.commands as Record<string, unknown>;
  const hasHeading = typeof cmds.toggleHeading === "function";

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-[var(--wc-border)] bg-[var(--wc-surface)]/95 backdrop-blur md:hidden"
      style={{
        // Ride above the keyboard; when closed, sit on the safe-area inset.
        bottom: inset > 0 ? inset : 0,
        paddingBottom: inset > 0 ? 0 : "env(safe-area-inset-bottom)",
      }}
      role="toolbar"
      aria-label="Text formatting"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TBtn label={<UndoIcon />} title="Undo" onClick={() => chain().undo().run()} />
        <TBtn label={<RedoIcon />} title="Redo" onClick={() => chain().redo().run()} />
        <Sep />
        <TBtn label="B" bold title="Bold" active={isActive("bold")} onClick={() => chain().toggleBold().run()} />
        <TBtn label="I" italic title="Italic" active={isActive("italic")} onClick={() => chain().toggleItalic().run()} />
        <TBtn label="U" underline title="Underline" active={isActive("underline")} onClick={() => chain().toggleUnderline().run()} />
        <Sep />
        {hasHeading && (
          <>
            <TBtn label="H1" title="Heading 1" active={isActive("heading", { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()} />
            <TBtn label="H2" title="Heading 2" active={isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
            <Sep />
          </>
        )}
        <TBtn label="•" title="Bullet list" active={isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
        <TBtn label="1." title="Numbered list" active={isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
        <TBtn label="❝" title="Quote" active={isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
        <Sep />
        <TBtn
          label="Aa"
          title="More"
          active={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        />
        <div className="ml-auto pl-2">
          <TBtn label="Done" title="Dismiss keyboard" onClick={() => { editor.commands.blur(); }} wide />
        </div>
      </div>

      {moreOpen && (
        <div className="flex items-center gap-0.5 overflow-x-auto border-t border-[var(--wc-border)] px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TBtn label="S" strike title="Strikethrough" active={isActive("strike")} onClick={() => chain().toggleStrike().run()} />
          {typeof cmds.toggleHighlight === "function" && (
            <TBtn
              label={<span className="rounded-sm bg-[#fde68a] px-0.5 text-[var(--wc-ink)]">H</span>}
              title="Highlight"
              active={isActive("highlight")}
              onClick={() => chain().toggleHighlight().run()}
            />
          )}
          {hasHeading && (
            <TBtn label="H3" title="Heading 3" active={isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
          )}
          <TBtn label="¶" title="Paragraph" onClick={() => chain().setParagraph().run()} />
          {typeof cmds.indent === "function" && (
            <>
              <TBtn label={<OutdentIcon />} title="Outdent" onClick={() => chain().outdent().run()} />
              <TBtn label={<IndentIcon />} title="Indent" onClick={() => chain().indent().run()} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TBtn({
  label,
  title,
  active = false,
  bold,
  italic,
  underline,
  strike,
  wide,
  onClick,
}: {
  label: React.ReactNode;
  title: string;
  active?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // preventDefault keeps the editor focused / selection intact on tap.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-10 grid place-items-center rounded-lg text-[15px] shrink-0 ${
        wide ? "px-3" : "min-w-10 px-2"
      } ${
        active
          ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
          : "text-[var(--wc-ink)] active:bg-[var(--wc-paper)]"
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

function Sep() {
  return <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-[var(--wc-stone)]" />;
}

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h1" />
    </svg>
  );
}
function IndentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="21" y1="6" x2="9" y2="6" />
      <line x1="21" y1="12" x2="13" y2="12" />
      <line x1="21" y1="18" x2="9" y2="18" />
      <path d="M3 8l4 4-4 4" />
    </svg>
  );
}
function OutdentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="21" y1="6" x2="9" y2="6" />
      <line x1="21" y1="12" x2="13" y2="12" />
      <line x1="21" y1="18" x2="9" y2="18" />
      <path d="M7 8l-4 4 4 4" />
    </svg>
  );
}
