// Publication preparation settings — what authors typically adjust before
// exporting a manuscript for submission, print, or ebook.

export type BodyFont =
  | "garamond"
  | "georgia"
  | "times"
  | "baskerville"
  | "palatino"
  | "caslon";

export type LineSpacing = "single" | "1.5" | "double";
export type ParagraphStyle = "indent" | "spaced";
export type ChapterHeadingStyle = "numbered" | "title" | "numbered-title";
export type TrimSize = "5x8" | "5.25x8" | "5.5x8.5" | "6x9";

export type PublishSettings = {
  // ---- Book metadata ----
  title?: string; // overrides project title when set
  subtitle?: string;
  author?: string; // overrides author_name when set
  copyrightYear?: string;
  rights?: string; // e.g. "All rights reserved."
  isbn?: string;
  publisher?: string;
  language?: string; // BCP-47, e.g. "en"
  description?: string;
  dedication?: string;

  // ---- Body & typography ----
  bodyFont: BodyFont;
  fontSize: number; // pt
  lineSpacing: LineSpacing;
  paragraphStyle: ParagraphStyle;
  justify: boolean;

  // ---- Structure ----
  chapterHeadingStyle: ChapterHeadingStyle;
  chaptersNewPage: boolean;
  sceneBreak: string;
  dropCaps: boolean;

  // ---- Front / back matter ----
  // (A title page is always included on export.)
  copyrightPage: boolean;
  tableOfContents: boolean;
  theEnd: boolean;

  // ---- Print ----
  trimSize: TrimSize;
};

export const DEFAULT_PUBLISH_SETTINGS: PublishSettings = {
  language: "en",
  rights: "All rights reserved.",
  bodyFont: "garamond",
  fontSize: 12,
  lineSpacing: "1.5",
  paragraphStyle: "indent",
  justify: true,
  chapterHeadingStyle: "numbered-title",
  chaptersNewPage: true,
  sceneBreak: "* * *",
  dropCaps: false,
  copyrightPage: true,
  tableOfContents: true,
  theEnd: true,
  trimSize: "5.5x8.5",
};

export function withDefaults(s: Partial<PublishSettings> | null | undefined): PublishSettings {
  return { ...DEFAULT_PUBLISH_SETTINGS, ...(s ?? {}) };
}

// CSS font stacks for each body-font choice (also used by DOCX font name).
export const FONT_STACKS: Record<BodyFont, { label: string; css: string; docx: string }> = {
  garamond: { label: "Garamond", css: "'EB Garamond', Garamond, Georgia, serif", docx: "Garamond" },
  georgia: { label: "Georgia", css: "Georgia, 'Times New Roman', serif", docx: "Georgia" },
  times: { label: "Times New Roman", css: "'Times New Roman', Times, serif", docx: "Times New Roman" },
  baskerville: { label: "Baskerville", css: "Baskerville, 'Libre Baskerville', Georgia, serif", docx: "Baskerville" },
  palatino: { label: "Palatino", css: "Palatino, 'Palatino Linotype', Georgia, serif", docx: "Palatino Linotype" },
  caslon: { label: "Caslon", css: "'Adobe Caslon', 'Libre Caslon Text', Georgia, serif", docx: "Caslon" },
};

export const TRIM_SIZES: Record<TrimSize, { label: string; widthIn: number; heightIn: number }> = {
  "5x8": { label: "5 × 8 in", widthIn: 5, heightIn: 8 },
  "5.25x8": { label: "5.25 × 8 in", widthIn: 5.25, heightIn: 8 },
  "5.5x8.5": { label: "5.5 × 8.5 in (trade)", widthIn: 5.5, heightIn: 8.5 },
  "6x9": { label: "6 × 9 in (trade)", widthIn: 6, heightIn: 9 },
};

export const SCENE_BREAK_PRESETS = ["* * *", "❧", "⁂", "◆ ◆ ◆", "～", "•   •   •"];

export const LINE_SPACING_VALUE: Record<LineSpacing, number> = {
  single: 1.15,
  "1.5": 1.5,
  double: 2.0,
};

/** Build the chapter heading string for a given index/title per the chosen style. */
export function chapterHeading(style: ChapterHeadingStyle, index: number, title: string): string {
  const num = index + 1;
  switch (style) {
    case "numbered":
      return `Chapter ${num}`;
    case "title":
      return title;
    case "numbered-title":
    default:
      return title ? `Chapter ${num} — ${title}` : `Chapter ${num}`;
  }
}
