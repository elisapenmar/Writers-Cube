// Amazon KDP print preset. Sensible defaults for a 6x9 paperback interior:
// justified serif body with a first-line indent, chapters starting on a new
// page, and a table of contents. Authors can still adjust any of these in the
// publish studio after applying the preset.

import { registerExportPreset } from "@/lib/export/presets/registry";
import type { PublishSettings } from "@/lib/publish-types";

const settings: Partial<PublishSettings> = {
  trimSize: "6x9",
  bodyFont: "garamond",
  fontSize: 11,
  lineSpacing: "1.5",
  paragraphStyle: "indent",
  justify: true,
  chapterHeadingStyle: "numbered-title",
  chaptersNewPage: true,
  copyrightPage: true,
  tableOfContents: true,
};

registerExportPreset({
  id: "kdp",
  label: "Amazon KDP (6x9 print)",
  description: "Print-ready 6 x 9 interior: justified serif, indented paragraphs, chapters on new pages, with a table of contents.",
  settings,
});
