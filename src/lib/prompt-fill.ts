// Slot-filling for prompts. Splits {{slots}} into highlightable segments.

import type { PromptObject } from "@/lib/prompt-library";

export type Segment = { t: string; injected: boolean };

export type EntityBag = {
  characters: string[];
  places: string[];
  threads: string[];
  objects: string[];
};

export type RenderedPrompt = {
  id: string;
  focus: PromptObject["focus"];
  format: PromptObject["format"];
  depth: PromptObject["depth"];
  source?: string;
  grounded: boolean;
  textSegments: Segment[];
  questionSegments?: Segment[];
  constraint?: string;
  deeperSegments: Segment[];
};

// Invention pools for "new" mode (AI-free, fast, replayable).
const INVENT: EntityBag = {
  characters: [
    "Mira Vance", "Sean", "Maria", "Orsen", "Cole Ferris", "Della", "Tomas",
    "the lighthouse keeper", "Nadia", "August Reyes", "Pell", "Inés",
    "the new tenant", "Dr. Okonkwo", "Wren", "Salim", "the understudy",
  ],
  places: [
    "the harbor at Thales", "a late-night laundromat", "the back booth of a diner",
    "an emptying train platform", "her sister's kitchen", "a stalled elevator",
    "the parking lot behind the church", "a hospital waiting room",
    "the rooftop of the old mill", "a roadside motel at 3 a.m.",
  ],
  threads: [
    "the money that went missing", "the promise neither of them kept",
    "what happened the summer before", "the letter that was never sent",
    "the version of events they agreed to tell", "who was driving that night",
  ],
  objects: [
    "a brass locket", "a chipped coffee mug", "a folded map", "a single house key",
    "a photograph with one face cut out", "a cracked phone screen", "an unsigned card",
  ],
};

function pickDistinct<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function chooseValues(bag: EntityBag): Record<string, string> {
  const [c1, c2] = pickDistinct(bag.characters.length ? bag.characters : INVENT.characters, 2);
  return {
    character: c1 ?? "your protagonist",
    character2: c2 ?? "someone they trust",
    place: pickDistinct(bag.places.length ? bag.places : INVENT.places, 1)[0] ?? "a place that matters to them",
    thread: pickDistinct(bag.threads.length ? bag.threads : INVENT.threads, 1)[0] ?? "the thing they won't talk about",
    object: pickDistinct(bag.objects.length ? bag.objects : INVENT.objects, 1)[0] ?? "an object that carries weight",
  };
}

const SLOT_RE = /\{\{(character2|character|place|thread|object)\}\}/g;

function toSegments(
  template: string,
  values: Record<string, string>,
  grounded: boolean,
): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SLOT_RE.lastIndex = 0;
  while ((m = SLOT_RE.exec(template))) {
    if (m.index > last) {
      segments.push({ t: template.slice(last, m.index), injected: false });
    }
    const slot = m[1];
    const value = values[slot] ?? `{{${slot}}}`;
    // "injected" (from-draft) highlight only applies in grounded mode.
    segments.push({ t: value, injected: grounded });
    last = m.index + m[0].length;
  }
  if (last < template.length) {
    segments.push({ t: template.slice(last), injected: false });
  }
  return segments;
}

/**
 * Render a prompt object into highlightable segments.
 * grounded=true → slot values come from the user's draft (amber highlight).
 * grounded=false → slot values are invented (no highlight).
 */
export function renderPrompt(
  prompt: PromptObject,
  bag: EntityBag,
  grounded: boolean,
): RenderedPrompt {
  const values = chooseValues(grounded ? bag : INVENT);
  return {
    id: prompt.id,
    focus: prompt.focus,
    format: prompt.format,
    depth: prompt.depth === "any" ? "warmup" : prompt.depth,
    source: prompt.source,
    grounded,
    textSegments: toSegments(prompt.text, values, grounded),
    questionSegments: prompt.question
      ? toSegments(prompt.question, values, grounded)
      : undefined,
    constraint: prompt.constraint,
    deeperSegments: toSegments(prompt.deeper, values, grounded),
  };
}

export function segmentsToPlainText(segs: Segment[] | undefined): string {
  return (segs ?? []).map((s) => s.t).join("");
}
