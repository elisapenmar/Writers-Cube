"use client";

// @ts-expect-error nspell ships no type declarations
import nspell from "nspell";
import { doubleMetaphone } from "double-metaphone";
import type { Editor } from "@tiptap/react";
import { listDictionaryWords, addDictionaryWord, removeDictionaryWord } from "@/server/dictionary";

export type SpellHit = {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
};

type Speller = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
  add: (word: string) => void;
};

const LS_KEY = "wc-personal-dictionary";
const WORD_OK = /[A-Za-z]/; // must contain at least one letter
const HAS_DIGIT = /[0-9]/;

let speller: Speller | null = null;
let loading: Promise<void> | null = null;
const personal = new Set<string>(); // lowercased accepted words
const checkCache = new Map<string, boolean>(); // word -> isMisspelled
const listeners = new Set<() => void>();

/** Re-render hook: the editor decoration plugin subscribes so squiggles refresh
 *  when the dictionary finishes loading or a word is added. */
export function onSpellChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  checkCache.clear();
  for (const cb of listeners) cb();
}

function loadLocalPersonal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) for (const w of JSON.parse(raw) as string[]) personal.add(w.toLowerCase());
  } catch {
    /* ignore */
  }
}
function saveLocalPersonal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...personal]));
  } catch {
    /* ignore */
  }
}

// On/off preference (persisted). Lazily read so it's only touched on the client.
const ENABLED_KEY = "wc-spell-enabled";
let enabled: boolean | null = null;
function loadEnabled() {
  if (enabled !== null) return;
  try {
    enabled = localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    enabled = true;
  }
}
export function spellEnabled(): boolean {
  loadEnabled();
  return enabled!;
}
export function setSpellEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  notify();
}

/** Build the checker once (idempotent). Safe to call from any editor mount. */
export function ensureSpeller(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    loadLocalPersonal();
    const res = await fetch("/dict/en");
    if (!res.ok) throw new Error("dictionary fetch failed");
    const { aff, dic } = (await res.json()) as { aff: string; dic: string };
    speller = nspell(aff, dic) as Speller;
    buildSuggestionIndex(dic);
    notify();
    void loadSupplementalWords();
    // Pull the account dictionary (follows the writer across devices). We track
    // accepted words in `personal` (not speller.add) so they can be removed later.
    try {
      const words = await listDictionaryWords();
      let changed = false;
      for (const w of words) {
        const lw = w.toLowerCase();
        if (!personal.has(lw)) {
          personal.add(lw);
          changed = true;
        }
      }
      if (changed) {
        saveLocalPersonal();
        notify();
      }
    } catch {
      /* offline / signed out — the local set still works */
    }
  })();
  return loading;
}

export function spellerReady(): boolean {
  return speller !== null;
}

// The Hunspell en_US dictionary misses many valid derived forms (e.g.
// "pixelated", "pitter", "arrhythmically"). We supplement it with a broad
// (~275k) word list fetched once, plus a tiny hand-list for stragglers the big
// list also lacks. A word is correct if ANY source accepts it.
const supplemental = new Set<string>();
const HAND_WORDS = ["arhythmic", "arhythmically", "arrhythmically"];
for (const w of HAND_WORDS) supplemental.add(w);

async function loadSupplementalWords(): Promise<void> {
  try {
    const res = await fetch("/dict/words");
    if (!res.ok) return;
    const text = await res.text();
    for (const w of text.split("\n")) {
      const lw = w.trim().toLowerCase();
      if (lw) supplemental.add(lw);
    }
    notify(); // re-flag now that coverage improved
  } catch {
    /* offline — nspell + the hand-list still apply */
  }
}

/** Whether a token should be flagged. Skips short tokens, numbers, and accepted words. */
export function isMisspelled(word: string): boolean {
  if (!speller || !spellEnabled()) return false;
  if (word.length < 2 || !WORD_OK.test(word) || HAS_DIGIT.test(word)) return false;
  const cached = checkCache.get(word);
  if (cached !== undefined) return cached;
  const lw = word.toLowerCase();
  const bad =
    !speller.correct(word) && !personal.has(lw) && !supplemental.has(lw);
  checkCache.set(word, bad);
  return bad;
}

// ── Suggestion engine ──────────────────────────────────────────────────────
// nspell's own suggest() is weak on multi-edit garbles (e.g. "arhythmicly"
// returns nothing). We build a clean root-word lexicon + a double-metaphone
// phonetic index from the Hunspell .dic, then combine nspell's affix-aware
// guesses with a bounded edit-distance scan and same-sounding phonetic matches.

