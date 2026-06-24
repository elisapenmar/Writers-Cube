import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Indent } from "@/lib/indent";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";

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
  Color,
  Image.configure({ allowBase64: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  ...ALL_TAG_MARKS,
];
