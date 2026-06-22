import { Extension } from "@tiptap/core";

const MAX_INDENT = 8;
const INDENT_EM = 1.6;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

/** Adds a numeric `indent` level to paragraphs & headings, with indent/outdent. */
export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const data = el.getAttribute("data-indent");
              return data ? Number(data) || 0 : 0;
            },
            renderHTML: (attrs) => {
              const level = (attrs.indent as number) || 0;
              if (!level) return {};
              return {
                "data-indent": level,
                style: `margin-left: ${level * INDENT_EM}em`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const shift =
      (delta: number) =>
      ({ state, dispatch, tr }: { state: import("@tiptap/pm/state").EditorState; dispatch?: (tr: import("@tiptap/pm/state").Transaction) => void; tr: import("@tiptap/pm/state").Transaction }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name !== "paragraph" && node.type.name !== "heading") return;
          const cur = (node.attrs.indent as number) || 0;
          const next = Math.min(MAX_INDENT, Math.max(0, cur + delta));
          if (next !== cur) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return {
      indent: () => shift(1),
      outdent: () => shift(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});
