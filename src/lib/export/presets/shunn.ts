// Shunn manuscript format — the de-facto standard for short-fiction submissions
// (William Shunn's "Proper Manuscript Format"). Editors expect a plain, readable
// page: Times New Roman 12pt, double-spaced, first-line indented paragraphs,
// flush-left (no justification), no drop caps, and a simple centered scene break.
//
// `settings` is a Partial<PublishSettings> (see src/lib/publish-types.ts) layered
// over whatever the writer already configured in the publish studio.

import { registerExportPreset } from "@/lib/export/presets/registry";

registerExportPreset({
  id: "shunn",
  label: "Shunn manuscript",
  description:
    "Standard short-fiction submission format: Times New Roman 12pt, double spaced, first-line indents, flush left.",
  settings: {
    bodyFont: "times",
    fontSize: 12,
    lineSpacing: "double",
    paragraphStyle: "indent",
    justify: false,
    dropCaps: false,
    sceneBreak: "#",
  },
});
