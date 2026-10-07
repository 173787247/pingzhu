#!/usr/bin/env node
/**
 * Reachability audit for the data layer.
 *
 * The project's acceptance criterion has a hard half and a soft half:
 *
 *   hard — the character the user wants must be reachable by pressing keys
 *   soft — where it sits in the candidate list (rank is a cost, not a wall)
 *
 * Two things in the data layer can break the hard half, and neither has been
 * measured:
 *
 *   1. `data/build.mjs` applies `MAX_PER_READING` (default 100) and drops the
 *      rest. For a single-syllable reading that is a deletion, not a ranking:
 *      ㄩˋ alone carries thousands of homophones.
 *   2. `bopomofo-chars.tsv` and `bopomofo-lm.tsv` are separate products of the
 *      same build (WebDataPlain vs WebData). A character present in one and not
 *      the other is a character the engine may never offer.
 *
 * Method: rebuild the uncapped entry set from the same vendor source the build
 * script reads, then ask the real engine — not the model file — whether each
 * word is reachable from its own keystrokes.
 *
 * usage: node reach-audit.mjs [--max N]
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadDictionary, loadSyllableInventory } from "../../engine/src/node-data.ts";
import { InputEngine, CANDIDATE_CAP } from "../../engine/src/engine.ts";
import { readingToKeys } from "../../engine/bench-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const vendorDir = join(root, "data", "vendor");
const LM = join(root, "data", "bopomofo-lm.tsv");
const CHARS = join(root, "data", "bopomofo-chars.tsv");

const argMax = process.argv.indexOf("--max");
const MAX_PER_READING = argMax >= 0 ? Number(process.argv[argMax + 1]) : 100;

// Same tables as data/build.mjs, duplicated so this measures the shipped file
// rather than trusting the builder's own bookkeeping.
const CONSONANTS = ["", "ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ", "ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ",
  "ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"];
const MIDDLES = ["", "ㄧ", "ㄨ", "ㄩ"];
const VOWELS = ["", "ㄚ", "ㄛ", "ㄜ", "ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ"];
const TONES = ["", "ˊ", "ˇ", "ˋ", "˙"];

function decodeSyllable(pair) {
  const order = pair.charCodeAt(0) - 48 + (pair.charCodeAt(1) - 48) * 79;
  return CONSONANTS[order % 22] + MIDDLES[Math.floor(order / 22) % 4]
    + VOWELS[Math.floor(order / 88) % 14] + TONES[Math.floor(order / 1232) % 5];
}

function decodeKey(key) {
  if (key.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < key.length; i += 2) {
    const s = decodeSyllable(key.slice(i, i + 2));
    if (!s) return null;
    out.push(s);
  }
  return out.join("-");
}

// ------------------------------------------------- upstream, without the cap
const src = readFileSync(join(vendorDir, "WebData.ts"), "utf8");
const tmp = join(vendorDir, ".reach-audit.gen.mjs");
writeFileSync(tmp, src);
const { webData } = await import(pathToFileURL(tmp).href);
if (existsSync(tmp)) unlinkSync(tmp);

/** reading -> Map(word -> score): a word is one entry per reading, as the build assumes */
const upstream = new Map();
let upstreamDuplicates = 0;
for (const [key, value] of Object.entries(webData)) {
  if (key.startsWith("_")) continue;
  const reading = decodeKey(key);
  if (!reading) continue;
  const toks = value.split(" ");
  if (toks.length % 2 !== 0) continue;
  let list = upstream.get(reading);
  if (!list) { list = new Map(); upstream.set(reading, list); }
  for (let i = 0; i + 1 < toks.length; i += 2) {
    const word = toks[i];
    const score = Number.parseFloat(toks[i + 1]);
    if (!word || word.startsWith("MACRO@") || !Number.isFinite(score)) continue;
    if (list.has(word)) { upstreamDuplicates++; continue; }
    list.set(word, score);
  }
}

