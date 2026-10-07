#!/usr/bin/env node
/**
 * What does MAX_PER_READING actually cost?
 *
 * `data/build.mjs` keeps the 100 most probable words per reading and drops the
 * rest. For multi-syllable readings that is a ranking decision with no visible
 * effect — those readings are nowhere near the cap. For single-syllable
 * readings it is a deletion: ㄩˋ carries thousands of homophones and the
 * hundred-and-first is in no file the engine reads.
 *
 * The cap was justified by file size and grid-search time. This measures both,
 * so raising it can be decided on numbers instead of on the original guess.
 *
 * !! It WRITES data/bopomofo-lm.tsv (one build per cap) and leaves the last one
 *    there, so back the shipped file up first and restore it afterwards:
 *
 *      cp data/bopomofo-lm.tsv /tmp/lm-keep.tsv
 *      node cap-cost.mjs
 *      cp /tmp/lm-keep.tsv data/bopomofo-lm.tsv && git checkout -- data/stats.json
 *
 *    cap-raise-trial.mjs does the same measurement without touching the file.
 *
 * usage: node cap-cost.mjs [--caps 100,128,150,200,300,500,100000]
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { Dictionary } from "../../engine/src/dictionary.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const vendorDir = join(root, "data", "vendor");

const argCaps = process.argv.indexOf("--caps");
const CAPS = argCaps >= 0
  ? process.argv[argCaps + 1].split(",").map(Number)
  : [100, 128, 150, 200, 300, 500, 100000];

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

const src = readFileSync(join(vendorDir, "WebData.ts"), "utf8");
const tmp = join(vendorDir, ".cap-cost.gen.mjs");
writeFileSync(tmp, src);
const { webData } = await import(pathToFileURL(tmp).href);
if (existsSync(tmp)) unlinkSync(tmp);

/** reading -> sorted [{word, score}] desc */
const upstream = new Map();
for (const [key, value] of Object.entries(webData)) {
  if (key.startsWith("_")) continue;
  const reading = decodeKey(key);
  if (!reading) continue;
  const toks = value.split(" ");
  if (toks.length % 2 !== 0) continue;
  const seen = new Set();
  const list = [];
  for (let i = 0; i + 1 < toks.length; i += 2) {
    const word = toks[i];
    const score = Number.parseFloat(toks[i + 1]);
    if (!word || word.startsWith("MACRO@") || !Number.isFinite(score)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    list.push({ word, score });
  }
  if (list.length) upstream.set(reading, list);
}
for (const list of upstream.values()) list.sort((a, b) => b.score - a.score);

// How deep do the capped readings actually go?
const capped = [...upstream.entries()].filter(([, l]) => l.length > 100);
console.log(`readings over 100          ${capped.length}`);
console.log(`  all single-syllable?     ${capped.every(([r]) => !r.includes("-")) ? "yes" : "NO"}`);
console.log(`  depth: median ${(() => { const d = capped.map(([, l]) => l.length).sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; })()}, max ${Math.max(...capped.map(([, l]) => l.length))}`);
const depthHist = new Map();
for (const [, l] of capped) {
  const bucket = l.length <= 150 ? "101-150" : l.length <= 200 ? "151-200"
    : l.length <= 300 ? "201-300" : l.length <= 500 ? "301-500" : ">500";
  depthHist.set(bucket, (depthHist.get(bucket) ?? 0) + 1);
}
console.log(`  depth buckets: ${[...depthHist.entries()].sort().map(([k, v]) => `${k}:${v}`).join("  ")}`);
console.log();

// ---------------------------------------------------------------- per cap
const build = (cap) => {
  const rows = [];
  for (const [reading, list] of upstream) rows.push(...list.slice(0, cap).map((x) => [reading, x.word, x.score]));
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : b[2] - a[2]));
  return "# reading<TAB>word<TAB>log10_prob\n" + rows.map(([r, w, s]) => `${r}\t${w}\t${s}`).join("\n") + "\n";
};

/**
 * Decode cost: the same keystroke stream through every cap.
 *
 * Uses a real reading with a deep homophone list (ㄧˋ → 意 議 義 …) plus a
 * multi-syllable phrase, because the cap only changes the single-syllable
 * candidates and that is exactly where grid search spends its time.
 */
const PROBES = ["ㄧˋ", "ㄩˋ", "ㄕˋ", "ㄐㄧˋ", "ㄅㄧˋ"];
const KEYS = ["u4", "m4", "g4", "ru4", "1l4"];

console.log("cap        rows     bytes    load ms   buildDict ms   decode µs/op");
for (const cap of CAPS) {
  const text = build(cap);
  const bytes = Buffer.byteLength(text);

  const t0 = process.hrtime.bigint();
  const dict = Dictionary.fromText(text, `<cap${cap}>`);
  const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;

  // decode cost: cheap proxy — lookup depth for the deepest readings, which is
  // what the grid iterates over at each position.
  const t1 = process.hrtime.bigint();
  let sink = 0;
  const REPS = 2000;
  for (let i = 0; i < REPS; i++) {
    for (const r of PROBES) {
      const e = dict.lookup(r);
      sink += e.length;
    }
  }
  const lookupUs = (Number(process.hrtime.bigint() - t1) / 1e3) / (REPS * PROBES.length);

  const rows = text.split("\n").length - 2;
  console.log(`${String(cap).padEnd(9)} ${String(rows).padStart(7)} ${String(bytes).padStart(9)} ${"".padStart(8)} ${buildMs.toFixed(1).padStart(12)} ${lookupUs.toFixed(2).padStart(12)}`);
  if (cap === CAPS[0]) console.log(`          (shipped file is ${statSync(join(root, "data", "bopomofo-lm.tsv")).size} bytes)`);
  void sink;
}
