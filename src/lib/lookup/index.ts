// Offline-first LanguageLookup implementation. Node-only: it pulls in the bundled
// word list (an-array-of-english-words) and the phonetic coder (double-metaphone),
// so it MUST stay out of the browser bundle. Client code reaches it only through
// the `src/server/lookup.ts` server actions.
//
// Scope note: rhymes and syllables are fully data-backed here. Definitions and the
// thesaurus are seeded from a small curated map (`./seed-lexicon`) so the poetry
// language sidebar returns real results today; Stream L swaps that seed for the
// full bundled dictionary/thesaurus behind this same interface without touching
// any caller.

import { doubleMetaphone } from "double-metaphone";
import { syllable } from "syllable";
import WORD_LIST from "an-array-of-english-words";
import { DEFINITIONS, SYNONYMS, ANTONYMS } from "./seed-lexicon";
import type { Definition, LanguageLookup, RhymeMatch } from "./types";

const WORDS: string[] = (WORD_LIST as string[]).filter((w) => /^[a-z]+$/.test(w));

// Phonetic index, built once on first rhyme lookup. Keyed by the word's primary
// double-metaphone code so we can pull rhyme candidates without scanning the
// whole list every time.
let phoneticIndex: Map<string, string[]> | null = null;

function buildPhoneticIndex(): Map<string, string[]> {
  if (phoneticIndex) return phoneticIndex;
  const index = new Map<string, string[]>();
  for (const word of WORDS) {
    const [primary] = doubleMetaphone(word);
    if (!primary) continue;
    const bucket = index.get(primary);
    if (bucket) bucket.push(word);
    else index.set(primary, [word]);
  }
  phoneticIndex = index;
  return index;
}

/** Last N characters of a word's primary phonetic code: the rhyme "tail". */
function rhymeTail(code: string, n: number): string {
  return code.length <= n ? code : code.slice(-n);
}

class OfflineLookup implements LanguageLookup {
  define(word: string): Definition[] {
    const key = word.trim().toLowerCase();
    return DEFINITIONS[key] ?? [];
  }

  synonyms(word: string): string[] {
    return SYNONYMS[word.trim().toLowerCase()] ?? [];
  }

  antonyms(word: string): string[] {
    return ANTONYMS[word.trim().toLowerCase()] ?? [];
  }

  rhymes(word: string): RhymeMatch[] {
    const target = word.trim().toLowerCase();
    if (!/^[a-z]+$/.test(target)) return [];
    const [primary] = doubleMetaphone(target);
    if (!primary) return [];

    const index = buildPhoneticIndex();
    const perfect: string[] = index.get(primary) ?? [];
    const perfectSet = new Set(perfect);

    // Slant rhymes: words whose phonetic tail matches the target's tail but whose
    // full code differs (so they're near, not exact).
    const tail = rhymeTail(primary, 2);
    const slant: string[] = [];
    if (tail.length >= 2) {
      for (const [code, bucket] of index) {
        if (code === primary) continue;
        if (rhymeTail(code, 2) !== tail) continue;
        for (const candidate of bucket) {
          if (!perfectSet.has(candidate)) slant.push(candidate);
        }
      }
    }

    const matches: RhymeMatch[] = [];
    for (const w of perfect) {
      if (w === target) continue;
      matches.push({ word: w, kind: "perfect" });
    }
    for (const w of slant) {
      if (w === target) continue;
      matches.push({ word: w, kind: "slant" });
    }
    return matches;
  }

  syllables(word: string): number {
    const target = word.trim();
    if (!target) return 0;
    return syllable(target);
  }
}

let instance: LanguageLookup | null = null;

/** Shared offline lookup. Server-action callers use this; never import it into a
 *  client component (it carries the Node-only word list). */
export function getLookup(): LanguageLookup {
  if (!instance) instance = new OfflineLookup();
  return instance;
}
