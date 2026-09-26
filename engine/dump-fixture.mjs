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
import { Dictionary, buildSyllableInventory } from "./src/dictionary.ts";
import { InputEngine } from "./src/engine.ts";
import { buildTestSet, readingToKeys } from "./bench-lib.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LM = join(here, "..", "data", "bopomofo-lm.tsv");

const sampleSize = Number(process.argv[2] ?? 1500);

const dict = Dictionary.load(LM);
const inventory = buildSyllableInventory(LM);

/** Keystrokes that exercise the interesting paths, not just the happy one. */
const HAND_PICKED = [
  "su3cl3", "ji394su3", "w96j0", "rupwu0", "g4", "5j4", "au04",
  "u6tp6",            // 遺臣 vs 一陳, the promotion case
  "tj4g/",            // 畜生 / 畜牲 homophone pair
  "jptjp6",           // ㄨㄣ-ㄔㄨㄣˊ: component reordering must be refused
  "j0420",            // ㄨㄢˋ-ㄉㄢ: a tone key must not migrate
  "2k7", "72k",       // 的, neutral tone in both orders
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