const ROOT_RE = /^[a-z][a-z']*$/; // skip the count line, numbers, abbreviations
let lexicon: string[] = [];
let phoneticMap: Map<string, string[]> | null = null;

function scheduleIdle(fn: () => void) {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (typeof ric === "function") ric(fn);
  else setTimeout(fn, 0);
}

/** Parse the .dic into a lexicon (now) and a phonetic map (idle). Cheap enough
 *  that the squiggle pass — which only needs nspell — is never blocked. */
function buildSuggestionIndex(dic: string): void {
  const seen = new Set<string>();
  const out: string[] = [];
  const lines = dic.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const root = lines[i].split("/")[0].trim().toLowerCase();
    if (root.length < 2 || seen.has(root) || !ROOT_RE.test(root)) continue;
    seen.add(root);
    out.push(root);
  }
  lexicon = out;
  scheduleIdle(() => {
    const map = new Map<string, string[]>();
    for (const w of lexicon) {
      for (const code of doubleMetaphone(w)) {
        if (!code) continue;
        const arr = map.get(code);
        if (arr) arr.push(w);
        else map.set(code, [w]);
      }
    }
    phoneticMap = map;
  });
}

/** Optimal String Alignment distance (Levenshtein + adjacent transpositions)
 *  on three rolling rows, with an early-out once a whole row exceeds `max`.
 *  Returns `max + 1` when the words are further apart than `max`. */
function editDistance(a: string, b: string, max: number): number {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prevPrev = new Array(bl + 1).fill(0);
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prevPrev[j - 2] + 1);
      }
      curr[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    const tmp = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[bl] <= max ? prev[bl] : max + 1;
}

/** Echo the original word's capitalization onto a lowercase suggestion. */
function matchCase(original: string, suggestion: string): string {
  if (original.length > 1 && original === original.toUpperCase()) {
    return suggestion.toUpperCase();
  }
  if (original[0] === original[0]?.toUpperCase()) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

export function suggestions(word: string): string[] {
  if (!speller) return [];
  const lower = word.toLowerCase();
  const max = Math.max(2, Math.ceil(lower.length * 0.34));
  const phoneticCap = max + 2; // same-sounding words may sit a touch further off

  const ordered: string[] = [];
  const taken = new Set<string>([lower]);
  const push = (cand: string) => {
    const cl = cand.toLowerCase();
    if (taken.has(cl) || !ROOT_RE.test(cl)) return;
    taken.add(cl);
    ordered.push(matchCase(word, cand));
  };

  // 1. nspell's own guesses lead — they are frequency/REP-aware and usually nail
  //    single-typo errors (and catch inflected forms not in the root lexicon).
  for (const s of speller.suggest(word)) push(s);

  // 2/3. Fill from same-sounding (double-metaphone) words and a bounded
  //    edit-distance scan of the lexicon, ranked by closeness — this is what
  //    rescues multi-edit garbles nspell gives up on (e.g. "arhythmicly").
  if (ordered.length < 6) {
    const scored: { word: string; dist: number }[] = [];
    const seen = new Set<string>();
    const add = (cand: string, cap: number) => {
      const cl = cand.toLowerCase();
      if (taken.has(cl) || seen.has(cl) || !ROOT_RE.test(cl)) return;
      const dist = editDistance(lower, cl, cap);
      if (dist > cap) return;
      seen.add(cl);
      scored.push({ word: cand, dist });
    };
    if (phoneticMap) {
      for (const code of doubleMetaphone(lower)) {
        const arr = code ? phoneticMap.get(code) : undefined;
        if (arr) for (const w of arr) add(w, phoneticCap);
      }
    }
    for (const w of lexicon) {
      if (Math.abs(w.length - lower.length) > max) continue;
      add(w, max);
    }
    scored.sort(
      (a, b) =>
        a.dist - b.dist ||
        Math.abs(a.word.length - lower.length) -
          Math.abs(b.word.length - lower.length) ||
        a.word.localeCompare(b.word),
    );
    for (const c of scored) {
      if (ordered.length >= 6) break;
      push(c.word);
    }
  }

  return ordered.slice(0, 6);
}

/** If `pos` falls inside a misspelled word, return its range, the word, and
 *  suggested corrections — for the right-click menu. Otherwise null. */
export function lookupMisspelling(editor: Editor, pos: number): SpellHit | null {
  if (!speller || !spellEnabled()) return null;
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;
  const text = parent.textContent;
  const offset = $pos.parentOffset;
  const isWordChar = (c: string) => /[A-Za-z']/.test(c);
  let s = offset;
  let e = offset;
  while (s > 0 && isWordChar(text[s - 1])) s--;
  while (e < text.length && isWordChar(text[e])) e++;
  const raw = text.slice(s, e);
  const word = raw.replace(/^'+|'+$/g, "");
  if (!word || !isMisspelled(word)) return null;
  const start = $pos.start();
  return {
    from: start + s,
    to: start + e,
    word,
    suggestions: suggestions(word),
  };
}

/** Accept a word: in-memory, on this device, and (best effort) on the account. */
export async function acceptWord(word: string): Promise<void> {
  personal.add(word.toLowerCase());
  saveLocalPersonal();
  notify();
  try {
    await addDictionaryWord(word);
  } catch {
    /* stays local if the save fails */
  }
}

/** The writer's accepted words, for the review/remove UI. */
export function personalWords(): string[] {
  return [...personal].sort();
}

/** Un-accept a word: it will be flagged again. */
export async function removeWord(word: string): Promise<void> {
  personal.delete(word.toLowerCase());
  saveLocalPersonal();
  notify();
  try {
    await removeDictionaryWord(word);
  } catch {
    /* stays removed locally if the save fails */
  }
}