// ------------------------------------------------------ what the build kept
const shipped = new Map(); // "reading\tword" -> score
for (const line of readFileSync(LM, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [reading, word, score] = line.split("\t");
  shipped.set(`${reading}\t${word}`, Number(score));
}

const upstreamUnique = [...upstream.values()].reduce((n, m) => n + m.size, 0);
console.log(`upstream readings        ${upstream.size}`);
console.log(`upstream unique entries  ${upstreamUnique}   (${upstreamDuplicates} duplicate word-in-reading collapsed)`);
console.log(`shipped entries          ${shipped.size}`);

// --------------------------------------------------- everything the build cut
// Not only the cap: any upstream entry the shipped file lacks is a candidate
// for "the model knows it, the engine cannot produce it".
const dropped = [];
let cappedReadings = 0;
for (const [reading, words] of upstream) {
  const sorted = [...words.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > MAX_PER_READING) cappedReadings++;
  sorted.forEach(([word, score], rank) => {
    if (shipped.has(`${reading}\t${word}`)) return;
    dropped.push({ reading, word, score, rank, overCap: rank >= MAX_PER_READING });
  });
}

const overCap = dropped.filter((d) => d.overCap);
const underCap = dropped.filter((d) => !d.overCap);
console.log(`\nabsent from the shipped file          ${dropped.length}`);
console.log(`  · ranked past the cap (>=${MAX_PER_READING})      ${overCap.length}   across ${cappedReadings} readings`);
console.log(`  · ranked inside the cap             ${underCap.length}   <- not explained by the cap`);
console.log(`  · all single-syllable?              ${dropped.every((d) => !d.reading.includes("-")) ? "yes" : "no"}`);

// ----------------------------------------------------------------- engine
const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);
const engine = new InputEngine(dict, inventory, { layout: "standard" });

/**
 * Can the user reach `word` from the keystrokes for `reading`?
 *
 * Searches every cursor position the buffer exposes: a real candidate window
 * lets the user move along the buffer, so reachability is "somewhere in some
 * position", not "at position 0". Returns -1 when the word is in no position.
 */
function reach(reading, word) {
  const keys = readingToKeys(reading);
  if (!keys) return -1;
  engine.reset();
  for (const ch of keys) engine.press(ch);
  const n = engine.currentSegmentation?.syllables?.length ?? 0;
  for (let i = 0; i < n; i++) {
    if (engine.candidatesAt(i, CANDIDATE_CAP).some((e) => e.word === word)) return i;
  }
  return -1;
}

const verdict = (list, label) => {
  let unreachable = 0, noKeys = 0, reachable = 0;
  const examples = [];
  for (const d of list) {
    const idx = reach(d.reading, d.word);
    if (idx === -2) { noKeys++; continue; }
    if (idx < 0) {
      unreachable++;
      if (examples.length < 12) examples.push(d);
    } else reachable++;
  }
  console.log(`\n=== ${label} (${list.length}) ===`);
  console.log(`  reachable    ${reachable}`);
  console.log(`  UNREACHABLE  ${unreachable}`);
  for (const d of examples) console.log(`      ${d.reading} ${d.word}  rank ${d.rank + 1}`);
  return { unreachable, reachable };
};

if (dropped.length) verdict(dropped, "entries the shipped LM does not contain");

// ------------------------------------------- second axis: the character table
// bopomofo-chars.tsv comes from WebDataPlain, the LM from WebData. Both are
// meant to name the same characters; a character in the chars table that the
// LM dropped has no word node to hang on.
const charTable = new Map();
for (const line of readFileSync(CHARS, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [reading, list] = line.split("\t");
  charTable.set(reading, list.split(" "));
}
const lmWords = new Set([...shipped.keys()].map((k) => k.split("\t")[1]));
const charsNotInLm = [];
for (const [reading, chars] of charTable) {
  for (const ch of chars) {
    if (!lmWords.has(ch)) charsNotInLm.push({ reading, word: ch, rank: chars.indexOf(ch) });
  }
}
console.log(`\ncharacters in chars.tsv but nowhere in the LM   ${charsNotInLm.length}`);
if (charsNotInLm.length) verdict(charsNotInLm.slice(0, 3000), "sample of chars-table-only characters");
