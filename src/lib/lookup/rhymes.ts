// Rhyme engine over the CMU pronouncing dictionary.
//
//   - Perfect rhyme: the tail from the final stressed vowel onward matches
//     exactly (e.g. "light" / "flight" share "AY T"). Stress digits are dropped
//     when comparing so "compose" rhymes with "rose".
//   - Slant / near rhyme: the final vowel nucleus and the trailing consonants
//     match, but the run-up differs (e.g. "light" / "delight" tail consonants
//     line up while a looser key still catches "kite"-style near matches).
//
// Two reverse indexes (perfect-tail -> words, slant-tail -> words) are built once
// on first use from the whole dictionary, then every lookup is a map read.

import type { RhymeMatch } from "./types";
import { getCmu, isVowel } from "./cmu";

/** Drop the trailing stress digit from an ARPABET vowel ("AY1" -> "AY"). */
function bareVowel(phoneme: string): string {
  return phoneme.replace(/\d$/, "");
}

/** Index of the last stressed vowel (primary, else secondary, else last vowel). */
function lastStressedVowelIndex(phonemes: string[]): number {
  let primary = -1;
  let secondary = -1;
  let anyVowel = -1;
  for (let i = 0; i < phonemes.length; i++) {
    const p = phonemes[i];
    if (!isVowel(p)) continue;
    anyVowel = i;
    if (p.endsWith("1")) primary = i;
    else if (p.endsWith("2")) secondary = i;
  }
  if (primary >= 0) return primary;
  if (secondary >= 0) return secondary;
  return anyVowel;
}

/** Perfect-rhyme key: bare phonemes from the final stressed vowel to the end. */
function perfectKey(phonemes: string[]): string | null {
  const start = lastStressedVowelIndex(phonemes);
  if (start < 0) return null;
  return phonemes
    .slice(start)
    .map(bareVowel)
    .join(" ");
}

/** Slant key: final vowel nucleus + every trailing consonant after it. */
function slantKey(phonemes: string[]): string | null {
  let lastVowel = -1;
  for (let i = phonemes.length - 1; i >= 0; i--) {
    if (isVowel(phonemes[i])) {
      lastVowel = i;
      break;
    }
  }
  if (lastVowel < 0) return null;
  const nucleus = bareVowel(phonemes[lastVowel]);
  const coda = phonemes.slice(lastVowel + 1).map(bareVowel);
  return [nucleus, ...coda].join(" ");
}

type Indexes = {
  perfect: Map<string, string[]>;
  slant: Map<string, string[]>;
};

let indexes: Indexes | null = null;

function buildIndexes(): Indexes {
  if (indexes) return indexes;
  const perfect = new Map<string, string[]>();
  const slant = new Map<string, string[]>();
  const cmu = getCmu();

  for (const word in cmu) {
    // Skip CMU's alternate-pronunciation spellings like "read(2)".
    if (word.includes("(")) continue;
    const phonemes = cmu[word].trim().split(/\s+/);

    const pk = perfectKey(phonemes);
    if (pk) {
      const bucket = perfect.get(pk);
      if (bucket) bucket.push(word);
      else perfect.set(pk, [word]);
    }

    const sk = slantKey(phonemes);
    if (sk) {
      const bucket = slant.get(sk);
      if (bucket) bucket.push(word);
      else slant.set(sk, [word]);
    }
  }

  indexes = { perfect, slant };
  return indexes;
}

const MAX_PER_KIND = 50;

/** Perfect + slant rhymes for a word, perfect matches first. */
export function findRhymes(word: string): RhymeMatch[] {
  const lower = word.toLowerCase();
  const cmu = getCmu();
  const raw = cmu[lower];
  if (!raw) return [];
  const phonemes = raw.trim().split(/\s+/);

  const { perfect, slant } = buildIndexes();
  const pk = perfectKey(phonemes);
  const sk = slantKey(phonemes);

  const seen = new Set<string>([lower]);
  const out: RhymeMatch[] = [];

  if (pk) {
    for (const candidate of perfect.get(pk) ?? []) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      out.push({ word: candidate, kind: "perfect" });
      if (out.length >= MAX_PER_KIND) break;
    }
  }

  if (sk) {
    let slantCount = 0;
    for (const candidate of slant.get(sk) ?? []) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      out.push({ word: candidate, kind: "slant" });
      if (++slantCount >= MAX_PER_KIND) break;
    }
  }

  return out;
}
