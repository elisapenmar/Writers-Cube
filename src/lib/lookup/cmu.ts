// Shared lazy loader for the CMU Pronouncing Dictionary. Both the rhyme engine
// and the syllable counter read from the same in-memory map, so we load it once
// and cache it. The dataset is ~135k words; importing this module does nothing
// until the first call actually touches `getCmu()`.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type CmuMap = Record<string, string>;

let cmu: CmuMap | null = null;

/** Lazily load the CMU dictionary (word -> ARPABET phoneme string). */
export function getCmu(): CmuMap {
  if (cmu) return cmu;
  // Required at call time (not import time) so the dataset stays out of the
  // bundle until a language tool is first used.
  const mod = require("cmu-pronouncing-dictionary") as {
    dictionary?: CmuMap;
    default?: CmuMap;
  };
  cmu = mod.dictionary ?? mod.default ?? (mod as unknown as CmuMap);
  return cmu;
}

/** ARPABET phonemes for a word, or null if the word is not in the dictionary. */
export function phonemesFor(word: string): string[] | null {
  const raw = getCmu()[word.toLowerCase()];
  if (!raw) return null;
  return raw.trim().split(/\s+/);
}

/** True for ARPABET vowel phonemes (they all carry a stress digit 0/1/2). */
export function isVowel(phoneme: string): boolean {
  return /\d$/.test(phoneme);
}
