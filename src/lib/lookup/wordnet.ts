// Offline WordNet 3.0 reader. The `wordnet` npm package ships Princeton's raw
// database files (index.* + data.*); we parse them directly so every lookup is
// synchronous. One read of each file is cached in memory, and synsets are parsed
// on demand and memoised by offset.
//
// File formats (see WordNet `wndb(5)`):
//   index.<pos>:  lemma pos synset_cnt p_cnt [ptr...] sense_cnt tagsense_cnt offset...
//   data.<pos>:   offset lex_filenum ss_type w_cnt (word lex_id)... p_cnt
//                 (ptr_symbol offset pos src/tgt)... | gloss
//
// We expose three things derived from that: the gloss (definition), the other
// lemmas in a synset (synonyms), and lemmas reachable through the "!" antonym
// pointer (antonyms).

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

export type Pos = "noun" | "verb" | "adj" | "adv";

const POS_TO_PART: Record<Pos, string> = {
  noun: "noun",
  verb: "verb",
  adj: "adjective",
  adv: "adverb",
};

// ss_type letters used inside data files / pointer targets.
const SS_TYPE_TO_POS: Record<string, Pos> = {
  n: "noun",
  v: "verb",
  a: "adj",
  s: "adj", // adjective satellite
  r: "adv",
};

type Synset = {
  pos: Pos;
  /** Lemmas in this synset, underscores turned into spaces. */
  words: string[];
  gloss: string;
  /** Pointers: symbol + target (pos + offset). */
  pointers: { symbol: string; pos: Pos; offset: number }[];
};

let dbDir: string | null = null;

function getDbDir(): string {
  if (dbDir) return dbDir;
  const pkg = require.resolve("wordnet/package.json");
  dbDir = path.join(path.dirname(pkg), "db");
  return dbDir;
}

// Cache whole files (index + data) keyed by filename, parsed lazily.
const fileCache = new Map<string, string>();

function readDbFile(name: string): string {
  const cached = fileCache.get(name);
  if (cached !== undefined) return cached;
  const text = readFileSync(path.join(getDbDir(), name), "utf8");
  fileCache.set(name, text);
  return text;
}

// Index lookup tables, one per POS, built on first use of that POS.
const indexByPos = new Map<Pos, Map<string, number[]>>();

function getIndex(pos: Pos): Map<string, number[]> {
  const cached = indexByPos.get(pos);
  if (cached) return cached;

  const map = new Map<string, number[]>();
  const text = readDbFile(`index.${pos}`);
  for (const line of text.split("\n")) {
    // License header lines start with two spaces; data lines start with a lemma.
    if (!line || line.startsWith("  ")) continue;
    const parts = line.split(" ");
    const lemma = parts[0];
    const synsetCnt = Number(parts[2]);
    const ptrCnt = Number(parts[3]);
    // offsets are the last `synsetCnt` tokens on the line.
    const offsets = parts
      .slice(4 + ptrCnt + 2)
      .slice(0, synsetCnt)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    if (offsets.length) map.set(lemma, offsets);
  }
  indexByPos.set(pos, map);
  return map;
}

// data.<pos> line offsets, so a synset can be found by byte/offset prefix.
const synsetCache = new Map<string, Synset>();

function parseSynset(pos: Pos, offset: number): Synset | null {
  const key = `${pos}:${offset}`;
  const cached = synsetCache.get(key);
  if (cached) return cached;

  const padded = String(offset).padStart(8, "0");
  const text = readDbFile(`data.${pos}`);
  const idx = text.indexOf(`\n${padded} `);
  if (idx < 0) return null;
  const end = text.indexOf("\n", idx + 1);
  const line = text.slice(idx + 1, end < 0 ? undefined : end);

  const pipe = line.indexOf("|");
  const gloss = pipe >= 0 ? line.slice(pipe + 1).trim() : "";
  const head = (pipe >= 0 ? line.slice(0, pipe) : line).trim().split(/\s+/);

  // head: offset lex_filenum ss_type w_cnt (word lex_id)... p_cnt (ptr...)
  let i = 3;
  const wCnt = parseInt(head[i++], 16);
  const words: string[] = [];
  for (let w = 0; w < wCnt; w++) {
    words.push(head[i].replace(/_/g, " "));
    i += 2; // skip the lex_id that follows each word
  }

  const pCnt = Number(head[i++]);
  const pointers: Synset["pointers"] = [];
  for (let p = 0; p < pCnt; p++) {
    const symbol = head[i];
    const targetOffset = Number(head[i + 1]);
    const targetPos = SS_TYPE_TO_POS[head[i + 2]] ?? pos;
    pointers.push({ symbol, pos: targetPos, offset: targetOffset });
    i += 4; // symbol, offset, pos, source/target
  }

  const synset: Synset = { pos, words, gloss, pointers };
  synsetCache.set(key, synset);
  return synset;
}

const ALL_POS: Pos[] = ["noun", "verb", "adj", "adv"];

function synsetsFor(word: string): Synset[] {
  const lemma = word.toLowerCase().replace(/\s+/g, "_");
  const result: Synset[] = [];
  for (const pos of ALL_POS) {
    const offsets = getIndex(pos).get(lemma);
    if (!offsets) continue;
    for (const offset of offsets) {
      const s = parseSynset(pos, offset);
      if (s) result.push(s);
    }
  }
  return result;
}

export function partOfSpeechLabel(pos: Pos): string {
  return POS_TO_PART[pos];
}

export function define(word: string): { partOfSpeech: string; text: string }[] {
  const out: { partOfSpeech: string; text: string }[] = [];
  for (const synset of synsetsFor(word)) {
    if (!synset.gloss) continue;
    // Glosses bundle the definition and example sentences after the first ";
    // keep just the definition clause for a clean dictionary entry.
    const definition = synset.gloss.split(";")[0].trim();
    if (definition) {
      out.push({ partOfSpeech: POS_TO_PART[synset.pos], text: definition });
    }
  }
  return out;
}

export function synonyms(word: string): string[] {
  const lower = word.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const synset of synsetsFor(word)) {
    for (const w of synset.words) {
      const key = w.toLowerCase();
      if (key === lower || seen.has(key)) continue;
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}

export function antonyms(word: string): string[] {
  const lower = word.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const synset of synsetsFor(word)) {
    for (const ptr of synset.pointers) {
      if (ptr.symbol !== "!") continue; // "!" is WordNet's antonym pointer
      const target = parseSynset(ptr.pos, ptr.offset);
      if (!target) continue;
      for (const w of target.words) {
        const key = w.toLowerCase();
        if (key === lower || seen.has(key)) continue;
        seen.add(key);
        out.push(w);
      }
    }
  }
  return out;
}
