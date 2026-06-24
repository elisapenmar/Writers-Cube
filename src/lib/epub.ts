import JSZip from "jszip";
import type { Manuscript } from "@/lib/manuscript-export";
import {
  type PublishSettings,
  FONT_STACKS,
  LINE_SPACING_VALUE,
  chapterHeading,
} from "@/lib/publish-types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function uuid(): string {
  // Deterministic-enough unique id for the package.
  return "urn:uuid:xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function stylesheet(s: PublishSettings): string {
  const font = FONT_STACKS[s.bodyFont].css;
  const line = LINE_SPACING_VALUE[s.lineSpacing];
  const align = s.justify ? "justify" : "left";
  const indent = s.paragraphStyle === "indent" ? "1.4em" : "0";
  const spaced = s.paragraphStyle === "spaced";
  return `
@page { margin: 5%; }
body { font-family: ${font}; line-height: ${line}; text-align: ${align}; margin: 0; padding: 0 1em; }
h1, h2 { font-family: ${font}; font-weight: normal; text-align: center; }
h1.book-title { font-size: 2em; margin: 3em 0 0.2em; }
h1.subtitle { font-size: 1.1em; font-style: italic; color: #444; margin: 0; }
.byline { text-align: center; font-size: 1.1em; margin: 1.5em 0; }
.chapter-title { font-size: 1.5em; margin: 2.4em 0 1.4em; text-align: center; }
p { margin: 0; text-indent: ${indent}; ${spaced ? "margin-bottom: 0.9em; text-indent: 0;" : ""} }
p.first { text-indent: 0; }
${s.dropCaps ? `p.first::first-letter { font-size: 3.2em; line-height: 0.8; float: left; padding-right: 0.06em; }` : ""}
.scene-break { text-align: center; text-indent: 0; margin: 1.4em 0; letter-spacing: 0.3em; }
img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
ul, ol { margin: 0.6em 0 0.6em 1.4em; text-indent: 0; }
li { text-indent: 0; }
blockquote { margin: 1em 0 1em 1.2em; padding-left: 0.8em; border-left: 2px solid #ccc; font-style: italic; text-indent: 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #999; padding: 0.3em 0.5em; text-align: left; vertical-align: top; }
th { background: #eee; }
table p { text-indent: 0; margin: 0; }
.front { text-align: center; }
.copyright { font-size: 0.9em; line-height: 1.6; }
.dedication { font-style: italic; text-align: center; margin-top: 6em; }
.end { text-align: center; margin-top: 3em; letter-spacing: 0.2em; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin: 0.4em 0; }
`.trim();
}

