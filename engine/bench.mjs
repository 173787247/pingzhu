#!/usr/bin/env node
/**
 * Benchmark harness.
 *
 * Measures the two numbers that decide whether a phonetic IME is usable:
 *
 *   top-1 accuracy  — how often the auto-selected sentence is the intended one
 *   KSPC            — keystrokes per character (lower is faster to type)
 *
 * HOW TO READ THE ACCURACY NUMBER: the test set is sampled from the language
 * model itself, so the model is both the answer key and the decoder. That makes
 * this an *upper bound* and, more usefully, a **regression harness**: it will not
 * tell you "this beats 自然輸入法", but it will tell you immediately when a change
 * to segmentation or scoring makes things worse.
 *
 * A real comparison needs a corpus of actual typed sentences with labelled
 * intents, which does not exist yet. See docs/06-engine-design.md.
 *
 * usage: node bench.mjs [sampleSize] [--seed N]
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { Dictionary, buildSyllableInventory } from "./src/dictionary.ts";
import { InputEngine } from "./src/engine.ts";
import { STANDARD_LAYOUT } from "./src/keyboard.ts";
import { splitReading } from "./src/syllable.ts";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "data", "bopomofo-lm.tsv");

const sampleSize = Number(process.argv[2] ?? 3000);
const seedArg = process.argv.indexOf("--seed");
let seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 20260926;
const initialSeed = seed;

/** deterministic PRNG so runs are comparable */
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// reverse of the keyboard table: component -> key
const componentToKey = new Map();
for (const [key, comps] of STANDARD_LAYOUT.keyToComponents) {
  for (const c of comps) {
    const id = `${c.kind}:${c.index}`;
    if (!componentToKey.has(id)) componentToKey.set(id, key);
  }
}

/**
 * Turn a bopomofo reading into the keystrokes a 大千式 user would press.
 * 一聲 has no key, exactly as on a real keyboard.
 */
function readingToKeys(reading) {
  let out = "";
  for (const syllable of splitReading(reading)) {
    for (const ch of syllable) {
      const kind = /[ˊˇˋ˙]/.test(ch) ? "tone" : null;
      let id = null;
      if (kind === "tone") {
        id = `tone:${"ˊˇˋ˙".indexOf(ch) + 1}`;
      } else {
        const tables = [
          ["consonant", "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ"],
          ["medial", "ㄧㄨㄩ"],
          ["vowel", "ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ"],
        ];
        for (const [k, table] of tables) {
          const idx = table.indexOf(ch);
          if (idx >= 0) { id = `${k}:${idx + 1}`; break; }
        }
      }
      const key = id && componentToKey.get(id);
      if (!key || key === " ") return null; // untypeable reading, skip
      out += key;
    }
  }
  return out;
}

const CJK = /^[\u3400-\u9fff]+$/;

function buildTestSet(limit) {
  const lines = readFileSync(LM, "utf8").split("\n");
  // reservoir sample multi-character words with a pure-CJK spelling
  const picked = [];
  let seen = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const t1 = line.indexOf("\t");
    const t2 = line.indexOf("\t", t1 + 1);
    if (t1 < 0 || t2 < 0) continue;
    const reading = line.slice(0, t1);
    const word = line.slice(t1 + 1, t2);
    const syllables = splitReading(reading);
    if (syllables.length < 2 || syllables.length > 4) continue;
    if (!CJK.test(word) || word.length !== syllables.length) continue;
    seen++;
    if (picked.length < limit) picked.push({ reading, word });
    else {
      const j = Math.floor(rnd() * seen);
      if (j < limit) picked[j] = { reading, word };
    }
  }
  return picked;
}

const dict = Dictionary.load(LM);
const inventory = buildSyllableInventory(LM);
const cases = buildTestSet(sampleSize);

let correct = 0;
let readingCorrect = 0;
let homophoneTies = 0;
let skipped = 0;
let keys = 0;
let chars = 0;
const failures = [];
const engine = new InputEngine(dict, inventory, { layout: "standard" });

const t0 = process.hrtime.bigint();
for (const c of cases) {
  const keystrokes = readingToKeys(c.reading);
  if (!keystrokes) { skipped++; continue; }
  engine.reset();
  for (const ch of keystrokes) engine.press(ch);
  const got = engine.bestSentence;
  keys += keystrokes.length;
  chars += c.word.length;
  if (got === c.word) {
    correct++;
    readingCorrect++;
  } else if (!engine.usedFallback) {
    // The chosen path used only real dictionary entries, so the output is
    // provably read exactly as typed — it just picked a different word with the
    // same reading. No phonetic decoder can separate 遺臣 from 一陳 without
    // context, so this is counted separately from a genuine failure.
    readingCorrect++;
    homophoneTies++;
  } else if (failures.length < 15) {
    failures.push({ reading: c.reading, want: c.word, got });
  }
}
const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

const evaluated = cases.length - skipped;
const accuracy = (correct / evaluated) * 100;
const readingAccuracy = (readingCorrect / evaluated) * 100;

console.log(`benchmark: ${evaluated} sampled readings (${skipped} untypeable, skipped)`);
console.log(`  top-1 accuracy    ${accuracy.toFixed(2)}%   (${correct}/${evaluated})  exact word match`);
console.log(`  reading accuracy  ${readingAccuracy.toFixed(2)}%   (${readingCorrect}/${evaluated})  output reads as typed`);
console.log(`    of which homophone ties: ${homophoneTies}`);
console.log(`  KSPC              ${(keys / chars).toFixed(3)} keys per character`);
console.log(`  decode time       ${(elapsedMs / evaluated * 1000).toFixed(1)} µs per case`);
console.log(`  corpus            ${cases.length} readings, seed ${initialSeed}`);
console.log("\n  The gap between the two numbers is homophones: 遺臣 vs 一陳 cannot be told");
console.log("  apart by any phonetic decoder without context. Raising exact accuracy needs");
console.log("  a bigram/context model, not more dictionary coverage.");
console.log("\n  NOTE: sampled from the language model itself => self-consistency,");
console.log("        an upper bound and a regression guard, not a head-to-head number.\n");
if (failures.length) {
  console.log("  genuine decode failures (output does NOT read as typed):");
  for (const f of failures) {
    console.log(`    ${f.reading}  want ${f.want}  got ${f.got}`);
  }
}
