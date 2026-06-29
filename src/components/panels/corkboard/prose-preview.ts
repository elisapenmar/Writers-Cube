// Pull the opening line(s) of a scene's prose out of its TipTap doc, used as the
// card's fallback text when the writer hasn't written a synopsis yet.

type Node = { type?: string; text?: string; content?: Node[] };

function nodeText(node: Node): string {
  let out = "";
  const walk = (n: Node) => {
    if (n.type === "text" && typeof n.text === "string") out += n.text;
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(node);
  return out.replace(/\s+/g, " ").trim();
}

/** First non-empty block of prose, trimmed to `max` characters. */
export function openingLine(content: unknown, max = 180): string {
  const doc = content as Node | null;
  if (!doc || !Array.isArray(doc.content)) return "";
  for (const block of doc.content) {
    const t = nodeText(block);
    if (t) return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
  }
  return "";
}
