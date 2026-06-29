"use client";

// Stream D (Wave 1): Research / source manager for the essay form. Registers the
// "research" group (already named in essay's `tools` in form-config.ts) with two
// tabs that share one saved-source list: Sources (manual add + AI gather) and
// Works Cited (MLA / APA / Chicago bibliography). Activated by the one-line
// import in panels/index.ts.

import { registerGroup } from "@/components/panels/registry";
import { ResearchPanel } from "@/components/panels/research/research-panel";

// The registry renders each tab's Component with no props, so wrap the shared
// panel to pin which face it shows.
function SourcesTab() {
  return <ResearchPanel view="sources" />;
}
function WorksCitedTab() {
  return <ResearchPanel view="cited" />;
}

registerGroup({
  id: "research",
  label: "Research",
  icon: "🔎",
  forms: ["essay"],
  tabs: [
    { id: "sources", label: "Sources", Component: SourcesTab },
    { id: "works_cited", label: "Works Cited", Component: WorksCitedTab },
  ],
});
