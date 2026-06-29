// Public entry point for the offline language service.
//
// Wave 2 UI (right-click "Look up", poetry sidebar) calls `getLanguageLookup()`
// and uses the synchronous `LanguageLookup` methods. Every dataset (WordNet for
// definitions/synonyms/antonyms, CMU for rhymes/syllables) loads lazily on first
// use behind this singleton, so importing the module stays cheap and the large
// data files never enter a browser bundle. The service is Node-only and meant to
// run server-side.

import type { LanguageLookup, Definition, RhymeMatch } from "./types";
import { define } from "./dictionary";
import { synonyms, antonyms } from "./thesaurus";
import { findRhymes } from "./rhymes";
import { countSyllables } from "./syllables";

const lookup: LanguageLookup = {
  define(word: string): Definition[] {
    return define(word);
  },
  synonyms(word: string): string[] {
    return synonyms(word);
  },
  antonyms(word: string): string[] {
    return antonyms(word);
  },
  rhymes(word: string): RhymeMatch[] {
    return findRhymes(word);
  },
  syllables(word: string): number {
    return countSyllables(word);
  },
};

/** The shared offline language service (datasets load lazily on first use). */
export function getLanguageLookup(): LanguageLookup {
  return lookup;
}

export type { LanguageLookup, Definition, RhymeMatch } from "./types";
