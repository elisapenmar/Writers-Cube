// Wave 2 · Stream B: the global right-click language lookup. Registers two
// editor context-menu items ("Look up" + "Find another word") that open the
// floating lookup popover (`@/components/lookup`). Registration runs at module
// load; the host wires it in via the one import line in
// `@/lib/editor-menu/contributions`.
//
// The menu's `run` fires after the context menu has closed, so the popover is
// opened through the module store (`@/lib/lookup/popover-store`) which the
// always-mounted `<LookupPopoverHost/>` listens to.

import {
  registerEditorMenuItem,
  type EditorMenuContext,
} from "@/lib/editor-menu/registry";
import { openLookupPopover, type LookupAnchor } from "@/lib/lookup/popover-store";

// Mirror of the registry's word matcher: used to find the word straddling `pos`
// when there is no active selection, so we can replace exactly that range.
const WORD_TAIL_RE = /[\p{L}\p{N}'’-]+$/u;
const WORD_HEAD_RE = /^[\p{L}\p{N}'’-]+/u;

/** Screen point just below the clicked word, used to anchor the popover. */
function anchorFor(ctx: EditorMenuContext): LookupAnchor {
  try {
    const { from, to } = ctx.editor.state.selection;
    const at = ctx.editor.view.coordsAtPos(ctx.selectedText ? from : ctx.pos);
    // `bottom` of the end position keeps the card just under the selection.
    const end = ctx.editor.view.coordsAtPos(ctx.selectedText ? to : ctx.pos);
    return { x: at.left, y: Math.max(at.bottom, end.bottom) + 4 };
  } catch {
    return { x: 80, y: 120 };
  }
}

/**
 * Resolve the document range to replace: the active selection if any, otherwise
 * the word straddling `pos` within its text block. Returns null when no word is
 * present (the thesaurus item is hidden in that case anyway).
 */
function wordRange(ctx: EditorMenuContext): { from: number; to: number } | null {
  const sel = ctx.editor.state.selection;
  if (!sel.empty) return { from: sel.from, to: sel.to };
  try {
    const $pos = ctx.editor.state.doc.resolve(ctx.pos);
    const text = $pos.parent.textContent;
    const offset = $pos.parentOffset;
    const before = text.slice(0, offset).match(WORD_TAIL_RE)?.[0] ?? "";
    const after = text.slice(offset).match(WORD_HEAD_RE)?.[0] ?? "";
    if (!before && !after) return null;
    const start = ctx.pos - before.length;
    const end = ctx.pos + after.length;
    return { from: start, to: end };
  } catch {
    return null;
  }
}

registerEditorMenuItem({
  id: "lookup-define",
  label: (ctx) => `Look up “${ctx.word}”`,
  when: (ctx) => !!ctx.word,
  order: 10,
  run: (ctx) => {
    const anchor = anchorFor(ctx);
    openLookupPopover({ mode: "define", word: ctx.word, anchor });
  },
});

registerEditorMenuItem({
  id: "lookup-thesaurus",
  label: "Find another word",
  when: (ctx) => !!ctx.word,
  order: 20,
  run: (ctx) => {
    const anchor = anchorFor(ctx);
    // Capture the range now; the popover may open after focus moves, but the
    // positions stay valid since the doc isn't mutated until a synonym is picked.
    const range = wordRange(ctx);
    openLookupPopover({
      mode: "thesaurus",
      word: ctx.word,
      anchor,
      onReplace: range
        ? (replacement) => {
            // Single ProseMirror transaction: select the looked-up range and
            // overwrite it in place, then leave the caret after the new word.
            ctx.editor
              .chain()
              .focus()
              .insertContentAt({ from: range.from, to: range.to }, replacement)
              .run();
          }
        : undefined,
    });
  },
});