function xhtmlDoc(title: string, lang: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${esc(lang)}">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${body}
</body>
</html>`;
}

type Section = { id: string; file: string; label: string; nav: boolean };

export async function renderEpub(m: Manuscript, s: PublishSettings): Promise<Buffer> {
  const zip = new JSZip();
  const lang = s.language || "en";
  const title = s.title || m.title;
  const author = s.author || m.author || "Unknown";

  // 1. mimetype (must be first & stored uncompressed)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. container
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS")!;
  oebps.file("style.css", stylesheet(s));

  const sections: Section[] = [];

  // Title page — always included on exports.
  {
    const body = `<div class="front">
  <h1 class="book-title">${esc(title)}</h1>
  ${s.subtitle ? `<h1 class="subtitle">${esc(s.subtitle)}</h1>` : ""}
  <p class="byline">${esc(author)}</p>
</div>`;
    oebps.file("title.xhtml", xhtmlDoc(title, lang, body));
    sections.push({ id: "title", file: "title.xhtml", label: "Title Page", nav: false });
  }

  // Copyright page
  if (s.copyrightPage) {
    const year = s.copyrightYear || String(new Date().getFullYear());
    const lines = [
      `${esc(title)}`,
      `Copyright © ${esc(year)} ${esc(author)}`,
      s.rights ? esc(s.rights) : "",
      s.publisher ? esc(s.publisher) : "",
      s.isbn ? `ISBN: ${esc(s.isbn)}` : "",
    ].filter(Boolean);
    const body = `<div class="copyright"><p style="text-indent:0">${lines.join("<br/>")}</p></div>`;
    oebps.file("copyright.xhtml", xhtmlDoc("Copyright", lang, body));
    sections.push({ id: "copyright", file: "copyright.xhtml", label: "Copyright", nav: false });
  }

  // Dedication
  if (s.dedication && s.dedication.trim()) {
    const body = `<p class="dedication">${esc(s.dedication.trim())}</p>`;
    oebps.file("dedication.xhtml", xhtmlDoc("Dedication", lang, body));
    sections.push({ id: "dedication", file: "dedication.xhtml", label: "Dedication", nav: false });
  }

  // Chapters
  m.chapters.forEach((ch, ci) => {
    const heading = chapterHeading(s.chapterHeadingStyle, ci, ch.title);
    const parts: string[] = [`<h2 class="chapter-title">${esc(heading)}</h2>`];
    ch.scenes.forEach((scene, si) => {
      if (si > 0) parts.push(`<p class="scene-break">${esc(s.sceneBreak)}</p>`);
      if (scene.html) {
        // Rich content (lists, images, tables, colors) preserved in the ebook.
        parts.push(scene.html);
      } else {
        scene.paragraphs.forEach((p, pi) => {
          const cls = pi === 0 ? ' class="first"' : "";
          parts.push(`<p${cls}>${esc(p)}</p>`);
        });
      }
    });
    const file = `chapter-${ci + 1}.xhtml`;
    oebps.file(file, xhtmlDoc(heading, lang, parts.join("\n")));
    sections.push({ id: `chapter-${ci + 1}`, file, label: heading, nav: true });
  });

  // The End
  if (s.theEnd) {
    oebps.file("end.xhtml", xhtmlDoc("The End", lang, `<p class="end">The End</p>`));
    sections.push({ id: "end", file: "end.xhtml", label: "The End", nav: false });
  }

  // nav.xhtml (EPUB3)
  const navItems = sections
    .filter((sec) => sec.nav)
    .map((sec) => `      <li><a href="${sec.file}">${esc(sec.label)}</a></li>`)
    .join("\n");
  const navBody = `<nav epub:type="toc" id="toc">
  <h1>Contents</h1>
  <ol>
${navItems}
  </ol>
</nav>`;
  oebps.file("nav.xhtml", xhtmlDoc("Contents", lang, navBody));

  // toc.ncx (EPUB2 compatibility)
  const bookId = uuid();
  const navPoints = sections
    .filter((sec) => sec.nav)
    .map(
      (sec, i) => `    <navPoint id="nav-${i}" playOrder="${i + 1}">
      <navLabel><text>${esc(sec.label)}</text></navLabel>
      <content src="${sec.file}"/>
    </navPoint>`,
    )
    .join("\n");
  oebps.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
  </head>
  <docTitle><text>${esc(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`,
  );

  // content.opf
  const manifestItems = sections
    .map((sec) => `    <item id="${sec.id}" href="${sec.file}" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = sections.map((sec) => `    <itemref idref="${sec.id}"/>`).join("\n");
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const identifier = s.isbn ? `urn:isbn:${esc(s.isbn)}` : bookId;
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${esc(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${identifier}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:creator>${esc(author)}</dc:creator>
    <dc:language>${esc(lang)}</dc:language>
    ${s.publisher ? `<dc:publisher>${esc(s.publisher)}</dc:publisher>` : ""}
    ${s.description ? `<dc:description>${esc(s.description)}</dc:description>` : ""}
    ${s.copyrightYear ? `<dc:date>${esc(s.copyrightYear)}-01-01</dc:date>` : ""}
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
}
