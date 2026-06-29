"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  elementMatcher,
  lookupElement,
  onStoryElementsChange,
  openStoryElement,
  suggestElements,
  type StoryElement,
} from "@/lib/story-elements";

/* ------------------------------------------------------------------ *
 * 1) Recognizer: underline known element names and open their card.   *
 * ------------------------------------------------------------------ */

const recogKey = new PluginKey("wc-smart-text");

function buildDecorations(doc: PMNode): DecorationSet {
  const re = elementMatcher();
  if (!re) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const el = lookupElement(m[0]);
      if (!el) continue;
      const from = pos + m.index;
      decos.push(
        Decoration.inline(from, from + m[0].length, {
          class: "wc-smart-text",
          "data-el-id": el.id,
          "data-el-kind": el.kind,
          title: `${el.name} — click to open`,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

function recognizerPlugin() {
  return new Plugin({
    key: recogKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        if (tr.getMeta(recogKey)?.force) return buildDecorations(tr.doc);
        if (tr.docChanged) return buildDecorations(tr.doc);
        return old;
      },
    },
    props: {
      decorations(state) {
        return recogKey.getState(state);
      },
      handleClick(view, _pos, event) {
        const target = (event.target as HTMLElement)?.closest?.(
          "[data-el-id]",
        ) as HTMLElement | null;
        if (!target) return false;
        const id = target.getAttribute("data-el-id");
        const kind = target.getAttribute("data-el-kind") as
          | StoryElement["kind"]
          | null;
        if (!id || !kind) return false;
        openStoryElement({ id, kind, name: target.textContent ?? "" });
        // A modifier-click is purely "go to the card", so swallow the event.
        // A plain click also opens the card but lets the caret land so the
        // writer can keep editing the name in place.
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    view(editorView) {
      // Re-scan whenever the Story Bible changes (names added/renamed/removed).
      const off = onStoryElementsChange(() => {
        editorView.dispatch(
          editorView.state.tr.setMeta(recogKey, { force: true }),
        );
      });
      return { destroy: off };
    },
  });
}

/* ------------------------------------------------------------------ *
 * 2) Type-ahead: complete element names as you type.                  *
 * ------------------------------------------------------------------ */

const suggestKey = new PluginKey<SuggestState>("wc-smart-text-suggest");

type SuggestState = {
  active: {
    from: number;
    to: number;
    query: string;
    items: StoryElement[];
    index: number;
  } | null;
  // The (from:query) the writer dismissed with Escape, so it won't reopen
  // until they change the word.
  suppress: string | null;
};

// Trailing word immediately before the caret (letters, apostrophes, hyphens).
const TRAILING_WORD = /[A-Za-z][A-Za-z'’-]*$/;

function keyOf(a: { from: number; query: string }): string {
  return `${a.from}:${a.query.toLowerCase()}`;
}

function computeActive(state: EditorState): SuggestState["active"] {
  const sel = state.selection;
  if (!sel.empty) return null;
  const $head = sel.$head;
  if (!$head.parent.isTextblock) return null;
  const start = $head.start();
  const before = state.doc.textBetween(start, $head.pos, "\n", "￼");
  const m = before.match(TRAILING_WORD);
  if (!m) return null;
  const query = m[0];
  const items = suggestElements(query);
  if (items.length === 0) return null;
  return { from: $head.pos - query.length, to: $head.pos, query, items, index: 0 };
}

function accept(view: EditorView, item: StoryElement | undefined): boolean {
  const st = suggestKey.getState(view.state);
  if (!st?.active || !item) return false;
  const { from, to } = st.active;
  view.dispatch(view.state.tr.insertText(item.name, from, to));
  view.focus();
  return true;
}

function suggestionPlugin() {
  return new Plugin<SuggestState>({
    key: suggestKey,
    state: {
      init: () => ({ active: null, suppress: null }),
      apply(tr, prev, _old, newState) {
        const meta = tr.getMeta(suggestKey) as
          | { action: "move"; delta: number }
          | { action: "dismiss" }
          | undefined;

        let active = computeActive(newState);

        // Carry the highlighted index while the same word stays open.
        if (active && prev.active && keyOf(active) === keyOf(prev.active)) {
          active.index = Math.min(prev.active.index, active.items.length - 1);
        }

        if (meta?.action === "dismiss") {
          return { active: null, suppress: active ? keyOf(active) : prev.suppress };
        }
        if (meta?.action === "move" && active) {
          const n = active.items.length;
          active.index = (active.index + meta.delta + n) % n;
        }

        // Respect a prior Escape until the word changes.
        let suppress = prev.suppress;
        if (active && suppress === keyOf(active)) active = null;
        else suppress = null;

        return { active, suppress };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const st = suggestKey.getState(view.state);
        if (!st?.active) return false;
        switch (event.key) {
          case "ArrowDown":
            view.dispatch(view.state.tr.setMeta(suggestKey, { action: "move", delta: 1 }));
            return true;
          case "ArrowUp":
            view.dispatch(view.state.tr.setMeta(suggestKey, { action: "move", delta: -1 }));
            return true;
          case "Enter":
          case "Tab":
            return accept(view, st.active.items[st.active.index]);
          case "Escape":
            view.dispatch(view.state.tr.setMeta(suggestKey, { action: "dismiss" }));
            return true;
          default:
            return false;
        }
      },
    },
    view(editorView) {
      const dom = document.createElement("div");
      dom.className = "wc-smarttext-suggest";
      dom.style.display = "none";
      // Don't let clicking the popup blur the editor.
      dom.addEventListener("mousedown", (e) => e.preventDefault());
      document.body.appendChild(dom);

      const render = (view: EditorView) => {
        const st = suggestKey.getState(view.state);
        if (!st?.active) {
          dom.style.display = "none";
          dom.replaceChildren();
          return;
        }
        const { items, index, to } = st.active;
        const coords = view.coordsAtPos(to);
        dom.style.display = "block";
        dom.style.left = `${Math.round(coords.left)}px`;
        dom.style.top = `${Math.round(coords.bottom + 4)}px`;
        dom.replaceChildren();
        items.forEach((item, i) => {
          const row = document.createElement("button");
          row.type = "button";
          row.className =
            "wc-smarttext-suggest-item" + (i === index ? " is-active" : "");
          const name = document.createElement("span");
          name.textContent = item.name;
          const kind = document.createElement("span");
          kind.className = "wc-smarttext-suggest-kind";
          kind.textContent = item.kind;
          row.append(name, kind);
          row.addEventListener("click", () => accept(view, item));
          dom.appendChild(row);
        });
      };

      render(editorView);
      return {
        update: (view) => render(view),
        destroy: () => dom.remove(),
      };
    },
  });
}

/**
 * Smart Text: recognizes your characters / places / items as you type,
 * underlines them (⌘/Ctrl-click opens the Story Bible card), and offers
 * type-ahead completion. Decoration-based, so it never alters saved content.
 */
export const SmartText = Extension.create({
  name: "wcSmartText",
  addProseMirrorPlugins() {
    return [recognizerPlugin(), suggestionPlugin()];
  },
});
