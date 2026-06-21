import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";

export type ManuscriptScene = { title: string; paragraphs: string[] };
export type ManuscriptChapter = { title: string; scenes: ManuscriptScene[] };
export type Manuscript = {
  title: string;
  author: string | null;
  agent: string | null;
  chapters: ManuscriptChapter[];
  totalWords: number;
};

export type ExportFormat = "md" | "txt" | "html" | "docx";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; note: string }[] = [
  { id: "docx", label: "Word (.docx)", ext: "docx", note: "For agents, editors, Word & Google Docs" },
  { id: "md", label: "Markdown (.md)", ext: "md", note: "Portable; opens in any text/markdown tool" },
  { id: "txt", label: "Plain text (.txt)", ext: "txt", note: "Universal, no formatting" },
  { id: "html", label: "Web page (.html)", ext: "html", note: "Open in a browser, then print → PDF" },
];

/** Pull plain-text paragraphs from a TipTap doc (paragraphs & headings). */
export function tiptapToParagraphs(doc: unknown): string[] {
  const out: string[] = [];
  const node = doc as { type?: string; content?: unknown[] } | null;
  if (!node?.content) return out;
  for (const block of node.content) {
    const b = block as { type?: string; content?: unknown[] };
    if (b.type === "paragraph" || b.type === "heading" || b.type === "blockquote") {
      const text = inlineText(b);
      if (text.trim()) out.push(text);
    } else if (b.type === "bulletList" || b.type === "orderedList") {
      for (const li of b.content ?? []) {
        const text = inlineText(li as { content?: unknown[] });
        if (text.trim()) out.push("• " + text);
      }
    }
  }
  return out;
}

function inlineText(node: { content?: unknown[]; text?: string; type?: string }): string {
  if (node.type === "text") return node.text ?? "";
  let s = "";
  for (const c of node.content ?? []) s += inlineText(c as { content?: unknown[]; text?: string; type?: string });
  return s;
}

export function safeName(s: string) {
  return s.replace(/[/\\:*?"<>|]/g, "_").trim() || "Untitled";
}

// ---------- renderers ----------

export function renderMarkdown(m: Manuscript): string {
  const lines: string[] = [`# ${m.title}`];
  if (m.author) lines.push(`\n*by ${m.author}*`);
  if (m.agent) lines.push(`\n*Agent: ${m.agent}*`);
  lines.push("");
  m.chapters.forEach((ch, ci) => {
    lines.push("\n\n---\n");
    lines.push(`## Chapter ${ci + 1} — ${ch.title}\n`);
    ch.scenes.forEach((s, si) => {
      if (si > 0) lines.push("\n\\* \\* \\*\n");
      lines.push(s.paragraphs.join("\n\n"));
    });
  });
  lines.push("\n\n*The End*\n");
  return lines.join("\n");
}

export function renderText(m: Manuscript): string {
  const lines: string[] = [m.title.toUpperCase()];
  if (m.author) lines.push(`by ${m.author}`);
  lines.push("");
  m.chapters.forEach((ch, ci) => {
    lines.push("");
    lines.push(`CHAPTER ${ci + 1} — ${ch.title.toUpperCase()}`);
    lines.push("");
    ch.scenes.forEach((s, si) => {
      if (si > 0) lines.push("\n#\n");
      lines.push(s.paragraphs.join("\n\n"));
    });
  });
  lines.push("\n\nTHE END");
  return lines.join("\n");
}

export function renderHtml(m: Manuscript): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = m.chapters
    .map((ch, ci) => {
      const scenes = ch.scenes
        .map(
          (s, si) =>
            (si > 0 ? `<p class="break">* * *</p>` : "") +
            s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n"),
        )
        .join("\n");
      return `<section class="chapter"><h2>Chapter ${ci + 1} — ${esc(ch.title)}</h2>\n${scenes}</section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(m.title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 42rem; margin: 3rem auto; padding: 0 1.5rem; line-height: 1.7; color: #222; }
  h1 { font-size: 2rem; text-align: center; }
  .byline { text-align: center; color: #666; margin-bottom: 3rem; }
  h2 { margin-top: 3rem; }
  .chapter { page-break-before: always; }
  .chapter:first-of-type { page-break-before: avoid; }
  p { text-indent: 1.5em; margin: 0 0 0.2em; }
  p.break { text-align: center; text-indent: 0; margin: 1.5em 0; }
  .end { text-align: center; margin-top: 3rem; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${esc(m.title)}</h1>
<div class="byline">${m.author ? "by " + esc(m.author) : ""}</div>
${body}
<p class="end">The End</p>
</body></html>`;
}

export async function renderDocx(m: Manuscript): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({ text: m.title, bold: true, size: 40 })],
    }),
  );
  if (m.author) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: `by ${m.author}`, size: 28 })],
      }),
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `${m.totalWords.toLocaleString()} words`, size: 22, color: "666666" }),
      ],
      pageBreakBefore: false,
    }),
  );

  m.chapters.forEach((ch, ci) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 360 },
        children: [new TextRun({ text: `Chapter ${ci + 1} — ${ch.title}`, bold: true, size: 28 })],
      }),
    );
    ch.scenes.forEach((s, si) => {
      if (si > 0) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [new TextRun({ text: "* * *" })],
          }),
        );
      }
      for (const p of s.paragraphs) {
        children.push(
          new Paragraph({
            spacing: { line: 480 }, // double-spaced
            indent: { firstLine: 720 }, // 0.5"
            children: [new TextRun({ text: p, size: 24 })], // 12pt
          }),
        );
      }
    });
  });

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
      children: [new TextRun({ text: "THE END" })],
    }),
  );

  const doc = new Document({
    creator: m.author ?? "Writer's Cube",
    title: m.title,
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

/** Convenience: render to the requested format, returning bytes + headers. */
export async function renderManuscript(
  m: Manuscript,
  format: ExportFormat,
): Promise<{ body: Buffer | string; contentType: string; ext: string }> {
  switch (format) {
    case "txt":
      return { body: renderText(m), contentType: "text/plain; charset=utf-8", ext: "txt" };
    case "html":
      return { body: renderHtml(m), contentType: "text/html; charset=utf-8", ext: "html" };
    case "docx":
      return {
        body: await renderDocx(m),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ext: "docx",
      };
    case "md":
    default:
      return { body: renderMarkdown(m), contentType: "text/markdown; charset=utf-8", ext: "md" };
  }
}

/** Re-export the markdown helper so callers can build paragraphs if needed. */
export { tiptapToMarkdown };
