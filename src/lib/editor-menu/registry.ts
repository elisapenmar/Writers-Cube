// Editor context-menu contribution API. The editor host (`src/components/editor.tsx`)
// renders its built-in items (cut/copy/paste, link, footnote, spelling, scene
// split) and ALSO a section of items contributed by feature modules through this
// registry, so a feature can add a right-click action without editing the host.
//
// A feature creates a module that calls `registerEditorMenuItem(...)`, then adds a
// one-line import to `src/lib/editor-menu/contributions.ts` so the registration
// runs at load. This mirrors the panel registry (`src/components/panels/registry.ts`).
//
// Wave 2's global "Look up" / "Find another word" lookup items plug in here.

import type { Editor as TiptapEditor } from "@tiptap/react";

/** Resolved selection state passed to a contributed item's `when`/`label`/`run`. */
export type EditorMenuContext = {
  editor: TiptapEditor;
  /** Document position under the click (or caret when clicking past a line). */
  pos: number;
  /** The current selection's text, trimmed; empty when the selection is collapsed. */
  selectedText: string;
  /** The word to act on: the selection if any, otherwise the word under `pos`. */
  word: string;
  /** Close the context menu. Items that open their own UI should call this. */
  close: () => void;
};

export type EditorMenuItem = {
  /** Stable id, unique across all contributions. */
  id: string;
  /** Static label, or a function of context for dynamic labels (e.g. the word). */
  label: string | ((ctx: EditorMenuContext) => string);
  /** Optional keyboard hint shown on the right. */
  shortcut?: string;
  /** Show the item only when this returns true. Default: only when there is a word. */
  when?: (ctx: EditorMenuContext) => boolean;
  /** Run on click. May be async; the menu is closed before this is called. */
  run: (ctx: EditorMenuContext) => void | Promise<void>;
  /** Sort weight; lower comes first. Default 100. */
  order?: number;
};

const items: EditorMenuItem[] = [];

export function registerEditorMenuItem(item: EditorMenuItem): void {
  // Guard against duplicate registration across HMR / repeated imports.
  if (items.some((i) => i.id === item.id)) return;
  items.push(item);
}

/** All contributed items, in display order. */
export function editorMenuItems(): EditorMenuItem[] {
  return [...items].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/** Items visible for the given context (their `when`, defaulting to "has a word"). */
export function visibleEditorMenuItems(ctx: EditorMenuContext): EditorMenuItem[] {
  return editorMenuItems().filter((it) => (it.when ? it.when(ctx) : ctx.word.length > 0));
}

const WORD_RE = /[\p{L}\p{N}'’-]+/u;
const WORD_TAIL_RE = /[\p{L}\p{N}'’-]+$/u;
const WORD_HEAD_RE = /^[\p{L}\p{N}'’-]+/u;

/** Resolve the selection text and the word under `pos` for the menu context. */
export function resolveMenuSelection(
  editor: TiptapEditor,
  pos: number,
): { selectedText: string; word: string } {
  const { state } = editor;
  const sel = state.selection;
  const selectedText = sel.empty ? "" : state.doc.textBetween(sel.from, sel.to, " ").trim();
  if (selectedText) return { selectedText, word: selectedText };

  // Collapsed selection: grab the word straddling `pos` within its text block.
  try {
    const $pos = state.doc.resolve(pos);
    const text = $pos.parent.textContent;
    const offset = $pos.parentOffset;
    const before = text.slice(0, offset).match(WORD_TAIL_RE)?.[0] ?? "";
    const after = text.slice(offset).match(WORD_HEAD_RE)?.[0] ?? "";
    const word = (before + after).trim();
    return { selectedText: "", word: WORD_RE.test(word) ? word : "" };
  } catch {
    return { selectedText: "", word: "" };
  }
}
