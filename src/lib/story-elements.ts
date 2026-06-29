// Smart Text registry: the set of named story elements (characters, places,
// items) for the active project. Editors read from here to recognize names in
// the prose and to power type-ahead. Populated by <SmartTextLoader> and refreshed
// when the Story Bible changes. Mirrors the module-level pattern of spellcheck.ts
// so the Tiptap extension can stay a pure plugin with no React/store coupling.

export type ElementKind = "character" | "place" | "item";

export type StoryElement = {
  id: string;
  name: string;
  kind: ElementKind;
};

let elements: StoryElement[] = [];
let byLowerName = new Map<string, StoryElement>();
let pattern: RegExp | null = null;
const listeners = new Set<() => void>();

// Names shorter than this are ignored — single letters / two-letter initials
// would light up far too much ordinary prose.
const MIN_NAME_LEN = 2;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace the registry and rebuild the lookup + combined regex, then notify. */
export function setStoryElements(next: StoryElement[]): void {
  const seen = new Set<string>();
  elements = [];
  byLowerName = new Map();
  for (const e of next) {
    const name = (e.name ?? "").trim();
    if (name.length < MIN_NAME_LEN) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // first definition wins on a name clash
    seen.add(key);
    const el = { ...e, name };
    elements.push(el);
    byLowerName.set(key, el);
  }

  // One combined, case-insensitive, word-bounded alternation. Longer names
  // first so "Sarah Connor" wins over "Sarah". \b won't anchor on names that
  // start/end with non-word chars, which is fine for ordinary names.
  const names = elements
    .map((e) => e.name)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe);
  pattern = names.length
    ? new RegExp(`\\b(?:${names.join("|")})\\b`, "gi")
    : null;

  listeners.forEach((fn) => fn());
}

export function getStoryElements(): StoryElement[] {
  return elements;
}

/** Resolve a matched run of text back to its element (case-insensitive). */
export function lookupElement(name: string): StoryElement | undefined {
  return byLowerName.get((name ?? "").trim().toLowerCase());
}

/** Fresh regex instance (own lastIndex) for scanning, or null when empty. */
export function elementMatcher(): RegExp | null {
  return pattern ? new RegExp(pattern.source, pattern.flags) : null;
}

/** Type-ahead: elements whose name begins with the typed prefix. */
export function suggestElements(prefix: string, limit = 6): StoryElement[] {
  const p = (prefix ?? "").trim().toLowerCase();
  if (p.length < MIN_NAME_LEN) return [];
  const out: StoryElement[] = [];
  for (const e of elements) {
    if (e.name.toLowerCase().startsWith(p) && e.name.toLowerCase() !== p) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function onStoryElementsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// The library doesn't import the Zustand store directly (avoids a cycle and keeps
// it usable outside React). The app registers how to open an element.
let openHandler: ((el: StoryElement) => void) | null = null;

export function setElementOpenHandler(fn: (el: StoryElement) => void): void {
  openHandler = fn;
}

export function openStoryElement(el: StoryElement): void {
  openHandler?.(el);
}
