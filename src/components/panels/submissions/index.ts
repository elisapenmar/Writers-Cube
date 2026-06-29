"use client";

// Stream E — Short-story submission tracker (Duotrope-lite). Registers the
// "submissions" group, which short_story's form-config already lists in its
// `tools`. One tab holding the tracker + logline/theme/word-target metadata.

import { registerGroup } from "@/components/panels/registry";
import { SubmissionsPanel } from "@/components/panels/submissions/submissions-panel";

registerGroup({
  id: "submissions",
  label: "Submissions",
  icon: "📮",
  forms: ["short_story"],
  tabs: [{ id: "submissions", label: "Markets", Component: SubmissionsPanel }],
});
