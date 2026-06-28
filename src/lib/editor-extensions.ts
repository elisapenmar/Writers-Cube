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
import { Indent } from "@/lib/indent";
import { FontSize } from "@/lib/font-size";
import { Columns } from "@/lib/columns";
import { Pagination } from "@/lib/pagination";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { FOOTNOTE_NODES } from "@/lib/footnotes";
import { SpellCheck } from "@/lib/spellcheck-extension";

/**
 * The shared rich-text extension set used by every editor in the app, so any
 * content (tables, images, colors, lists, tags) renders consistently wherever
 * it's opened.
 */
export const RTE_EXTENSIONS = [
  StarterKit,
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
  Columns,
  Image.configure({ allowBase64: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  ...ALL_TAG_MARKS,
  ...FOOTNOTE_NODES,
  SpellCheck,
  Pagination,
];
