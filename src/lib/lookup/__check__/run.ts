// Manual smoke check for the offline language service. Run from the repo root:
//
//   npx tsx src/lib/lookup/__check__/run.ts
//
// It exercises every LanguageLookup method on the sample words from the Stream L
// brief and prints the results, then exits non-zero if any came back empty so a
// missing dataset is caught immediately.

import { getLanguageLookup } from "../index";

const lookup = getLanguageLookup();

const define = lookup.define("happy");
const syns = lookup.synonyms("happy");
const ants = lookup.antonyms("happy");
const rhymes = lookup.rhymes("light");
const syllables = lookup.syllables("beautiful");

console.log("define('happy'):");
for (const d of define) {
  console.log(`  [${d.partOfSpeech}] ${d.text}`);
}

console.log("\nsynonyms('happy'):");
console.log(`  ${syns.join(", ")}`);

console.log("\nantonyms('happy'):");
console.log(`  ${ants.join(", ")}`);

console.log("\nrhymes('light'):");
const perfect = rhymes.filter((r) => r.kind === "perfect").map((r) => r.word);
const slant = rhymes.filter((r) => r.kind === "slant").map((r) => r.word);
console.log(`  perfect (${perfect.length}): ${perfect.slice(0, 12).join(", ")}`);
console.log(`  slant   (${slant.length}): ${slant.slice(0, 12).join(", ")}`);

console.log("\nsyllables('beautiful'):");
console.log(`  ${syllables}`);

const failures: string[] = [];
if (define.length === 0) failures.push("define('happy') was empty");
if (syns.length === 0) failures.push("synonyms('happy') was empty");
if (ants.length === 0) failures.push("antonyms('happy') was empty");
if (rhymes.length === 0) failures.push("rhymes('light') was empty");
if (syllables <= 0) failures.push("syllables('beautiful') was not positive");

if (failures.length) {
  console.error("\nCHECK FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("\nAll checks passed.");
