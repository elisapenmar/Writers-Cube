import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import {
  type PublishSettings,
  FONT_STACKS,
  LINE_SPACING_VALUE,
  TRIM_SIZES,
  chapterHeading,
} from "@/lib/publish-types";
import { renderEpub } from "@/lib/epub";

export type ManuscriptScene = { title: string; paragraphs: string[] };
export type ManuscriptChapter = { title: string; scenes: ManuscriptScene[] };
export type Manuscript = {
  title: string;
  author: string | null;
  agent: string | null;
  chapters: ManuscriptChapter[];
  totalWords: number;
};

export type ExportFormat = "md" | "txt" | "html" | "docx" | "epub" | "pdf";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; note: string }[] = [
  { id: "epub", label: "Ebook (.epub)", ext: "epub", note: "Kindle, Apple Books, Kobo, ebook stores" },
  { id: "pdf", label: "Print PDF", ext: "html", note: "Print-ready pages → Save as PDF" },
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

/** Print-ready, settings-styled HTML for "Save as PDF". */
export function renderPrintHtml(m: Manuscript, s: PublishSettings): string {
  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const title = s.title || m.title;
  const author = s.author || m.author || "";
  const font = FONT_STACKS[s.bodyFont].css;
  const line = LINE_SPACING_VALUE[s.lineSpacing];
  const align = s.justify ? "justify" : "left";
  const indent = s.paragraphStyle === "indent" ? "1.4em" : "0";
  const spaced = s.paragraphStyle === "spaced";
  const trim = TRIM_SIZES[s.trimSize];

  const front: string[] = [];
  if (s.titlePage) {
    front.push(
      `<section class="page title-page"><h1 class="book-title">${esc(title)}</h1>${
        s.subtitle ? `<p class="subtitle">${esc(s.subtitle)}</p>` : ""
      }${author ? `<p class="byline">${esc(author)}</p>` : ""}</section>`,
    );
  }
  if (s.copyrightPage) {
    const year = s.copyrightYear || String(new Date().getFullYear());
    const lines = [
      esc(title),
      `Copyright © ${esc(year)} ${esc(author)}`,
      s.rights ? esc(s.rights) : "",
      s.publisher ? esc(s.publisher) : "",
      s.isbn ? `ISBN: ${esc(s.isbn)}` : "",
    ].filter(Boolean);
    front.push(`<section class="page copyright-page"><p>${lines.join("<br/>")}</p></section>`);
  }
  if (s.dedication && s.dedication.trim()) {
    front.push(
      `<section class="page dedication-page"><p class="dedication">${esc(s.dedication.trim())}</p></section>`,
    );
  }
  if (s.tableOfContents) {
    const items = m.chapters
      .map((ch, ci) => `<li>${esc(chapterHeading(s.chapterHeadingStyle, ci, ch.title))}</li>`)
      .join("");
    front.push(`<section class="page toc-page"><h2>Contents</h2><ol class="toc">${items}</ol></section>`);
  }

  const body = m.chapters
    .map((ch, ci) => {
      const heading = esc(chapterHeading(s.chapterHeadingStyle, ci, ch.title));
      const scenes = ch.scenes
        .map((sc, si) => {
          const sep = si > 0 ? `<p class="scene-break">${esc(s.sceneBreak)}</p>` : "";
          const paras = sc.paragraphs
            .map((p, pi) => `<p${pi === 0 ? ' class="first"' : ""}>${esc(p)}</p>`)
            .join("\n");
          return sep + paras;
        })
        .join("\n");
      return `<section class="chapter"><h2 class="chapter-title">${heading}</h2>\n${scenes}</section>`;
    })
    .join("\n");

  return `<!doctype html><html lang="${esc(s.language || "en")}"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: ${trim.widthIn}in ${trim.heightIn}in; margin: 0.75in 0.7in; }
  html { font-size: ${s.fontSize}pt; }
  body { font-family: ${font}; line-height: ${line}; text-align: ${align}; color: #1a1a1a; margin: 0; }
  .page { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
  .book-title { font-size: 2.4em; font-weight: normal; margin: 0 0 0.3em; }
  .subtitle { font-style: italic; color: #444; }
  .byline { margin-top: 2em; font-size: 1.1em; }
  .copyright-page { justify-content: flex-end; font-size: 0.85em; line-height: 1.6; }
  .dedication { font-style: italic; }
  .toc-page { justify-content: flex-start; }
  .toc { list-style: none; padding: 0; text-align: left; }
  .toc li { margin: 0.4em 0; }
  .chapter { ${s.chaptersNewPage ? "page-break-before: always;" : ""} }
  .chapter-title { font-size: 1.6em; font-weight: normal; text-align: center; margin: 2.4em 0 1.6em; }
  p { margin: 0; text-indent: ${indent}; ${spaced ? "margin-bottom: 0.85em; text-indent: 0;" : ""} orphans: 2; widows: 2; }
  p.first { text-indent: 0; }
  ${s.dropCaps ? "p.first::first-letter { font-size: 3.2em; line-height: 0.8; float: left; padding: 0.02em 0.06em 0 0; }" : ""}
  .scene-break { text-align: center; text-indent: 0; margin: 1.4em 0; letter-spacing: 0.3em; }
  .end { text-align: center; margin-top: 3em; letter-spacing: 0.2em; }
</style></head><body>
${front.join("\n")}
${body}
${s.theEnd ? `<p class="end">The End</p>` : ""}
</body></html>`;
}

const SP: Record<PublishSettings["lineSpacing"], number> = {
  single: 276,
  "1.5": 360,
  double: 480,
};

export async function renderDocx(m: Manuscript, settings?: PublishSettings): Promise<Buffer> {
  const children: Paragraph[] = [];
  const s = settings;
  const title = s?.title || m.title;
  const author = s?.author ?? m.author ?? null;
  const fontName = s ? FONT_STACKS[s.bodyFont].docx : undefined;
  const sizeHalfPt = s ? s.fontSize * 2 : 24;
  const lineSpacing = s ? SP[s.lineSpacing] : 480;
  const firstLine = !s || s.paragraphStyle === "indent" ? 720 : undefined;
  const afterPara = s && s.paragraphStyle === "spaced" ? 160 : undefined;
  const align = s && s.justify ? AlignmentType.JUSTIFIED : undefined;
  const sceneBreak = s?.sceneBreak ?? "* * *";

  // Title page
  if (!s || s.titlePage) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2000, after: 200 },
        children: [new TextRun({ text: title, bold: true, size: 40, font: fontName })],
      }),
    );
    if (s?.subtitle) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: s.subtitle, italics: true, size: 26, font: fontName })],
        }),
      );
    }
    if (author) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: `by ${author}`, size: 28, font: fontName })],
        }),
      );
    }
    if (!s) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: `${m.totalWords.toLocaleString()} words`, size: 22, color: "666666" }),
          ],
        }),
      );
    }
  }

  // Copyright page
  if (s?.copyrightPage) {
    const year = s.copyrightYear || String(new Date().getFullYear());
    const lines = [
      title,
      `Copyright © ${year} ${author ?? ""}`,
      s.rights ?? "",
      s.publisher ?? "",
      s.isbn ? `ISBN: ${s.isbn}` : "",
    ].filter(Boolean);
    for (const l of lines) {
      children.push(
        new Paragraph({
          pageBreakBefore: l === lines[0],
          spacing: { after: 80 },
          children: [new TextRun({ text: l, size: 20, font: fontName })],
        }),
      );
    }
  }

  m.chapters.forEach((ch, ci) => {
    const heading = s ? chapterHeading(s.chapterHeadingStyle, ci, ch.title) : `Chapter ${ci + 1} — ${ch.title}`;
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: s ? s.chaptersNewPage : true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 360 },
        children: [new TextRun({ text: heading, bold: true, size: 28, font: fontName })],
      }),
    );
    ch.scenes.forEach((sc, si) => {
      if (si > 0) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [new TextRun({ text: sceneBreak, font: fontName })],
          }),
        );
      }
      for (const p of sc.paragraphs) {
        children.push(
          new Paragraph({
            alignment: align,
            spacing: { line: lineSpacing, after: afterPara },
            indent: firstLine ? { firstLine } : undefined,
            children: [new TextRun({ text: p, size: sizeHalfPt, font: fontName })],
          }),
        );
      }
    });
  });

  if (!s || s.theEnd) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480 },
        children: [new TextRun({ text: "THE END", font: fontName })],
      }),
    );
  }

  const doc = new Document({
    creator: author ?? "Writer's Cube",
    title,
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

/** Convenience: render to the requested format, returning bytes + headers. */
export async function renderManuscript(
  m: Manuscript,
  format: ExportFormat,
  settings?: PublishSettings,
): Promise<{ body: Buffer | string; contentType: string; ext: string }> {
  switch (format) {
    case "txt":
      return { body: renderText(m), contentType: "text/plain; charset=utf-8", ext: "txt" };
    case "html":
      return { body: renderHtml(m), contentType: "text/html; charset=utf-8", ext: "html" };
    case "pdf":
      // Print-ready HTML — the browser's "Save as PDF" produces the file.
      return {
        body: settings ? renderPrintHtml(m, settings) : renderHtml(m),
        contentType: "text/html; charset=utf-8",
        ext: "html",
      };
    case "epub":
      if (!settings) throw new Error("EPUB export requires publish settings");
      return {
        body: await renderEpub(m, settings),
        contentType: "application/epub+zip",
        ext: "epub",
      };
    case "docx":
      return {
        body: await renderDocx(m, settings),
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
