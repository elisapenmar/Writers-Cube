"use client";

// @ts-expect-error nspell ships no type declarations
import nspell from "nspell";
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
    notify();
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

/** Whether a token should be flagged. Skips short tokens, numbers, and accepted words. */
export function isMisspelled(word: string): boolean {
  if (!speller || !spellEnabled()) return false;
  if (word.length < 2 || !WORD_OK.test(word) || HAS_DIGIT.test(word)) return false;
  const cached = checkCache.get(word);
  if (cached !== undefined) return cached;
  const bad = !speller.correct(word) && !personal.has(word.toLowerCase());
  checkCache.set(word, bad);
  return bad;
}

export function suggestions(word: string): string[] {
  if (!speller) return [];
  return speller.suggest(word).slice(0, 6);
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
