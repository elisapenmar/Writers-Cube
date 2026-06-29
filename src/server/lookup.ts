"use server";

// Server-action bridge over the offline LanguageLookup. Client code (the poetry
// language sidebar, the look-up context menu) calls these instead of importing
// `@/lib/lookup`, so the Node-only word list never enters the browser bundle.
//
// The underlying impl is synchronous; these wrappers are async only because
// server actions must be.

import { getLookup } from "@/lib/lookup";
import type { Definition, RhymeMatch } from "@/lib/lookup/types";

function clean(word: string): string {
  return word.trim().toLowerCase();
}

export async function lookupDefine(word: string): Promise<Definition[]> {
  return getLookup().define(clean(word));
}

export async function lookupThesaurus(
  word: string,
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const lookup = getLookup();
  const key = clean(word);
  return { synonyms: lookup.synonyms(key), antonyms: lookup.antonyms(key) };
}

export async function lookupRhymes(word: string): Promise<RhymeMatch[]> {
  return getLookup().rhymes(clean(word));
}

export async function lookupSyllables(word: string): Promise<number> {
  return getLookup().syllables(clean(word));
}
