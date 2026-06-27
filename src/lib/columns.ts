import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      /** Wrap the current selection in N columns (1 unwraps; updates count if
       *  the selection is already inside a columns block). */
      setColumns: (count: number) => ReturnType;
    };
  }
}

/**
 * A block container that flows its child blocks into CSS multi-columns, applied
 * to a *selection* of text rather than the whole page. Renders a
 * `<div data-columns="N">` so exports/published views keep the layout too;
 * exporters that don't understand it fall back to rendering the inner blocks.
 */
export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute("data-columns")) || 2,
        renderHTML: (attrs) => ({
          "data-columns": attrs.count,
          style: `column-count:${attrs.count}`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-columns]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "wc-columns" }), 0];
  },

  addCommands() {
    return {
      setColumns:
        (count) =>
        ({ editor, chain }) => {
          const active = editor.isActive(this.name);
          if (count <= 1) {
            return active ? chain().toggleWrap(this.name).run() : true;
          }
          if (active) {
            return chain().updateAttributes(this.name, { count }).run();
          }
          return chain().toggleWrap(this.name, { count }).run();
        },
    };
  },
});
