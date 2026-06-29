// LanguageLookup: the shared interface for word-level language tools (dictionary
// definitions, thesaurus synonyms/antonyms, rhymes). Defined in Wave 0 so the UI
// consumers can be built in parallel against the type before the data-backed
// implementation lands:
//   - Stream L  builds the impl (bundled dictionary + thesaurus + CMU rhyme set).
//   - Stream B  builds the global right-click "Look up / Find another word" menu.
//   - Stream C  builds the docked poetry language sidebar.
//
// The impl is offline-first / bundled (no network), so every method is sync.

export type LookupKind = "definition" | "synonym" | "antonym" | "rhyme";

export type Definition = {
  /** Part of speech, e.g. "noun", "verb"; may be empty if unknown. */
  partOfSpeech: string;
  text: string;
};

export type RhymeMatch = {
  word: string;
  /** Perfect rhyme vs. slant/near rhyme. */
  kind: "perfect" | "slant";
};

export interface LanguageLookup {
  /** Dictionary definitions for a word (empty if not found). */
  define(word: string): Definition[];
  /** Thesaurus synonyms (empty if none). */
  synonyms(word: string): string[];
  /** Thesaurus antonyms (empty if none). */
  antonyms(word: string): string[];
  /** Perfect + slant rhymes from the bundled phonetic dataset. */
  rhymes(word: string): RhymeMatch[];
  /** Syllable count for meter/scansion tools (best-effort). */
  syllables(word: string): number;
}
