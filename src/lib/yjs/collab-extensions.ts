// Collaborative variant of RTE_EXTENSIONS (src/lib/editor-extensions.ts).
// Kept here (and dynamically imported) so Yjs only loads when co-editing is on.
// IMPORTANT: keep this extension list in sync with RTE_EXTENSIONS — the only
// intended differences are: StarterKit's undo/redo is disabled (Yjs provides
// collaborative history) and the two Collaboration extensions are appended.
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { Indent } from "@/lib/indent";
import { FontSize } from "@/lib/font-size";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { FOOTNOTE_NODES } from "@/lib/footnotes";
import { SpellCheck } from "@/lib/spellcheck-extension";
import { SmartText } from "@/lib/smart-text-extension";
import type { SupabaseYjsProvider } from "./provider";

export type CollabUser = { name: string; color: string };

export function buildCollabExtensions(provider: SupabaseYjsProvider, user: CollabUser) {
  return [
    // Yjs owns history; the local undo/redo stack would fight the CRDT.
    StarterKit.configure({ undoRedo: false }),
    Underline,
    Indent,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Image.configure({ allowBase64: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    ...ALL_TAG_MARKS,
    ...FOOTNOTE_NODES,
    SpellCheck,
    SmartText,
    Collaboration.configure({ document: provider.doc }),
    CollaborationCaret.configure({ provider, user }),
  ];
}
