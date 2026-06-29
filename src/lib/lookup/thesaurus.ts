// Thesaurus (synonyms + antonyms), backed by the offline WordNet reader.
// Synonyms come from the other lemmas in a word's synsets; antonyms follow
// WordNet's "!" antonym pointer.

import { synonyms as wordnetSynonyms, antonyms as wordnetAntonyms } from "./wordnet";

/** Thesaurus synonyms (empty if none). */
export function synonyms(word: string): string[] {
  return wordnetSynonyms(word);
}

/** Thesaurus antonyms (empty if none). */
export function antonyms(word: string): string[] {
  return wordnetAntonyms(word);
}
