// Convert the clean, semantic HTML that mammoth (docx) and Google Docs export
// into TipTap/ProseMirror block nodes — preserving paragraphs, headings, bullet
// & numbered lists, blockquotes, and bold/italic/underline. Dependency-free.

type Mark = { type: string };
type Inline = { type: "text"; text: string; marks?: Mark[] };
export type TBlock = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (TBlock | Inline)[];
};

type Tok =
  | { t: "open"; name: string; self: boolean }
  | { t: "close"; name: string }
  | { t: "text"; text: string };

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function tokenize(html: string): Tok[] {
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>|[^<]+/g;
  const out: Tok[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[0];
    if (raw[0] === "<") {
      const name = m[1].toLowerCase();
      if (raw[1] === "/") out.push({ t: "close", name });
      else out.push({ t: "open", name, self: m[2] === "/" || name === "br" });
    } else {
      const text = decode(raw);
      if (text) out.push({ t: "text", text });
    }
  }
  return out;
}

const MARK_TAGS: Record<string, string> = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  u: "underline",
};

/** Collect inline content (text + marks) until the matching close tag. */
function readInline(toks: Tok[], start: number, stop: string): { nodes: Inline[]; next: number } {
  const nodes: Inline[] = [];
  const marks: string[] = [];
  let i = start;
  const push = (text: string) => {
    if (!text) return;
    const m = [...new Set(marks)].map((type) => ({ type }));
    nodes.push(m.length ? { type: "text", text, marks: m } : { type: "text", text });
  };
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.t === "close" && tk.name === stop) {
      i++;
      break;
    }
    if (tk.t === "text") {
      push(tk.text);
    } else if (tk.t === "open") {
      if (tk.name === "br") {
        nodes.push({ type: "hardBreak" } as unknown as Inline);
      } else if (MARK_TAGS[tk.name]) {
        marks.push(MARK_TAGS[tk.name]);
      }
    } else if (tk.t === "close" && MARK_TAGS[tk.name]) {
      const idx = marks.lastIndexOf(MARK_TAGS[tk.name]);
      if (idx !== -1) marks.splice(idx, 1);
    }
    i++;
  }
  return { nodes, next: i };
}

/** Grab the raw token slice up to the matching close of `name` (handles nesting). */
function sliceUntilClose(toks: Tok[], start: number, name: string): { inner: Tok[]; next: number } {
  let depth = 1;
  let i = start;
  const inner: Tok[] = [];
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.t === "open" && tk.name === name && !tk.self) depth++;
    else if (tk.t === "close" && tk.name === name) {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    inner.push(tk);
    i++;
  }
  return { inner, next: i };
}

function parseBlocks(toks: Tok[]): TBlock[] {
  const blocks: TBlock[] = [];
  let i = 0;
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.t === "open") {
      const n = tk.name;
      if (/^h[1-6]$/.test(n)) {
        const level = Math.min(3, Number(n[1]));
        const { nodes, next } = readInline(toks, i + 1, n);
        blocks.push({ type: "heading", attrs: { level }, content: nodes.length ? nodes : [] });
        i = next;
      } else if (n === "p") {
        const { nodes, next } = readInline(toks, i + 1, "p");
        blocks.push(nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" });
        i = next;
      } else if (n === "ul" || n === "ol") {
        const { inner, next } = sliceUntilClose(toks, i + 1, n);
        const items = parseListItems(inner);
        if (items.length) {
          blocks.push({ type: n === "ul" ? "bulletList" : "orderedList", content: items });
        }
        i = next;
      } else if (n === "blockquote") {
        const { inner, next } = sliceUntilClose(toks, i + 1, "blockquote");
        const inside = parseBlocks(inner);
        blocks.push({
          type: "blockquote",
          content: inside.length ? inside : [{ type: "paragraph" }],
        });
        i = next;
      } else {
        // Transparent wrapper (div/span/etc.): drop the tag, keep its children.
        i++;
      }
    } else if (tk.t === "text") {
      if (tk.text.trim()) {
        blocks.push({ type: "paragraph", content: [{ type: "text", text: tk.text }] });
      }
      i++;
    } else {
      i++;
    }
  }
  return blocks;
}

function parseListItems(toks: Tok[]): TBlock[] {
  const items: TBlock[] = [];
  let i = 0;
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.t === "open" && tk.name === "li") {
      const { inner, next } = sliceUntilClose(toks, i + 1, "li");
      // If the <li> wraps block children (<p>, nested list, etc.) parse them as
      // blocks; otherwise its content is bare inline → one paragraph (keeps marks).
      const hasBlock = inner.some(
        (t) =>
          t.t === "open" &&
          (t.name === "p" ||
            t.name === "ul" ||
            t.name === "ol" ||
            t.name === "blockquote" ||
            /^h[1-6]$/.test(t.name)),
      );
      let content: TBlock[];
      if (hasBlock) {
        content = parseBlocks(inner);
      } else {
        const { nodes } = readInline([...inner, { t: "close", name: "li" }], 0, "li");
        content = [nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" }];
      }
      if (!content.length) content = [{ type: "paragraph" }];
      items.push({ type: "listItem", content });
      i = next;
    } else {
      i++;
    }
  }
  return items;
}

/** Top-level: HTML → array of TipTap block nodes. */
export function htmlToTiptapBlocks(html: string): TBlock[] {
  let s = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  const bm = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bm) s = bm[1];
  return parseBlocks(tokenize(s)).filter(
    (b) => b.type !== "paragraph" || (b.content && b.content.length) || true,
  );
}
