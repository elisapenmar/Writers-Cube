"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { ensureSpeller, isMisspelled, onSpellChange } from "@/lib/spellcheck";

const spellKey = new PluginKey("wc-spellcheck");
// Words: letters with internal apostrophes (don't, writers'), no leading/trailing punctuation.
const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

function buildDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      const word = m[0];
      if (isMisspelled(word)) {
        const from = pos + m.index;
        decos.push(
          Decoration.inline(from, from + word.length, { class: "wc-misspelled" }),
        );
      }
    }
  });
  return DecorationSet.create(doc, decos);
}

/** Underlines misspelled words using our in-app dictionary. Decorations refresh
 *  as the writer types, when the dictionary finishes loading, and when a word is
 *  accepted (via onSpellChange). Suggestions are surfaced by the right-click menu. */
export const SpellCheck = Extension.create({
  name: "wcSpellCheck",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: spellKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            if (tr.getMeta(spellKey)?.force) return buildDecorations(tr.doc);
            if (tr.docChanged) return buildDecorations(tr.doc);
            return old;
          },
        },
        props: {
          decorations(state) {
            return spellKey.getState(state);
          },
        },
        view(editorView) {
          // Turn off the browser's native checker so we don't get two sets of
          // squiggles — ours is the single source of truth.
          editorView.dom.setAttribute("spellcheck", "false");
          // Kick off dictionary load; force a recompute whenever it (or the
          // personal dictionary) changes.
          void ensureSpeller().then(() => {
            editorView.dispatch(editorView.state.tr.setMeta(spellKey, { force: true }));
          });
          const off = onSpellChange(() => {
            editorView.dispatch(editorView.state.tr.setMeta(spellKey, { force: true }));
          });
          return { destroy: off };
        },
      }),
    ];
  },
});
