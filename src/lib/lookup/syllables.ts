// Syllable counting. Primary source is the CMU pronouncing dictionary, where the
// syllable count equals the number of vowel phonemes (each ARPABET vowel carries
// a stress digit). For words CMU does not list, we fall back to the `syllable`
// package's heuristic so the count is always best-effort rather than zero.

import { createRequire } from "node:module";
import { phonemesFor, isVowel } from "./cmu";

const require = createRequire(import.meta.url);

type SyllableFn = (value: string) => number;

let heuristic: SyllableFn | null = null;

function getHeuristic(): SyllableFn {
  if (heuristic) return heuristic;
  const mod = require("syllable") as { syllable: SyllableFn };
  heuristic = mod.syllable;
  return heuristic;
}

/** Best-effort syllable count for a single word. */
export function countSyllables(word: string): number {
  const trimmed = word.trim();
  if (!trimmed) return 0;

  const phonemes = phonemesFor(trimmed);
  if (phonemes) {
    const vowels = phonemes.filter(isVowel).length;
    if (vowels > 0) return vowels;
  }

  return Math.max(1, getHeuristic()(trimmed));
}
