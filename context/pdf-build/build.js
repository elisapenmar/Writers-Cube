import { marked } from 'marked';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputFilename = process.argv[2] || 'investor-brief.md';
const baseName = inputFilename.replace(/\.md$/, '');
const inputPath = resolve(__dirname, '..', inputFilename);
const outputHtmlPath = resolve(__dirname, `${baseName}.html`);

const docTitles = {
  'investor-brief': "Writer's Cube — Investor Brief",
  'v0.5-scope': "Writer's Cube V0.5 — Scope Document",
};
const docTitle = docTitles[baseName] || baseName;

const md = readFileSync(inputPath, 'utf8');

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
});

const body = marked.parse(md);

const css = `
  :root {
    --maroon: #6B1F2C;
    --maroon-soft: #FBF1F3;
    --maroon-border: #E4C2C8;
    --purple: #5B21B6;
    --purple-soft: #F4F1FB;
    --blue: #1E3A8A;
    --blue-soft: #EEF2FB;
    --ink: #1A1A1A;
    --ink-soft: #555555;
    --rule: #D9D9D9;
    --bg: #FFFFFF;
  }

  @page {
    size: Letter;
    margin: 0.75in 0.7in 0.85in 0.7in;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: "Georgia", "Charter", "Cambria", serif;
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc {
    max-width: 100%;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: "Helvetica Neue", "Inter", "Arial", sans-serif;
    line-height: 1.25;
    font-weight: 700;
    page-break-after: avoid;
    break-after: avoid;
  }

  h1 {
    color: var(--maroon);
    font-size: 26pt;
    margin: 0 0 4pt 0;
    letter-spacing: -0.01em;
    border-bottom: 3px solid var(--maroon);
    padding-bottom: 8pt;
  }

  h1:first-of-type {
    margin-top: 0;
  }

  h2 {
    color: var(--maroon);
    font-size: 16pt;
    margin: 22pt 0 8pt 0;
    border-bottom: 1px solid var(--maroon-border);
    padding-bottom: 4pt;
    page-break-before: auto;
  }

  h3 {
    color: var(--purple);
    font-size: 12.5pt;
    margin: 16pt 0 6pt 0;
  }

  h4 {
    color: var(--blue);
    font-size: 11pt;
    margin: 12pt 0 4pt 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  p {
    margin: 0 0 8pt 0;
    orphans: 3;
    widows: 3;
  }

  strong {
    color: var(--maroon);
    font-weight: 700;
  }

  em {
    color: var(--ink-soft);
  }

  a {
    color: var(--blue);
    text-decoration: none;
    border-bottom: 1px dotted var(--blue);
  }

  ul, ol {
    margin: 0 0 10pt 0;
    padding-left: 22pt;
  }

  li {
    margin-bottom: 4pt;
  }

  li::marker {
    color: var(--purple);
    font-weight: 700;
  }

  ul li::marker {
    color: var(--maroon);
  }

  code {
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 9.5pt;
    background: var(--purple-soft);
    color: var(--purple);
    padding: 1pt 4pt;
    border-radius: 3px;
  }

  pre {
    background: var(--maroon-soft);
    border-left: 3px solid var(--maroon);
    padding: 8pt 10pt;
    overflow-x: auto;
    font-size: 9pt;
    page-break-inside: avoid;
  }

  pre code {
    background: transparent;
    color: var(--ink);
    padding: 0;
  }

  blockquote {
    border-left: 3px solid var(--purple);
    background: var(--purple-soft);
    margin: 10pt 0;
    padding: 6pt 12pt;
    color: var(--ink);
    font-style: italic;
    page-break-inside: avoid;
  }

  blockquote p:last-child {
    margin-bottom: 0;
  }

  hr {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 18pt 0;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0 14pt 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }

  thead th {
    background: var(--maroon);
    color: #FFFFFF;
    font-family: "Helvetica Neue", "Inter", "Arial", sans-serif;
    font-weight: 600;
    text-align: left;
    padding: 6pt 8pt;
    border: 1px solid var(--maroon);
    font-size: 9pt;
    letter-spacing: 0.01em;
  }

  tbody td {
    padding: 5pt 8pt;
    border: 1px solid var(--rule);
    vertical-align: top;
  }

  tbody tr:nth-child(even) td {
    background: var(--maroon-soft);
  }

  tbody td strong {
    color: var(--purple);
  }

  /* Specific layout: keep section heading with first paragraph */
  h2 + p, h2 + ul, h2 + ol, h2 + table {
    page-break-before: avoid;
  }
  h3 + p, h3 + ul, h3 + ol, h3 + table {
    page-break-before: avoid;
  }

  /* Cover-page-ish flourish for the first H1 area */
  .doc > h1:first-child + p,
  .doc > h1:first-child + p + p {
    color: var(--ink-soft);
    font-style: italic;
  }
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${docTitle}</title>
<style>${css}</style>
</head>
<body>
<div class="doc">
${body}
</div>
</body>
</html>`;

writeFileSync(outputHtmlPath, html);
console.log('Wrote', outputHtmlPath);
