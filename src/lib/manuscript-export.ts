import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { fetchImageBytes, imageSize } from "@/lib/image-bytes";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import {
  type PublishSettings,
  FONT_STACKS,
  LINE_SPACING_VALUE,
  TRIM_SIZES,
  chapterHeading,
} from "@/lib/publish-types";
import { renderEpub } from "@/lib/epub";

export type ManuscriptScene = { title: string; paragraphs: string[]; html?: string; doc?: unknown };
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
  { id: "pdf", label: "PDF", ext: "html", note: "Opens print dialog → Save as PDF" },
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

function escHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type RNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
};

function renderInlineHtml(node: unknown): string {
  const n = node as RNode;
  if (n.type === "text") {
    let t = escHtml(n.text ?? "");
    for (const mk of n.marks ?? []) {
      if (mk.type === "bold") t = `<strong>${t}</strong>`;
      else if (mk.type === "italic") t = `<em>${t}</em>`;
      else if (mk.type === "underline") t = `<u>${t}</u>`;
      else if (mk.type === "strike") t = `<s>${t}</s>`;
      else if (mk.type === "highlight") {
        const c = mk.attrs?.color ? String(mk.attrs.color) : "#fde68a";
        t = `<mark style="background:${escHtml(c)}">${t}</mark>`;
      } else if (mk.type === "link" && mk.attrs?.href)
        t = `<a href="${escHtml(String(mk.attrs.href))}">${t}</a>`;
      else if (mk.type === "textStyle") {
        const style: string[] = [];
        if (mk.attrs?.color) style.push(`color:${escHtml(String(mk.attrs.color))}`);
        if (mk.attrs?.fontSize) style.push(`font-size:${escHtml(String(mk.attrs.fontSize))}`);
        if (style.length) t = `<span style="${style.join(";")}">${t}</span>`;
      }
    }
    return t;
  }
  if (n.type === "hardBreak") return "<br/>";
  return (n.content ?? []).map(renderInlineHtml).join("");
}

function renderBlockHtml(block: unknown): string {
  const b = block as RNode;
  const kids = () => (b.content ?? []).map(renderBlockHtml).join("");
  const inline = () => (b.content ?? []).map(renderInlineHtml).join("");
  const align = b.attrs?.textAlign ? String(b.attrs.textAlign) : "";
  const alignAttr = align && align !== "left" ? ` style="text-align:${escHtml(align)}"` : "";
  switch (b.type) {
    case "paragraph": {
      const t = inline();
      return `<p${alignAttr}>${t || "&nbsp;"}</p>`;
    }
    case "heading": {
      const lvl = Math.min(6, Number(b.attrs?.level) || 2);
      return `<h${lvl}${alignAttr}>${inline()}</h${lvl}>`;
    }
    case "blockquote":
      return `<blockquote>${kids()}</blockquote>`;
    case "bulletList":
      return `<ul>${kids()}</ul>`;
    case "orderedList":
      return `<ol>${kids()}</ol>`;
    case "listItem":
      return `<li>${kids()}</li>`;
    case "image": {
      const src = b.attrs?.src ? String(b.attrs.src) : "";
      if (!src) return "";
      return `<img src="${escHtml(src)}" alt="${escHtml(String(b.attrs?.alt ?? ""))}"/>`;
    }
    case "table":
      return `<table>${kids()}</table>`;
    case "tableRow":
      return `<tr>${kids()}</tr>`;
    case "tableHeader":
      return `<th>${kids()}</th>`;
    case "tableCell":
      return `<td>${kids()}</td>`;
    default:
      return (b.content ?? []).map(renderBlockHtml).join("");
  }
}

