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

function renderNode(node: Node, depth = 0): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map((n) => renderNode(n)).join("\n\n").trim() + "\n";
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
  return (node.content ?? []).map(renderInline).join("");
}

export function tiptapToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  return renderNode(doc as Node);
}
