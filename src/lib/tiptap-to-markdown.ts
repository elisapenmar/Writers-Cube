type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: Mark[];
};

function renderText(node: Node): string {
  let text = node.text ?? "";
  if (!node.marks) return text;
  for (const mark of node.marks) {
    if (mark.type === "bold") text = `**${text}**`;
    else if (mark.type === "italic") text = `*${text}*`;
    else if (mark.type === "strike") text = `~~${text}~~`;
    else if (mark.type === "code") text = `\`${text}\``;
    else if (mark.type === "link") {
      const href = (mark.attrs?.href as string) ?? "";
      text = `[${text}](${href})`;
    }
  }
  return text;
}

/** Footnote id → number, in document order, for the current serialization. */
let mdFnMap: Map<string, number> = new Map();

function footnoteNumbersMd(content: Node[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  let n = 0;
  const walk = (nodes: Node[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "footnotes") continue;
      if (node.type === "footnoteRef") {
        const id = String(node.attrs?.id ?? "");
        if (id && !map.has(id)) {
          n += 1;
          map.set(id, n);
        }
      } else if (node.content) {
        walk(node.content);
      }
    }
  };
  walk(content);
  return map;
}

function renderNode(node: Node, depth = 0): string {
  switch (node.type) {
    case "doc":
      return (
        (node.content ?? [])
          .filter((n) => n.type !== "footnotes")
          .map((n) => renderNode(n))
          .join("\n\n")
          .trim() + "\n"
      );
    case "paragraph":
      return (node.content ?? []).map(renderInline).join("");
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
      const body = (node.content ?? []).map(renderInline).join("");
      return `${"#".repeat(level)} ${body}`;
    }
    case "blockquote":
      return (node.content ?? [])
        .map((n) => renderNode(n, depth))
        .join("\n\n")
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "bulletList":
      return (node.content ?? [])
        .map((li) => `- ${(li.content ?? []).map((c) => renderNode(c, depth + 1)).join("\n  ")}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map(
          (li, i) =>
            `${i + 1}. ${(li.content ?? []).map((c) => renderNode(c, depth + 1)).join("\n   ")}`,
        )
        .join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const body = (node.content ?? []).map(renderInline).join("");
      return `\`\`\`${lang}\n${body}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    default:
      return (node.content ?? []).map((n) => renderNode(n, depth)).join("\n\n");
  }
}

function renderInline(node: Node): string {
  if (node.type === "text") return renderText(node);
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "footnoteRef") {
    const num = mdFnMap.get(String(node.attrs?.id ?? ""));
    return num ? `[^${num}]` : "";
  }
  return (node.content ?? []).map(renderInline).join("");
}

export function tiptapToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const d = doc as Node;
  mdFnMap = footnoteNumbersMd(d.content);
  const body = renderNode(d);
  const defs: string[] = [];
  for (const node of d.content ?? []) {
    if (node.type !== "footnotes") continue;
    for (const note of node.content ?? []) {
      const num = mdFnMap.get(String(note.attrs?.id ?? ""));
      if (!num) continue;
      const text = (note.content ?? []).map(renderInline).join(" ").trim();
      defs.push(`[^${num}]: ${text}`);
    }
  }
  mdFnMap = new Map();
  return defs.length ? `${body}\n${defs.join("\n")}\n` : body;
}
