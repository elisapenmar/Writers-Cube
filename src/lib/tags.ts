// All tag kinds that may exist in stored documents (kept for backward
// compatibility — older content may carry "lookup"/"weak" marks).
export const ALL_TAG_KINDS = [
  "lookup",
  "revise",
  "weak",
  "factcheck",
  "placeholder",
] as const;

export type TagKind = (typeof ALL_TAG_KINDS)[number];

// The tags offered in the UI today.
export const TAG_KINDS: TagKind[] = ["factcheck", "revise", "placeholder"];

export const TAG_LABELS: Record<TagKind, string> = {
  lookup: "Look up",
  revise: "Revise",
  weak: "Weak",
  factcheck: "Fact check",
  placeholder: "Placeholder",
};

export const TAG_COLORS: Record<TagKind, { swatch: string; underline: string }> = {
  lookup: { swatch: "#6366f1", underline: "#6366f1" },
  revise: { swatch: "#c2683f", underline: "#c2683f" },
  weak: { swatch: "#dc2626", underline: "#dc2626" },
  factcheck: { swatch: "#5b7f86", underline: "#5b7f86" },
  placeholder: { swatch: "#9a8f86", underline: "#9a8f86" },
};