/** Render a TipTap doc to HTML, preserving lists, images, tables, colors & marks. */
export function tiptapToHtml(doc: unknown): string {
  const node = doc as { content?: unknown[] } | null;
  if (!node?.content) return "";
  return node.content.map(renderBlockHtml).join("\n");
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
  // A title page is always included on exports.
  front.push(
    `<section class="page title-page"><h1 class="book-title">${esc(title)}</h1>${
      s.subtitle ? `<p class="subtitle">${esc(s.subtitle)}</p>` : ""
    }${author ? `<p class="byline">${esc(author)}</p>` : ""}</section>`,
  );
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
          // Rich HTML (images, tables, colors, lists) when available; else plain paragraphs.
          const bodyHtml = sc.html
            ? sc.html
            : sc.paragraphs
                .map((p, pi) => `<p${pi === 0 ? ' class="first"' : ""}>${esc(p)}</p>`)
                .join("\n");
          return sep + bodyHtml;
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
  img { max-width: 100%; height: auto; display: block; margin: 1em auto; text-indent: 0; }
  ul, ol { margin: 0.6em 0 0.6em 1.4em; text-indent: 0; }
  li { margin: 0.2em 0; text-indent: 0; }
  blockquote { margin: 1em 0 1em 1.2em; padding-left: 0.8em; border-left: 2px solid #ccc; font-style: italic; text-indent: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; text-indent: 0; page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 0.35em 0.5em; text-align: left; vertical-align: top; }
  th { background: #f0eee9; font-weight: 600; }
  table p { text-indent: 0; margin: 0; }
  /* Screen-only helper bar; hidden when printing/saving to PDF. */
  .pdf-bar { position: fixed; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 0.75rem; justify-content: center; padding: 0.6rem; background: #33303a; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.85rem; z-index: 9999; }
  .pdf-bar button { background: #fff; color: #33303a; border: 0; border-radius: 8px; padding: 0.4rem 0.9rem; font-size: 0.85rem; cursor: pointer; }
  .pdf-spacer { height: 2.6rem; }
  @media print { .pdf-bar, .pdf-spacer { display: none !important; } }
</style></head><body>
<div class="pdf-bar no-print">
  <span>Choose “Save as PDF” as the destination.</span>
  <button onclick="window.print()">Save as PDF</button>
</div>
<div class="pdf-spacer"></div>
${front.join("\n")}
${body}
${s.theEnd ? `<p class="end">The End</p>` : ""}
<script>
  // Open the print dialog automatically so the user lands on Save-as-PDF.
  window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 350); });
</script>
</body></html>`;
}

const SP: Record<PublishSettings["lineSpacing"], number> = {
  single: 276,
  "1.5": 360,
  double: 480,
};

type DocxOpts = {
  font?: string;
  size: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  lineSpacing: number;
  afterPara?: number;
  firstLine?: number;
  italics?: boolean;
};

function alignFor(
  v: unknown,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (v) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "left":
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

function runsFromInline(content: unknown[] | undefined, o: DocxOpts): TextRun[] {
  const runs: TextRun[] = [];
  for (const c of content ?? []) {
    const n = c as RNode;
    if (n.type === "text") {
      const marks = n.marks ?? [];
      const colorMark = marks.find((mk) => mk.type === "textStyle" && mk.attrs?.color);
      const sizeMark = marks.find((mk) => mk.type === "textStyle" && mk.attrs?.fontSize);
      const hasHighlight = marks.some((mk) => mk.type === "highlight");
      // px → half-points (docx size unit is half-points; px≈pt here).
      const pxSize = sizeMark ? parseInt(String(sizeMark.attrs!.fontSize), 10) : NaN;
      runs.push(
        new TextRun({
          text: n.text ?? "",
          bold: marks.some((mk) => mk.type === "bold"),
          italics: o.italics || marks.some((mk) => mk.type === "italic"),
          strike: marks.some((mk) => mk.type === "strike"),
          underline: marks.some((mk) => mk.type === "underline") ? {} : undefined,
          color: colorMark ? String(colorMark.attrs!.color).replace(/^#/, "") : undefined,
          highlight: hasHighlight ? "yellow" : undefined,
          size: Number.isFinite(pxSize) ? pxSize * 2 : o.size,
          font: o.font,
        }),
      );
    } else if (n.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
    } else if (n.content) {
      runs.push(...runsFromInline(n.content, o));
    }
  }
  return runs.length ? runs : [new TextRun({ text: "", size: o.size, font: o.font })];
}

async function imageParagraph(src: string, o: DocxOpts): Promise<Paragraph | null> {
  if (!src) return null;
  const img = await fetchImageBytes(src);
  if (!img || img.ext === "svg") return null;
  const dim = imageSize(img.bytes);
  let width = 450;
  let height = 300;
  if (dim && dim.width > 0) {
    width = Math.min(450, dim.width);
    height = Math.round(width * (dim.height / dim.width));
  }
  const type = img.ext === "jpg" ? "jpg" : img.ext === "gif" ? "gif" : "png";
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({ data: img.bytes, transformation: { width, height }, type } as never),
    ],
  });
}

async function docxBlocks(nodes: unknown[] | undefined, o: DocxOpts): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = [];
  for (const node of nodes ?? []) {
    const b = node as RNode;
    if (b.type === "paragraph") {
      out.push(
        new Paragraph({
          alignment: alignFor(b.attrs?.textAlign) ?? o.align,
          spacing: { line: o.lineSpacing, after: o.afterPara },
          indent: o.firstLine ? { firstLine: o.firstLine } : undefined,
          children: runsFromInline(b.content, o),
        }),
      );
    } else if (b.type === "heading") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: alignFor(b.attrs?.textAlign),
          spacing: { before: 240, after: 120 },
          children: runsFromInline(b.content, o),
        }),
      );
    } else if (b.type === "blockquote") {
      for (const child of b.content ?? []) {
        const c = child as RNode;
        if (c.type === "paragraph") {
          out.push(
            new Paragraph({
              indent: { left: 480 },
              spacing: { line: o.lineSpacing, after: o.afterPara },
              children: runsFromInline(c.content, { ...o, italics: true }),
            }),
          );
        } else {
          out.push(...(await docxBlocks([c], o)));
        }
      }
    } else if (b.type === "bulletList" || b.type === "orderedList") {
      let n = 1;
      for (const li of b.content ?? []) {
        const liNode = li as RNode;
        let first = true;
        for (const child of liNode.content ?? []) {
          const c = child as RNode;
          if (c.type === "paragraph") {
            const runs = runsFromInline(c.content, o);
            if (first && b.type === "orderedList") {
              runs.unshift(new TextRun({ text: `${n}. `, size: o.size, font: o.font }));
            }
            out.push(
              new Paragraph({
                bullet: first && b.type === "bulletList" ? { level: 0 } : undefined,
                indent: { left: 480 },
                spacing: { after: 0 },
                children: runs,
              }),
            );
            first = false;
          }
        }
        n++;
      }
    } else if (b.type === "image") {
      const para = await imageParagraph(b.attrs?.src ? String(b.attrs.src) : "", o);
      if (para) out.push(para);
    } else if (b.type === "table") {
      const rows: TableRow[] = [];
      for (const r of b.content ?? []) {
        const rn = r as RNode;
        const cells: TableCell[] = [];
        for (const c of rn.content ?? []) {
          const cn = c as RNode;
          const cellBlocks = await docxBlocks(cn.content, { ...o, firstLine: undefined });
          cells.push(new TableCell({ children: cellBlocks.length ? cellBlocks : [new Paragraph({})] }));
        }
        rows.push(new TableRow({ children: cells }));
      }
      if (rows.length) out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
    } else if (b.content) {
      out.push(...(await docxBlocks(b.content, o)));
    }
  }
  return out;
}

export async function renderDocx(m: Manuscript, settings?: PublishSettings): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
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

  // Title page — always included on exports.
  {
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

  for (let ci = 0; ci < m.chapters.length; ci++) {
    const ch = m.chapters[ci];
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
    for (let si = 0; si < ch.scenes.length; si++) {
      const sc = ch.scenes[si];
      if (si > 0) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [new TextRun({ text: sceneBreak, font: fontName })],
          }),
        );
      }
      const docNode = sc.doc as { content?: unknown[] } | null;
      if (docNode?.content) {
        // Rich path: keep images, tables, lists, colours, marks.
        const blocks = await docxBlocks(docNode.content, {
          font: fontName,
          size: sizeHalfPt,
          align,
          lineSpacing,
          afterPara,
          firstLine,
        });
        children.push(...blocks);
      } else {
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
      }
    }
  }

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
