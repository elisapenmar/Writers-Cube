export const TAG_KINDS = [
  "lookup",
  "revise",
  "weak",
  "factcheck",
  "placeholder",
] as const;

export type TagKind = (typeof TAG_KINDS)[number];

export const TAG_LABELS: Record<TagKind, string> = {
  lookup: "Look up",
  revise: "Revise",
  weak: "Weak",
  factcheck: "Fact check",
  placeholder: "Placeholder",
};

export const TAG_COLORS: Record<TagKind, { swatch: string; underline: string }> = {
  lookup: { swatch: "#6366f1", underline: "#6366f1" },
  revise: { swatch: "#ea580c", underline: "#ea580c" },
  weak: { swatch: "#dc2626", underline: "#dc2626" },
  factcheck: { swatch: "#0891b2", underline: "#0891b2" },
  placeholder: { swatch: "#a3a3a3", underline: "#a3a3a3" },
};
