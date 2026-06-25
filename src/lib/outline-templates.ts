export type OutlineNode = {
  id: string;
  title: string;
  notes?: string;
  // Optional links to a story moment (scene) and characters.
  scene?: { id: string; title: string } | null;
  characters?: { id: string; name: string }[];
  children: OutlineNode[];
};

export type OutlineTemplateKey =
  | "custom"
  | "three-act"
  | "heros-journey"
  | "save-the-cat"
  | "kishotenketsu"
  | "seven-point"
  | "freytags-pyramid";

export type OutlineTemplate = {
  key: OutlineTemplateKey;
  name: string;
  description: string;
  build: () => OutlineNode;
};

let _counter = 0;
function uid(prefix = "n") {
  _counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_counter}`;
}

function leaf(title: string): OutlineNode {
  return { id: uid(), title, children: [] };
}

function group(title: string, children: OutlineNode[]): OutlineNode {
  return { id: uid(), title, children };
}

export const OUTLINE_TEMPLATES: OutlineTemplate[] = [
  {
    key: "custom",
    name: "Blank",
    description: "Start from scratch and build your own structure.",
    build: () => ({ id: uid("root"), title: "My Outline", children: [] }),
  },
  {
    key: "three-act",
    name: "Three-Act Structure",
    description: "Classic Setup → Confrontation → Resolution.",
    build: () => ({
      id: uid("root"),
      title: "Three-Act Structure",
      children: [
        group("Act One — Setup", [
          leaf("Opening image / status quo"),
          leaf("Inciting incident"),
          leaf("Plot point 1 (entry into Act 2)"),
        ]),
        group("Act Two — Confrontation", [
          leaf("Rising action"),
          leaf("Midpoint (false victory or defeat)"),
          leaf("Plot point 2 (entry into Act 3)"),
        ]),
        group("Act Three — Resolution", [
          leaf("Climax"),
          leaf("Falling action"),
          leaf("Resolution / new status quo"),
        ]),
      ],
    }),
  },
  {
    key: "heros-journey",
    name: "Hero's Journey",
    description: "Campbell's twelve-stage mythic arc.",
    build: () => ({
      id: uid("root"),
      title: "Hero's Journey",
      children: [
        group("Departure", [
          leaf("Ordinary world"),
          leaf("Call to adventure"),
          leaf("Refusal of the call"),
          leaf("Meeting the mentor"),
          leaf("Crossing the threshold"),
        ]),
        group("Initiation", [
          leaf("Tests, allies, enemies"),
          leaf("Approach to the inmost cave"),
          leaf("The ordeal"),
          leaf("The reward (seizing the sword)"),
        ]),
        group("Return", [
          leaf("The road back"),
          leaf("Resurrection"),
          leaf("Return with the elixir"),
        ]),
      ],
    }),
  },
  {
    key: "save-the-cat",
    name: "Save the Cat (Blake Snyder)",
    description: "Fifteen-beat screenwriting structure, adapted for novels.",
    build: () => ({
      id: uid("root"),
      title: "Save the Cat — 15 Beats",
      children: [
        group("Act One", [
          leaf("Opening image"),
          leaf("Theme stated"),
          leaf("Setup"),
          leaf("Catalyst"),
          leaf("Debate"),
        ]),
        group("Bridge to Act Two", [
          leaf("Break into two"),
          leaf("B story"),
          leaf("Fun and games"),
          leaf("Midpoint"),
        ]),
        group("Bad Guys Close In", [
          leaf("Bad guys close in"),
          leaf("All is lost"),
          leaf("Dark night of the soul"),
        ]),
        group("Finale", [
          leaf("Break into three"),
          leaf("Finale"),
          leaf("Final image"),
        ]),
      ],
    }),
  },
  {
    key: "kishotenketsu",
    name: "Kishōtenketsu",
    description: "Four-act East Asian structure — no conflict required.",
    build: () => ({
      id: uid("root"),
      title: "Kishōtenketsu",
      children: [
        group("Ki (起) — Introduction", [
          leaf("Establish characters, setting, and circumstances"),
        ]),
        group("Shō (承) — Development", [
          leaf("Expand on what was introduced; no major changes"),
        ]),
        group("Ten (転) — Twist", [
          leaf("Unexpected new element or perspective enters"),
        ]),
        group("Ketsu (結) — Conclusion", [
          leaf("All elements reconcile; new understanding"),
        ]),
      ],
    }),
  },
  {
    key: "seven-point",
    name: "Seven-Point Story Structure",
    description: "Dan Wells's character-arc-driven plot points.",
    build: () => ({
      id: uid("root"),
      title: "Seven-Point Story Structure",
      children: [
        leaf("Hook — protagonist's starting state (the opposite of the resolution)"),
        leaf("Plot turn 1 — inciting incident; the world changes"),
        leaf("Pinch point 1 — pressure applied; antagonist's first show of force"),
        leaf("Midpoint — protagonist shifts from reaction to action"),
        leaf("Pinch point 2 — pressure applied harder; everything seems lost"),
        leaf("Plot turn 2 — protagonist gets the last piece they need"),
        leaf("Resolution — final state; the change is embodied"),
      ],
    }),
  },
  {
    key: "freytags-pyramid",
    name: "Freytag's Pyramid (Five-Act)",
    description: "Classical five-act structure for tragedy and drama.",
    build: () => ({
      id: uid("root"),
      title: "Freytag's Pyramid",
      children: [
        group("Act I — Exposition", [
          leaf("Establish setting, characters, status quo"),
          leaf("Inciting incident closes the act"),
        ]),
        group("Act II — Rising Action", [
          leaf("Complications build; stakes increase"),
        ]),
        group("Act III — Climax", [
          leaf("Turning point — highest tension"),
        ]),
        group("Act IV — Falling Action", [
          leaf("Consequences unfold; momentum reverses"),
        ]),
        group("Act V — Dénouement", [
          leaf("Resolution; new equilibrium established"),
        ]),
      ],
    }),
  },
];

export function getTemplate(key: OutlineTemplateKey): OutlineTemplate {
  return OUTLINE_TEMPLATES.find((t) => t.key === key) ?? OUTLINE_TEMPLATES[0];
}

/** Generate a fresh id (used when user adds nodes) */
export function newNodeId(): string {
  return uid();
}

/** Numbering scheme by depth. Depth 0 = top-level (I, II), 1 = (A, B), 2 = (1,2), 3 = (a, b), 4+ = (i, ii). */
export function numberFor(depth: number, index: number): string {
  const oneBased = index + 1;
  switch (depth) {
    case 0:
      return toRomanUpper(oneBased) + ".";
    case 1:
      return toLatinUpper(index) + ".";
    case 2:
      return String(oneBased) + ".";
    case 3:
      return toLatinLower(index) + ".";
    default:
      return toRomanLower(oneBased) + ".";
  }
}

function toLatinUpper(i: number) {
  return String.fromCharCode("A".charCodeAt(0) + (i % 26));
}
function toLatinLower(i: number) {
  return String.fromCharCode("a".charCodeAt(0) + (i % 26));
}
function toRomanUpper(n: number): string {
  return toRoman(n).toUpperCase();
}
function toRomanLower(n: number): string {
  return toRoman(n).toLowerCase();
}
function toRoman(n: number): string {
  if (n <= 0) return "";
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [val, sym] of map) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}
