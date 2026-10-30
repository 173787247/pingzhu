#!/usr/bin/env node
/**
 * Dump the TypeScript engine's behaviour as a fixture the Rust port must match.
 *
 * The reference implementation is the specification. Rather than re-deriving what
 * "correct" means in Rust — and quietly disagreeing in the corners — the port is
 * held to the exact output of the code that already has 37 tests and two
 * benchmark harnesses behind it.
 *
 * usage: node dump-fixture.mjs [sampleSize] > ../core-rs/tests/fixture.tsv
 *
 * Columns: keys, composing, sentence, score, usedFallback, pathWords, page1
 * Scores keep six decimals; the Rust side compares with a small tolerance.
 */
import { loadDictionary, loadSyllableInventory } from "./src/node-data.ts";
import { InputEngine } from "./src/engine.ts";
import { LAYOUTS } from "./src/keyboard.ts";
import { buildTestSet, readingToKeys } from "./bench-lib.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "data", "bopomofo-lm.tsv");

const sampleSize = Number(process.argv[2] ?? 1500);

const dict = loadDictionary(LM);
const inventory = loadSyllableInventory(LM);

/** Keystrokes that exercise the interesting paths, not just the happy one. */
const HAND_PICKED = [
  "su3cl3", "ji394su3", "w96j0", "rupwu0", "g4", "5j4", "au04",
  "u6tp6",            // 遺臣 vs 一陳, the promotion case
  "tj4g/",            // 畜生 / 畜牲 homophone pair
  "jptjp6",           // ㄨㄣ-ㄔㄨㄣˊ: component reordering must be refused
  "j0420",            // ㄨㄢˋ-ㄉㄢ: a tone key must not migrate
  "2k7", "72k",       // 的, neutral tone in both orders
  // ㄕㄨ-ㄖㄨˋ (輸入): the two-syllable word must outrank 書, the higher-frequency
  // reading of the first syllable alone. Nothing started with "gj" before, so a
  // port that resolved each syllable independently would have passed regardless.
  "gjbj4", "gj", "gjbj",
  "su3c",             // half-typed syllable stays pending
  "su3", "g", "t", "4", "u", "u.", "",
  "ji394su3w96j0",    // longer buffer
  "vm,6", "ej0", "u6", "cl3", "gk4",
];

const lines = [];
const emit = (keys, options) => {
  const engine = new InputEngine(dict, inventory, { layout: "standard", ...options });
  for (const ch of keys) engine.press(ch);
  const page = engine.candidatePage.entries.map((e) => e.word).join("|");
  const words = engine.chosenPath ? engine.chosenPath.nodes.map((n) => n.entry.word).join("|") : "";
  lines.push([
    keys,
    engine.composing,
    engine.bestSentence,
    engine.bestScore.toFixed(6),
    engine.usedFallback ? "1" : "0",
    words,
    page,
  ].join("\t"));
};

// `--layouts` writes the per-layout fixture instead: every layout that exists,
// over the same handful of readings, with the layout named in the first column.
// The main fixture keeps its positional layout hack (two ETen cases at the end)
// because rewriting 1,500 rows to add a column would churn the one thing that has
// been catching porting mistakes since day one.
const LAYOUT_READINGS = [
  "ㄋㄧˇ ㄏㄠˇ", "ㄨㄛˇ ㄞˋ ㄋㄧˇ", "ㄊㄞˊ ㄨㄢ", "ㄔㄨˋ ㄕㄥ",
  "ㄨㄢˋ ㄉㄢ", "ㄓㄨㄥ", "ㄏㄨㄚ", "ㄌㄧㄢˊ", "ㄒㄧㄝˋ ㄒㄧㄝˋ",
];

/** The key sequence a layout uses for a reading, or null when it cannot type it. */
function keysForReading(layoutId, reading) {
  const table = LAYOUTS[layoutId];
  const at = new Map();
  for (const [key, comps] of table.keyToComponents) {
    for (const c of comps) {
      const id = `${c.kind}:${c.index}`;
      if (!at.has(id)) at.set(id, key);
    }
  }
  const groups = [
    ["consonant", "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ"],
    ["medial", "ㄧㄨㄩ"],
    ["vowel", "ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ"],
  ];
  let out = "";
  for (const syllable of reading.split(" ")) {
    for (const ch of syllable) {
      let id = null;
      if (/[ˊˇˋ˙]/.test(ch)) {
        id = `tone:${"ˊˇˋ˙".indexOf(ch) + 1}`;
      } else {
        for (const [kind, chars] of groups) {
          const i = chars.indexOf(ch);
          if (i >= 0) { id = `${kind}:${i + 1}`; break; }
        }
      }
      if (!id) throw new Error(`cannot read ${ch}`);
      const key = at.get(id);
      if (!key) return null; // this layout has no way to type this reading
      out += key;
    }
  }
  return out;
}

if (process.argv.includes("--symbols")) {
  // The punctuation page has two copies: this one, because the browser demo has no
  // C ABI to ask, and core-rs/src/symbols.rs. This dumps the TypeScript one in the
  // wire format the FFI uses, so a test can hold the Rust one to it.
  const { SYMBOL_ROWS } = await import("./src/symbols.ts");
  process.stdout.write(SYMBOL_ROWS.map((row) => row.join("|")).join("\n") + "\n");
  process.exit(0);
}

if (process.argv.includes("--layouts")) {
  const rows = [];
  const covered = [];
  for (const layout of Object.keys(LAYOUTS)) {
    let typed = 0;
    for (const reading of LAYOUT_READINGS) {
      const keys = keysForReading(layout, reading);
      if (!keys) continue; // the layout cannot spell this one; say so by omission
      const engine = new InputEngine(dict, inventory, { layout });
      for (const ch of keys) engine.press(ch);
      const page = engine.candidatePage.entries.map((e) => e.word).join("|");
      const words = engine.chosenPath ? engine.chosenPath.nodes.map((n) => n.entry.word).join("|") : "";
      rows.push([
        layout, keys, engine.composing, engine.bestSentence,
        engine.bestScore.toFixed(6), engine.usedFallback ? "1" : "0", words, page,
      ].join("\t"));
      typed++;
    }
    covered.push(`${layout}:${typed}`);
  }
  process.stderr.write(`layout fixture: ${rows.length} cases (${covered.join(" ")})\n`);
  process.stdout.write(rows.join("\n") + "\n");
  process.exit(0);
}

for (const keys of HAND_PICKED) emit(keys);

// A broad sweep so the port cannot be right only on the cases I thought of.
const cases = buildTestSet(sampleSize, 20260926);
let sampled = 0;
for (const c of cases) {
  if (!c.keystrokes) continue;
  emit(c.keystrokes);
  sampled++;
}

// The other keyboard layout, to prove the layout table travels too.
for (const keys of ["ne3", "ne3cl3"]) emit(keys, { layout: "eten" });

process.stderr.write(`fixture: ${lines.length} cases (${sampled} sampled readings + ${HAND_PICKED.length} hand-picked)\n`);
process.stdout.write(lines.join("\n") + "\n");
void readingToKeys;
