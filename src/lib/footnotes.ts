import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

/**
 * Footnotes, modelled as a reference + collected-list pair (mirrors the shape of
 * the `tag-mark.ts` custom extensions, scaled up to nodes):
 *
 *   - `footnoteRef` — an inline atom dropped at the cursor; renders as a
 *     superscript number. The visible number is produced by a CSS counter (see
 *     globals.css `sup[data-footnote-ref]`), so it always reflects document order
 *     with zero bookkeeping in the doc.
 *   - `footnote` / `footnotes` — an ordered list auto-appended at the end of the
 *     document, one `footnote` per reference, linked by a shared `id`.
 *
 * Stored entirely inside the scene's Tiptap JSON — no schema/DB change. Deleting a
 * reference removes its paired note (and an empty list) via `appendTransaction`.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnotes: {
      /** Insert a footnote reference at the cursor and a matching empty note. */
      addFootnote: () => ReturnType;
    };
  }
}

function newFootnoteId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10);
}

/** The inline superscript marker that points at a note. */
export const FootnoteRef = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs.id as string;
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-ref": "",
        class: "wc-fn-ref",
      }),
      ["a", { href: `#fn-${id}`, id: `fnref-${id}` }],
    ];
  },
});

/** A single note body (holds at least one paragraph). */
export const Footnote = Node.create({
  name: "footnote",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "li[data-footnote]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs.id as string;
    return [
      "li",
      mergeAttributes(HTMLAttributes, {
        "data-footnote": "",
        id: `fn-${id}`,
      }),
      0,
    ];
  },
});

/** The ordered list of notes, kept at the end of the document. */
export const Footnotes = Node.create({
  name: "footnotes",
  group: "block",
  content: "footnote+",
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: "ol[data-footnotes]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ol",
      mergeAttributes(HTMLAttributes, {
        "data-footnotes": "",
        class: "wc-footnotes",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      addFootnote:
        () =>
        ({ state, tr, dispatch }) => {
          const id = newFootnoteId();
          const refNode = state.schema.nodes.footnoteRef.create({ id });
          const noteNode = state.schema.nodes.footnote.create(
            { id },
            state.schema.nodes.paragraph.create(),
          );

          // 1. Drop the reference at the current selection.
          tr.replaceSelectionWith(refNode, false);

          // 2. Where does this reference sit among all references (document
          //    order)? The note must land at the same ordinal so the list stays
          //    in sync with the superscript numbers.
          let ordinal = 0;
          let seq = 0;
          tr.doc.descendants((n) => {
            if (n.type.name === "footnoteRef") {
              if (n.attrs.id === id) ordinal = seq;
              seq += 1;
            }
          });

          // 3. Find the footnotes list (if any) in the updated doc.
          let listPos = -1;
          let listNode: import("@tiptap/pm/model").Node | null = null;
          tr.doc.forEach((child, offset) => {
            if (child.type.name === "footnotes") {
              listPos = offset;
              listNode = child;
            }
          });

          // 4. Insert the note at the right ordinal (creating the list at the doc
          //    end if it doesn't exist yet), then park the cursor inside it.
          let noteStart: number;
          if (listNode) {
            const list: import("@tiptap/pm/model").Node = listNode;
            let insertAt = listPos + list.nodeSize - 1; // default: end of list
            if (ordinal < list.childCount) {
              let pos = listPos + 1;
              let i = 0;
              let placed = false;
              list.forEach((child) => {
                if (!placed && i === ordinal) {
                  insertAt = pos;
                  placed = true;
                }
                pos += child.nodeSize;
                i += 1;
              });
            }
            tr.insert(insertAt, noteNode);
            noteStart = insertAt;
          } else {
            const list = state.schema.nodes.footnotes.create(null, noteNode);
            const end = tr.doc.content.size;
            tr.insert(end, list);
            noteStart = end + 1; // skip into the footnotes list to the first note
          }

          if (dispatch) {
            // +2: step into the note, then into its paragraph's text.
            const sel = TextSelection.near(tr.doc.resolve(noteStart + 2));
            tr.setSelection(sel).scrollIntoView();
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [orphanCleanupPlugin];
  },
});

const orphanCleanupKey = new PluginKey("footnoteOrphanCleanup");

/**
 * Keeps the notes list honest: when a reference is deleted, drop its note; when
 * the list runs empty, remove the list itself.
 */
const orphanCleanupPlugin = new Plugin({
  key: orphanCleanupKey,
  appendTransaction(transactions, _oldState, newState) {
    if (!transactions.some((t) => t.docChanged)) return null;

    const refIds = new Set<string>();
    newState.doc.descendants((node) => {
      if (node.type.name === "footnoteRef" && node.attrs.id) {
        refIds.add(node.attrs.id as string);
      }
    });

    // Collect notes whose reference is gone (delete from end → start so earlier
    // positions stay valid).
    const removals: { from: number; to: number }[] = [];
    let listPos = -1;
    let listNode: import("@tiptap/pm/model").Node | null = null;
    newState.doc.forEach((child, offset) => {
      if (child.type.name === "footnotes") {
        listPos = offset;
        listNode = child;
      }
    });
    if (listPos < 0 || !listNode) return null;

    const list: import("@tiptap/pm/model").Node = listNode;
    let liveNotes = 0;
    list.forEach((note, noteOffset) => {
      const id = note.attrs.id as string;
      if (!refIds.has(id)) {
        const from = listPos + 1 + noteOffset;
        removals.push({ from, to: from + note.nodeSize });
      } else {
        liveNotes += 1;
      }
    });

    if (removals.length === 0) return null;

    const tr = newState.tr;
    if (liveNotes === 0) {
      // Nothing left — remove the whole list.
      tr.delete(listPos, listPos + list.nodeSize);
    } else {
      for (let i = removals.length - 1; i >= 0; i -= 1) {
        tr.delete(removals[i].from, removals[i].to);
      }
    }
    return tr.docChanged ? tr : null;
  },
});

export const FOOTNOTE_NODES = [FootnoteRef, Footnote, Footnotes];
