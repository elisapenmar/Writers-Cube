// Dictionary definitions, backed by the offline WordNet reader. Kept as its own
// module so consumers (and the singleton) have a clear `define` entry point even
// though WordNet also powers the thesaurus.

import type { Definition } from "./types";
import { define as wordnetDefine } from "./wordnet";

/** Dictionary definitions for a word (empty if not found). */
export function define(word: string): Definition[] {
  return wordnetDefine(word);
}
