#!/usr/bin/env node
/**
 * Reachability against the upstream source, not against our own build.
 *
 * `reach-audit.mjs` asks whether the build dropped anything the vendor data
 * had. This asks the prior question: does the shipped data cover what
 * McBopomofo's own mapping table can express?
 *
 * `research/data/BPMFMappings.txt` (145,603 lines, MIT) is that table: every
 * line is `word ㄅㄧˇ ㄧㄣ ㄉㄧㄢˇ [weight]`, so it names exactly the words and
 * readings the project inherited from. A word in that table with no reachable
 * candidate in the shipped language model is a word the engine can never offer,
 * whatever the user types.
 *
 * Method: normalise each line to (word, toneless syllables), then ask the real
 * engine whether the word comes back from those keystrokes. Tone marks are the
 * uncertainty here — McBopomofo writes a first-tone syllable bare, and the data
 * layer writes it the same way — so a match on the toneless form is reported
 * separately from an exact-tone match rather than conflated.
 *
 * Prints counts and a bounded sample only.
 *
 * usage: node reach-vs-source.mjs [--sample N]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadDictionary, loadSyllableInventory } from "../../engine/src/node-data.ts";
import { InputEngine, CANDIDATE_CAP } from "../../engine/src/engine.ts";
import { readingToKeys } from "../../engine/bench-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const SAMPLE = argOf("--sample", 12);

const LM = join(root, "data", "bopomofo-lm.tsv");
const MAPPINGS = join(root, "research", "data", "BPMFMappings.txt");

const TONE = /[ˊˇˋ˙]/g;
const isSyllable = (t) => /^[ㄅ-ㄩ]+[ˊˇˋ˙]?$/.test(t);

/** word -> Set of readings, both exactly as written and with tones stripped */
const source = new Map();
let lines = 0, unparsed = 0;
for (const raw of readFileSync(MAPPINGS, "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  lines++;
  const parts = line.split(/\s+/);
  const word = parts[0];
  const syls = parts.slice(1).filter(isSyllable);
  if (!word || !syls.length) { unparsed++; continue; }
  const exact = syls.join("-");
  const toneless = syls.map((s) => s.replace(TONE, "")).join("-");
  let set = source.get(word);
  if (!set) { set = new Set(); source.set(word, set); }
  set.add(exact);
  set.add(toneless);
}
console.log(`mapping lines                    ${lines}   (unparsed ${unparsed})`);
console.log(`distinct words in the mapping    ${source.size}`);

const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);
const engine = new InputEngine(dict, inventory, { layout: "standard" });

/** the reading is reachable if its reading is a key the dictionary knows */
function reach(reading, word) {
  const keys = readingToKeys(reading);
  if (!keys) return "nokeys";
  engine.reset();
  for (const ch of keys) engine.press(ch);
  const n = engine.currentSegmentation?.syllables?.length ?? 0;
  for (let i = 0; i < n; i++) {
    if (engine.candidatesAt(i, CANDIDATE_CAP).some((e) => e.word === word)) return "ok";
  }
  return "miss";
}

/**
 * Two questions, and the difference between them is the finding:
 *
 *   inLm      — the word is a row in the shipped file (models knows it)
 *   reachable — pressing its own keys offers it (the user can type it)
 */
const lmWords = new Set();
for (const line of readFileSync(LM, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const t1 = line.indexOf("\t"), t2 = line.indexOf("\t", t1 + 1);
  if (t1 > 0 && t2 > t1) lmWords.add(line.slice(t1 + 1, t2));
}

let inLm = 0, abs = [], tried = 0, nokeys = 0;
const keyCache = new Map();
for (const [word, readings] of source) {
  if (lmWords.has(word)) { inLm++; continue; }
  abs.push(word);
}
console.log(`words in the mapping absent from the LM file   ${abs.length}`);

// For the absent ones, is the character reachable under ANY of its readings?
let reachableByAny = 0;
const samples = [];
const checked = [];
for (const word of abs) {
  tried++;
  const readings = [...source.get(word)];
  let ok = false;
  for (const r of readings) {
    const k = keyCache.get(r) ?? readingToKeys(r);
    keyCache.set(r, k);
    if (!k) continue;
    const v = reach(r, word);
    if (v === "ok") { ok = true; break; }
  }
  if (ok) reachableByAny++;
  else if (samples.length < SAMPLE) samples.push({ word, readings: readings.slice(0, 3), len: word.length });
  checked.push({ word, ok });
}
console.log(`  reachable under some other reading            ${reachableByAny}`);
console.log(`  UNREACHABLE under every reading of the source ${abs.length - reachableByAny}`);
console.log();
console.log(`sample of unreachable words (word, source readings)`);
for (const s of samples) console.log(`  ${s.word}  (${s.len} char)  ${s.readings.join("  ")}`);

// how many are single characters? that is the acceptance criterion's unit
const single = checked.filter((x) => x.word.length === 1 && !x.ok).length;
console.log(`\n  of the unreachable, single characters         ${single}`);
