// A small curated seed for definitions + thesaurus, so the poetry language
// sidebar returns real results before Stream L lands the full bundled dataset.
// Keep entries lowercase. Stream L replaces this whole module with the complete
// dictionary/thesaurus behind the same shape; nothing else needs to change.

import type { Definition } from "./types";

export const DEFINITIONS: Record<string, Definition[]> = {
  light: [
    { partOfSpeech: "noun", text: "The natural agent that makes things visible." },
    { partOfSpeech: "adjective", text: "Of little weight; not heavy." },
    { partOfSpeech: "verb", text: "To set burning; to ignite." },
  ],
  night: [
    { partOfSpeech: "noun", text: "The period of darkness between sunset and sunrise." },
  ],
  love: [
    { partOfSpeech: "noun", text: "An intense feeling of deep affection." },
    { partOfSpeech: "verb", text: "To feel deep affection for someone or something." },
  ],
  heart: [
    { partOfSpeech: "noun", text: "The organ that pumps blood; the seat of feeling." },
  ],
  sea: [
    { partOfSpeech: "noun", text: "The expanse of salt water that covers most of the earth." },
  ],
  moon: [
    { partOfSpeech: "noun", text: "The natural satellite of the earth, visible at night." },
  ],
  silence: [
    { partOfSpeech: "noun", text: "Complete absence of sound." },
  ],
  shadow: [
    { partOfSpeech: "noun", text: "A dark area cast by an object blocking light." },
    { partOfSpeech: "verb", text: "To follow closely and watch in secret." },
  ],
  bright: [
    { partOfSpeech: "adjective", text: "Giving out or reflecting much light; vivid." },
  ],
  dream: [
    { partOfSpeech: "noun", text: "A series of images and feelings during sleep." },
    { partOfSpeech: "verb", text: "To imagine or hope for something." },
  ],
};

export const SYNONYMS: Record<string, string[]> = {
  light: ["glow", "radiance", "luminance", "brightness", "gleam"],
  bright: ["radiant", "vivid", "luminous", "brilliant", "dazzling"],
  love: ["affection", "devotion", "adoration", "fondness", "tenderness"],
  silence: ["quiet", "stillness", "hush", "calm"],
  shadow: ["shade", "darkness", "silhouette", "gloom"],
  dream: ["vision", "reverie", "fantasy", "aspiration"],
  sea: ["ocean", "deep", "brine", "waters"],
  night: ["nighttime", "dark", "evening", "dusk"],
  heart: ["core", "soul", "centre", "spirit"],
};

export const ANTONYMS: Record<string, string[]> = {
  light: ["dark", "darkness", "shadow"],
  bright: ["dim", "dull", "dark"],
  love: ["hate", "loathing", "indifference"],
  silence: ["noise", "din", "clamor"],
  night: ["day", "daytime", "morning"],
  dream: ["reality", "wakefulness"],
};
