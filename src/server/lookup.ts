"use server";

// Server-Action bridge to the Node-only language service (`src/lib/lookup`).
// The WordNet/CMU datasets load from the filesystem and must never enter a
// browser bundle, so Wave 2's client UI (the right-click "Look up" popover and
// the poetry sidebar) reaches the synchronous `getLanguageLookup()` API through
// these thin actions instead of importing it directly.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageLookup } from "@/lib/lookup";
import type { Definition, RhymeMatch } from "@/lib/lookup/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

function clean(word: string): string {
  return word.trim().toLowerCase();
}

export async function lookupDefine(word: string): Promise<Definition[]> {
  await requireUser();
  const w = clean(word);
  if (!w) return [];
  return getLanguageLookup().define(w);
}

export async function lookupThesaurus(
  word: string,
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  await requireUser();
  const w = clean(word);
  if (!w) return { synonyms: [], antonyms: [] };
  const svc = getLanguageLookup();
  return { synonyms: svc.synonyms(w), antonyms: svc.antonyms(w) };
}

export async function lookupRhymes(word: string): Promise<RhymeMatch[]> {
  await requireUser();
  const w = clean(word);
  if (!w) return [];
  return getLanguageLookup().rhymes(w);
}

export async function lookupSyllables(word: string): Promise<number> {
  await requireUser();
  const w = clean(word);
  if (!w) return 0;
  return getLanguageLookup().syllables(w);
}
