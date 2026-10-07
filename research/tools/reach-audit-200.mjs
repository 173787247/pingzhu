#!/usr/bin/env node
/**
 * The cap decision, audited from the shipped file and evaluated by the engine.
 *
 * cap-scope.mjs measured the old build by re-deriving "what the cap would drop"
 * from the vendor source. That derivation and data/build.mjs disagreed about one
 * thing — where deduplication happens — and the disagreement mattered: the two
 * characters the old build lost inside its own top hundred (㑊 and 㔴) were lost
 * because the cap counted rows. This tool reads the shipped file instead of
 * predicting it, and asks the real engine which characters a user can reach.
 *
 * Pass two models to get a before/after:
 *
 *   node reach-audit-200.mjs data/bopomofo-lm.tsv /tmp/new-lm.tsv
 *
 * Prints counts and distinctions only. No corpus text beyond the words the
 * audit is about, and those are capped by --sample.
 *
 * usage: node reach-audit-200.mjs <lm-a> [lm-b] [--sample N]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { InputEngine, CANDIDATE_CAP } from "../../engine/src/engine.ts";
import { Dictionary } from "../../engine/src/dictionary.ts";
import { loadSyllableInventory } from "../../engine/src/node-data.ts";
import { readingToKeys } from "../../engine/bench-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const SAMPLE = argOf("--sample", 10);

const files = process.argv.slice(2).filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
if (!files.length) files.push(join(root, "data", "bopomofo-lm.tsv"));

const TONE = /[ˊˇˋ˙]/;

/** every reading in the file, with its rows in file order and its distinct words */
function readModel(path, text) {
  const byReading = new Map();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const a = line.indexOf("\t"), b = line.indexOf("\t", a + 1);
    if (a < 0 || b < a) continue;
    const reading = line.slice(0, a), word = line.slice(a + 1, b);
    let l = byReading.get(reading);
    if (!l) { l = []; byReading.set(reading, l); }
    l.push(word);
  }
  let rows = 0, distinct = 0;
  for (const l of byReading.values()) { rows += l.length; distinct += new Set(l).size; }
  const depth = [...byReading.values()].map((l) => new Set(l).size).sort((a, b) => b - a);
  return { path, byReading, rows, distinct, deepest: depth[0] ?? 0, overCap: depth.filter((d) => d > CANDIDATE_CAP).length };
}

const models = files.map((p) => readModel(p, readFileSync(p, "utf8")));

/** characters visible in a single-syllable reading, as the engine exposes them */
function typable(text) {
  const dict = Dictionary.fromText(text, "<audit>");
  const out = new Set();
  for (const reading of dict.readings) {
    if (reading.includes("-")) continue;
    for (const e of dict.lookup(reading)) for (const ch of e.word) out.add(ch);
  }
  return out;
}

const inv = loadSyllableInventory(files[0]);
console.log("model                              rows   distinct  deepest  readings over CANDIDATE_CAP");
for (const m of models) {
  console.log(`${m.path.split("/").slice(-2).join("/").padEnd(34)} ${String(m.rows).padStart(6)} ${String(m.distinct).padStart(10)} ${String(m.deepest).padStart(8)} ${String(m.overCap).padStart(10)}`);
}

const sets = models.map((m) => typable(readFileSync(m.path, "utf8")));
console.log();
console.log("characters reachable in single-syllable readings");
sets.forEach((s, i) => console.log(`  ${models[i].path.split("/").slice(-2).join("/").padEnd(34)} ${s.size}`));
if (sets.length > 1) {
  const gained = [...sets[1]].filter((c) => !sets[0].has(c));
  const lost = [...sets[0]].filter((c) => !sets[1].has(c));
  console.log(`  gained  ${gained.length}    lost  ${lost.length}   (lost must be 0: the new model only adds)`);
}

// ---------------------------------------- can the engine reach what the file has?
const last = models[models.length - 1];
const text = readFileSync(last.path, "utf8");
const dict = Dictionary.fromText(text, "<audit>");
const engine = new InputEngine(dict, inv, { layout: "standard" });

/**
 * Reachability is checked against the file the engine actually reads, over
 * every reading a word appears under — not against a re-derivation. A word the
 * file lists but no keystroke can reach is the failure this audit exists for.
 *
 * Bopomofo letters and tone marks are excluded. The upstream data carries them
 * as words (ㄅ, ㄆ, … and ˇ ˋ ˙), but they are the alphabet the keys are made
 * of, not characters a user types, so counting them as unreachable content
 * would be a false report. They are counted and reported separately.
 */
const BOPOMOFO_OR_TONE = /^[\u3105-\u3129\u02c7\u02ca\u02cb\u02d9]$/;

const wordsInSingleReadings = new Set();
for (const [reading, list] of last.byReading) {
  if (reading.includes("-")) continue;
  for (const w of list) if (w.length === 1 && !BOPOMOFO_OR_TONE.test(w)) wordsInSingleReadings.add(w);
}
const symbols = new Set();
for (const [reading, list] of last.byReading) {
  if (reading.includes("-")) continue;
  for (const w of list) if (w.length === 1 && BOPOMOFO_OR_TONE.test(w)) symbols.add(w);
}
/** word -> the single-syllable readings it appears under (built once, not rescanned) */
const readingsOf = new Map();
for (const [reading, list] of last.byReading) {
  if (reading.includes("-")) continue;
  for (const w of new Set(list)) {
    if (w.length !== 1) continue;
    let l = readingsOf.get(w);
    if (!l) { l = []; readingsOf.set(w, l); }
    l.push(reading);
  }
}
const unreachable = [];
for (const w of wordsInSingleReadings) {
  let ok = false;
  for (const r of readingsOf.get(w) ?? []) {
    const keys = readingToKeys(r);
    if (!keys) continue;
    engine.reset();
    for (const ch of keys) engine.press(ch);
    const n = engine.currentSegmentation?.syllables?.length ?? 0;
    for (let i = 0; i < n; i++) {
      if (engine.candidatesAt(i, CANDIDATE_CAP).some((e) => e.word === w)) { ok = true; break; }
    }
    if (ok) break;
  }
  if (!ok) unreachable.push(w);
}
console.log();
console.log(`single characters the file lists       ${wordsInSingleReadings.size}   (excluding ${symbols.size} bopomofo letters / tone marks)`);
console.log(`  UNREACHABLE through the real engine  ${unreachable.length}`);
for (const w of unreachable.slice(0, SAMPLE)) console.log(`      ${w}`);
if (symbols.size) console.log(`  (the ${symbols.size} bopomofo letters and tone marks the upstream data carries as words are not counted)`);

// -------------------------------------------- duplicate rows, what the cap counts
console.log();
for (const m of models) {
  let dup = 0;
  for (const l of m.byReading.values()) dup += l.length - new Set(l).size;
  console.log(`${m.path.split("/").slice(-2).join("/").padEnd(34)} duplicate rows ${dup}`);
}
