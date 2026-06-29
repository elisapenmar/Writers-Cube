// Poetic-form templates for the poetry language sidebar's Forms tab. Each entry
// describes a classic form (rhyme scheme + line/syllable constraints) and knows
// how to build a blank scaffold the writer can drop into the editor.
//
// `buildScaffold` returns plain lines (one array entry per verse line, "" for a
// stanza break). The editor turns those into hard-line-broken verse content, so
// the scaffold stays format-agnostic and easy to test.

export type LineConstraint = {
  /** 1-based line numbers this constraint covers, e.g. [1, 3] or a whole range. */
  lines: number[];
  /** Target syllable count for those lines, when the form fixes one. */
  syllables?: number;
  /** Short human note shown beside the constraint. */
  note?: string;
};

export type PoeticForm = {
  id: string;
  name: string;
  description: string;
  /** Rhyme scheme as a readable string, e.g. "ABAB CDCD EFEF GG". */
  rhymeScheme: string;
  /** Per-line syllable/meter constraints, in display order. */
  lineConstraints: LineConstraint[];
  /** Total line count (excluding stanza-break blanks), for the summary line. */
  lineCount: number;
  /** Build the blank scaffold: one entry per line, "" marks a stanza break. */
  buildScaffold: () => string[];
};

/** A line label like "Line 1 (A)" using a rhyme-scheme letter sequence. */
function scaffoldFromScheme(scheme: string): string[] {
  const lines: string[] = [];
  for (const ch of scheme) {
    if (ch === " ") {
      lines.push(""); // stanza break
    } else {
      lines.push(`(${ch}) `);
    }
  }
  return lines;
}

export const POETIC_FORMS: PoeticForm[] = [
  {
    id: "sonnet",
    name: "Sonnet (Shakespearean)",
    description:
      "Fourteen lines of iambic pentameter: three quatrains and a closing couplet.",
    rhymeScheme: "ABAB CDCD EFEF GG",
    lineCount: 14,
    lineConstraints: [
      { lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], syllables: 10, note: "Iambic pentameter (about 10 syllables)." },
    ],
    buildScaffold: () => scaffoldFromScheme("ABAB CDCD EFEF GG"),
  },
  {
    id: "haiku",
    name: "Haiku",
    description: "A three-line nature image with a 5-7-5 syllable pattern.",
    rhymeScheme: "Unrhymed",
    lineCount: 3,
    lineConstraints: [
      { lines: [1], syllables: 5 },
      { lines: [2], syllables: 7 },
      { lines: [3], syllables: 5 },
    ],
    buildScaffold: () => ["", "", ""],
  },
  {
    id: "villanelle",
    name: "Villanelle",
    description:
      "Nineteen lines: five tercets and a quatrain, built on two refrains that repeat.",
    rhymeScheme: "ABA (refrains A1 and A2 alternate), closing ABAA",
    lineCount: 19,
    lineConstraints: [
      { lines: [1], note: "Refrain A1 repeats as lines 6, 12, 18." },
      { lines: [3], note: "Refrain A2 repeats as lines 9, 15, 19." },
    ],
    buildScaffold: () => {
      const a1 = "(A1) ";
      const a2 = "(A2) ";
      const b = "(b) ";
      const a = "(a) ";
      return [
        a1, b, a2, "",
        a, b, a1, "",
        a, b, a2, "",
        a, b, a1, "",
        a, b, a2, "",
        a, b, a1, a2,
      ];
    },
  },
  {
    id: "sestina",
    name: "Sestina",
    description:
      "Six sestets plus a three-line envoi, cycling the same six end-words in a fixed order.",
    rhymeScheme: "Six repeating end-words (123456 615243 364125 532614 451362 246531), envoi 2-5 / 4-3 / 6-1",
    lineCount: 39,
    lineConstraints: [
      { lines: [1, 2, 3, 4, 5, 6], note: "Choose six end-words here; they recur in every stanza." },
    ],
    buildScaffold: () => {
      const order = [
        [1, 2, 3, 4, 5, 6],
        [6, 1, 5, 2, 4, 3],
        [3, 6, 4, 1, 2, 5],
        [5, 3, 2, 6, 1, 4],
        [4, 5, 1, 3, 6, 2],
        [2, 4, 6, 5, 3, 1],
      ];
      const lines: string[] = [];
      for (const stanza of order) {
        for (const word of stanza) lines.push(`(end-word ${word}) `);
        lines.push("");
      }
      // Envoi: three lines, two end-words each.
      lines.push("(end-words 2, 5) ");
      lines.push("(end-words 4, 3) ");
      lines.push("(end-words 6, 1) ");
      return lines;
    },
  },
  {
    id: "limerick",
    name: "Limerick",
    description: "A five-line comic verse with a bouncing AABBA rhyme.",
    rhymeScheme: "AABBA",
    lineCount: 5,
    lineConstraints: [
      { lines: [1, 2, 5], syllables: 8, note: "Longer lines (about 8-9 syllables)." },
      { lines: [3, 4], syllables: 5, note: "Shorter lines (about 5-6 syllables)." },
    ],
    buildScaffold: () => ["(A) ", "(A) ", "(B) ", "(B) ", "(A) "],
  },
];

export function poeticFormById(id: string): PoeticForm | undefined {
  return POETIC_FORMS.find((f) => f.id === id);
}
